import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures=populated?{admin_profiles:[{role:'owner',display_name:'Preview'}],invoices:[{id:'preview-invoice',invoice_number:'PREVIEW-001',customer_name:'Test Customer',vehicle_name:'Test Vehicle',status:'draft',rental_total:1200,total:1200,created_at:new Date().toISOString(),line_items:[]}]}:{admin_profiles:[{role:'owner',display_name:'Preview'}]};
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
try{for(const width of (populated?[390,1440]:[320,390,768,1440])){
 const page=await browser.newPage({viewport:{width,height:960}});const errors=[];page.on('pageerror',e=>(errors.push(e.message),console.log('PAGEERROR',e.stack)));
 await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.route('**/api/**',r=>r.fulfill({json:{cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],settings:{},template:{title:'Preview template',body:'Preview only',important_terms:[]},data:[]}}));
 await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor({timeout:5000});await page.waitForTimeout(700);
 for(const section of ['overview','vehicles','requests','customers','invoices','agreements','bookings','settings']){
 if(width<760)await page.locator('[data-workspace-menu]').click();
 await page.locator(`[data-crm-section="${section}"]`).click();await page.waitForTimeout(350);assert.equal(await page.locator(`[data-crm-section="${section}"]`).getAttribute('aria-current'),'page');assert.equal(await page.locator('.admin-section.active').evaluate(e=>getComputedStyle(e).animationName),'none');if(width<760)assert.equal(await page.locator('[data-workspace-menu]').getAttribute('aria-expanded'),'false');
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${width} ${section} overflow`);
 await page.screenshot({path:`output/admin-workspace/${width}-${section}${populated?"-populated":""}.png`,fullPage:true});
 console.log(`${width}: ${section} layout passed`);
 if(populated && section==='overview') {const reports=page.locator('.executive-reports');assert.equal(await reports.getAttribute('open'),null);await reports.locator('summary').click();assert(await reports.evaluate(e=>e.open));assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:`output/admin-workspace/${width}-reports-expanded.png`,fullPage:true});await reports.locator('summary').click();}

 if(['vehicles','invoices','bookings','requests'].includes(section)){const selectors={vehicles:'[data-fleet-add]',invoices:'[data-new-invoice]',bookings:'[data-new-booking]',requests:'[data-new-quote]'};const opener=page.locator(selectors[section]);if(await opener.count()){await opener.first().click();await page.waitForTimeout(250);const dialog=page.locator('dialog[open]');if(await dialog.count()){assert.equal(await dialog.evaluate(e=>getComputedStyle(e).animationName),'none');assert(!await dialog.evaluate(e=>e.scrollWidth>e.clientWidth+1),'Dialog horizontal overflow');}await page.screenshot({path:`output/admin-workspace/${width}-${section}-dialog.png`});await page.keyboard.press('Escape');}}
 }assert.deepEqual(errors,[]); await page.emulateMedia({reducedMotion:'reduce'}); assert.equal(await page.locator('.admin-section.active').evaluate(e=>getComputedStyle(e).animationName),'none');console.log('Runtime and reduced motion checks passed');await page.close();
}}finally{await browser.close()}
