import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775';
const html=readFileSync('admin/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-login',{recursive:true});
try {
 for(const width of [320,390,768,1440]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/admin/?*',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto(base+'/admin/?test=1');
 await page.evaluate(async()=>{
  const {initAdminLogin}=await import('/src/admin-login.js');
  window.calls=[];window.result='invalid';
  window.auth={
   async signInWithPassword(){window.calls.push('signin');await new Promise(r=>setTimeout(r,100));if(window.result==='network')throw Error('offline');return {error:window.result==='invalid'?{status:400}:null}},
   async resetPasswordForEmail(email,options){window.calls.push({email,options});return {error:null}},
   async getSession(){return {data:{session:window.session?{}:null}}},
   async updateUser(){window.calls.push('update');return {error:null}},
   async signOut(){return {error:null}},
   onAuthStateChange(fn){window.authEvent=fn}
  };
  initAdminLogin({document,auth:window.auth,onSignedIn:()=>window.signedIn=true,location,history});
 });
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.locator('#admin-email').fill('test@example.com');await page.locator('#admin-password').fill('test-password-only');
 await page.locator('[data-password-toggle]').click();assert.equal(await page.locator('#admin-password').getAttribute('type'),'text');
 await page.locator('[data-password-toggle]').click();await page.locator('[data-login-form] [type=submit]').click();
 await page.getByText('Unable to sign in.',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.signedIn),undefined);
 await page.evaluate(()=>window.result='network');await page.locator('[data-login-form] [type=submit]').click();await page.getByText('Unable to connect.',{exact:false}).waitFor();
 assert(!await page.locator('[data-login-form] [type=submit]').isDisabled());
 await page.locator('[data-forgot-password]').click();assert.equal(await page.locator('#reset-email').inputValue(),'test@example.com');
 await page.locator('[data-reset-form] [type=submit]').click();await page.getByText('If this email matches an account,',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.at(-1).options.redirectTo),base+'/admin/?recovery=1');
 await page.locator('[data-reset-form] [data-back-login]').click();
 await page.evaluate(()=>window.authEvent('PASSWORD_RECOVERY'));
 await page.locator('#new-password').fill('a-long-test-passphrase');await page.locator('#confirm-password').fill('different-test-passphrase');
 await page.locator('[data-new-password-form] [type=submit]').click();await page.getByText('Use at least 12 characters and make sure both passwords match.').waitFor();
 await page.locator('#confirm-password').fill('a-long-test-passphrase');await page.locator('[data-new-password-form] [type=submit]').click();await page.getByText('This reset link has expired or is invalid.',{exact:false}).waitFor();
 await page.evaluate(()=>window.session=true);await page.locator('[data-new-password-form] [type=submit]').click();await page.waitForFunction(()=>window.signedIn===true);
 assert.equal(await page.locator('#new-password').inputValue(),'');
 await page.locator('[data-new-password-form] [data-back-login]').click();await page.screenshot({path:`output/admin-login/${width}.png`});
 await page.close();console.log(`${width}: login, errors, visibility, recovery and layout passed (mocked)`);
 }
} finally {await browser.close();}
