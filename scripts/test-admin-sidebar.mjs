import {crmBase, openCrmPage} from './crm-browser-helpers.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('tmp/admin-navigation',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures=populated?{admin_profiles:[{role:'owner',display_name:'Preview'}],invoices:[{id:'preview-invoice',invoice_number:'PREVIEW-001',customer_name:'Test Customer',vehicle_name:'Test Vehicle',status:'draft',rental_total:1200,total:1200,created_at:new Date().toISOString(),line_items:[]}]}:{admin_profiles:[{role:'owner',display_name:'Preview'}]};
// A long ledger exercises the sticky navigation after switching away from Overview.
fixtures.booking_sales = Array.from({length:36}, (_,i)=>({
  id:'navigation-booking-'+i,customer_name:'Test renter '+i,vehicle:'Test vehicle',
  booked_on:'2026-10-12',start_date:'2026-10-12',end_date:'2026-10-13',
  total_amount:100,amount_paid:0,notes:''
}));
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;

// Both shells use the same button so direct links, keyboard navigation and
// breakpoint changes keep a single active page.
async function checkNavigationPosition(page, desktop) {
  const nav = page.locator(desktop ? '#desk-sidebar' : '.desk-mobile-bar');
  await nav.waitFor();
  const maxScroll = await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
  assert(maxScroll > 250, 'Test needs a scrollable workspace');
  for (const top of [0, Math.round(maxScroll/2), maxScroll]) {
    await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),top);
    await page.waitForFunction(y=>Math.abs(scrollY-y)<2,top);
    const bounds=await nav.evaluate(el=>{
      const nav=el.getBoundingClientRect();
      const content=document.getElementById('workspace-content').getBoundingClientRect();
      return {top:nav.top,left:nav.left,right:nav.right,bottom:nav.bottom,contentLeft:content.left,
        height:innerHeight,width:innerWidth,documentWidth:document.documentElement.scrollWidth};
    });
    assert(Math.abs(bounds.top)<1 && Math.abs(bounds.left)<1,JSON.stringify(bounds));
    assert(bounds.documentWidth<=bounds.width,JSON.stringify(bounds));
    if(desktop) {
      assert(Math.abs(bounds.bottom-bounds.height)<1,JSON.stringify(bounds));
      assert(bounds.contentLeft>=bounds.right-1,'Sidebar obscures the page');
    } else {
      assert(Math.abs(bounds.width-bounds.right)<1,JSON.stringify(bounds));
      assert(await page.locator('[data-workspace-menu]').isVisible());
      assert(!await page.locator('#desk-sidebar').isVisible());
    }
  }
}

async function checkDrawer(page) {
  const launcher=page.locator('[data-workspace-menu]');
  const directory=page.locator('#desk-directory');
  await launcher.focus();
  await page.keyboard.press('Enter');
  await directory.waitFor();
  assert.equal(await launcher.getAttribute('aria-expanded'),'true');
  assert.equal(await directory.locator('[data-crm-section]').count(),8);
  const bounds=await directory.boundingBox();
  assert(bounds && Math.abs(bounds.x)<1 && Math.abs(bounds.y)<1 &&
    Math.abs(bounds.height-page.viewportSize().height)<1,'Drawer should fill the left edge');
  assert(await directory.locator('[data-close-directory]').evaluate(el=>el===document.activeElement));
  for(let i=0;i<10;i++) {
    await page.keyboard.press('Tab');
    assert(await directory.evaluate(el=>el.contains(document.activeElement) || document.activeElement===document.body),
      'Focus moved to the page behind the open drawer');
  }
  await page.keyboard.press('Escape');
  await directory.waitFor({state:'hidden'});
  await page.waitForFunction(()=>{
    const trigger=document.querySelector('[data-workspace-menu]');
    return document.activeElement===trigger && trigger.getAttribute('aria-expanded')==='false';
  });
}

async function assertRoute(page,id) {
  const panel=page.locator(`[data-section-panel="${id}"]`);
  await panel.waitFor();
  await page.waitForFunction(key=>document.querySelector(`[data-crm-section="${key}"]`).getAttribute('aria-current')==='page',id);
  assert.equal(new URL(page.url()).searchParams.get('page'),id);
  assert.equal(await page.locator('[data-crm-section][aria-current="page"]').count(),1);
}

try {
  for (const width of [390,768,1099,1100,1440]) {
    const desktop=width>=1100;
    const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
    await page.route('**/api/**',route=>route.fulfill({json:{cars:[],vehicles:[],invoices:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],data:[],agreements:[],template:{title:'Test',body:'Test',important_terms:[]}}}));
    await page.goto(crmBase+'/admin/?page=overview');
    await page.locator('[data-admin-view] #sales').waitFor();
    await checkNavigationPosition(page,desktop);
    if(desktop) {
      assert.equal(await page.locator('#desk-sidebar [data-crm-section]:visible').count(),8);
      assert(!await page.locator('[data-workspace-menu]').isVisible());
    } else {
      await checkDrawer(page);
    }
    await openCrmPage(page,'bookings');
    await assertRoute(page,'bookings');
    if(!desktop) await page.waitForFunction(()=>document.activeElement===document.getElementById('workspace-content'));
    await page.locator('.op-book-row').first().waitFor();
    await checkNavigationPosition(page,desktop);
    await page.screenshot({path:`tmp/admin-navigation/${width}-scrolled.png`});
    await page.reload();
    await assertRoute(page,'bookings');
    await page.locator('.op-book-row').first().waitFor();

    // Rotate an open phone drawer onto the desktop breakpoint, and back.
    if(width===390) {
      await page.locator('[data-workspace-menu]').click();
      await page.setViewportSize({width:1440,height:900});
      await page.locator('#desk-sidebar [data-crm-section="bookings"]').waitFor();
      assert(!await page.locator('#desk-directory').isVisible());
      await assertRoute(page,'bookings');
      await page.setViewportSize({width,height:844});
      await page.locator('[data-workspace-menu]').waitFor();
      assert.equal(await page.locator('[data-crm-section]').count(),8);
    }
    await openCrmPage(page,'overview');
    await assertRoute(page,'overview');
    await page.waitForFunction(()=>scrollY===0);
    await page.goBack();
    await assertRoute(page,'bookings');
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(`${width}px: pinned navigation, keyboard access, ledger scrolling, reload and route history passed.`);
  }
} finally {await browser.close();}
