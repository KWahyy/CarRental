import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {crmBase} from './crm-browser-helpers.mjs';

const sdk = `
  export function createClient() {
    const mode = window.fixtureMode;
    const fixtureSession = {user:{id:"fixture-user"}, access_token:"fixture"};
    let session = mode === "signed-out" || sessionStorage.signedOut ? null : fixtureSession;
    const auth = {
      async getSession() {
        await window.fixtureReady;
        if (mode === "failed") return {error: new Error("offline")};
        return {data:{session}};
      },
      onAuthStateChange(callback) {
        window.fixtureReady.then(() => callback("INITIAL_SESSION", session));
        window.fixtureCallbacks.push(callback);
        return {data:{subscription:{unsubscribe(){}}}};
      },
      async signInWithPassword() {
        session = fixtureSession;
        window.fixtureCallbacks.forEach(callback => callback("SIGNED_IN", session));
        return {data:{session},error:null};
      },
      async signOut() {
        sessionStorage.signedOut = "true";
        window.fixtureCallbacks.forEach(callback => callback("SIGNED_OUT", null));
        return {error:null};
      }
    };
    return {
      auth,
      from(name) {
        let one = false;
        let query;
        query = new Proxy({}, {get(_, key) {
          if (key === "then") return resolve => {
            window.fixtureTables.push(name);
            const rows = name === "admin_profiles" && mode !== "denied" ? [{role:"owner"}] : [];
            resolve({data:one ? rows[0] || null : rows, error:null});
          };
          return () => { if (key === "maybeSingle" || key === "single") one = true; return query; };
        }});
        return query;
      }
    };
  }
`;

const browser = await chromium.launch({channel:'chrome', headless:true});
async function open(width, mode, path) {
  const page = await browser.newPage({viewport:{width,height:850},hasTouch:width<600});
  const apiPaths = [];
  await page.addInitScript(mode => {
    window.fixtureMode = mode;
    window.fixtureTables = [];
    window.fixtureCallbacks = [];
    window.fixtureReady = new Promise(resolve => { window.finishFixtureLogin = resolve; });
  }, mode);
  await page.route('**/supabase-js@2/+esm', route => mode === 'offline-sdk'
    ? route.abort() : route.fulfill({contentType:'text/javascript',body:sdk}));
  await page.route('**/api/**', route => {
    apiPaths.push(new URL(route.request().url()).pathname);
    return route.fulfill({json:{template:{title:'Fixture terms',body:'Fixture terms',version:1,important_terms:[]}}});
  });
  await page.goto(crmBase + path);
  await page.locator('[data-auth-pending]').waitFor();
  assert(await page.locator('[data-login-view]').isHidden());
  assert(await page.locator('[data-admin-view]').isHidden());
  return {page,apiPaths};
}

try {
  for (const width of [1440,390]) {
    const {page,apiPaths} = await open(width,'owner','/admin/?page=settings');
    await page.evaluate(() => window.finishFixtureLogin());
    await page.getByText('Template version 1',{exact:true}).waitFor();
    assert(await page.locator('[data-section-panel="settings"]').isVisible());
    assert(await page.locator('[data-auth-pending]').isHidden());
    assert(await page.locator('[data-login-view]').isHidden());
    await page.waitForTimeout(1550); // Cross the previous automatic preload interval.
    assert.deepEqual(apiPaths, ['/api/agreement-settings']);
    assert.deepEqual(await page.evaluate(() => window.fixtureTables), ['admin_profiles']);
    if (width < 600) await page.getByRole('button',{name:'Open CRM navigation'}).click();
    await page.getByRole('button',{name:'Sign out'}).click();
    await page.waitForURL(url => !url.search);
    await page.evaluate(() => window.finishFixtureLogin());
    await page.locator('[data-login-form]').waitFor();
    assert(await page.locator('[data-admin-view]').isHidden());
    await page.close();
    console.log(width + 'px: session frame, direct Settings, zero unrelated reads, sign-out');
  }

  for (const [mode,path,visible] of [
    ['signed-out','/admin/?page=settings','[data-login-form]'],
    ['denied','/admin/','[data-login-status][data-tone="error"]'],
    ['failed','/admin/','[data-login-status][data-tone="error"]'],
    ['owner','/admin/?recovery=1','[data-new-password-form]'],
    ['offline-sdk','/admin/','[data-retry-startup]']
  ]) {
    const {page,apiPaths} = await open(390,mode,path);
    await page.evaluate(() => window.finishFixtureLogin());
    await page.locator(visible).waitFor();
    assert(await page.locator('[data-admin-view]').isHidden());
    assert.deepEqual(apiPaths, []);
    if (mode === 'signed-out') {
      await page.locator('#admin-email').fill('staff@example.test');
      await page.locator('#admin-password').fill('test-password-only');
      await page.getByRole('button',{name:'Sign in',exact:true}).click();
      await page.getByText('Template version 1',{exact:true}).waitFor();
      assert(await page.locator('[data-login-view]').isHidden());
    }
    await page.close();
  }
  console.log('Signed out, unauthorized, failed restore, recovery and unavailable SDK states passed');
} finally { await browser.close(); }
