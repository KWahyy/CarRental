import {crmBase} from './crm-browser-helpers.mjs';
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

async function checkPinnedNavigation(page, selector, phone) {
  const nav = page.locator(selector);
  await nav.waitFor();
  const maxScroll = await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
  assert(maxScroll>250,'Test needs a scrollable workspace');
  for (const scroll of [0,Math.round(maxScroll*.45),maxScroll]) {
    await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),scroll);
    await page.waitForFunction(y=>Math.abs(scrollY-y)<2,scroll);
    const geometry = await nav.evaluate(node=>{
      const header=document.querySelector('.desk-bar').getBoundingClientRect();
      const menu=document.querySelector('[data-workspace-menu]').getBoundingClientRect();
      const nav=node.getBoundingClientRect();
      return {top:header.top,bottom:header.bottom,menuTop:menu.top,menuBottom:menu.bottom,
        navTop:nav.top,navBottom:nav.bottom,navLeft:nav.left,navRight:nav.right,height:innerHeight,width:innerWidth};
    });
    assert(Math.abs(geometry.top)<1,JSON.stringify(geometry));
    assert(geometry.menuTop>=-1 && geometry.menuBottom<=geometry.bottom+1,JSON.stringify(geometry));
    assert(geometry.navLeft>=-1 && geometry.navRight<=geometry.width+1,JSON.stringify(geometry));
    if(phone) assert(Math.abs(geometry.navBottom-geometry.height)<1,JSON.stringify(geometry));
    else assert(geometry.navTop>=geometry.top-1 && geometry.navBottom<=geometry.bottom+1,JSON.stringify(geometry));
  }
}

try {
  for (const width of [390,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
    await page.route('**/api/**',r=>r.fulfill({json:{cars:[],vehicles:[],invoices:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],data:[],agreements:[],template:{title:'Test',body:'Test',important_terms:[]}}}));
    await page.goto(crmBase+'/admin/?page=overview');
    await page.locator('[data-admin-view] #sales').waitFor();
    await checkPinnedNavigation(page,'[data-desk-overview-nav]',width===390);

    const launcher=page.locator('[data-workspace-menu]');
    const directory=page.locator('#desk-directory');
    await launcher.focus();await page.keyboard.press('Enter');
    await directory.waitFor();assert.equal(await launcher.getAttribute('aria-expanded'),'true');
    assert(await directory.locator('[data-close-directory]').evaluate(node=>node===document.activeElement));
    await page.keyboard.press('Tab');
    assert(await directory.locator('[data-crm-section="overview"]').evaluate(node=>node===document.activeElement));
    await page.keyboard.press('Escape');
    await directory.waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.querySelector('[data-workspace-menu]').getAttribute('aria-expanded')==='false');
    assert(await launcher.evaluate(node=>node===document.activeElement),'Escape should return focus to CRM pages');

    await page.keyboard.press('Enter');await directory.waitFor();
    await page.keyboard.press('Tab');await page.keyboard.press('Tab');
    assert(await directory.locator('[data-crm-section="bookings"]').evaluate(node=>node===document.activeElement));
    await page.keyboard.press('Enter');
    await directory.waitFor({state:'hidden'});
    await page.locator('.op-book-row').first().waitFor();
    await page.waitForFunction(()=>document.activeElement===document.getElementById('workspace-content'));
    assert.equal(new URL(page.url()).searchParams.get('page'),'bookings');
    assert.equal(await page.locator('[data-desk-route="bookings"]').getAttribute('aria-current'),'page');
    assert(!(await page.locator('[data-desk-overview-nav]').isVisible()));
    await checkPinnedNavigation(page,'[data-desk-primary-nav]',width===390);
    await page.screenshot({path:`tmp/admin-navigation/${width}-scrolled.png`});

    await page.locator('[data-desk-route="overview"]').click();
    await page.locator('[data-desk-overview-nav]').waitFor();
    await page.waitForFunction(()=>scrollY===0);
    assert.equal(new URL(page.url()).searchParams.get('page'),'overview');
    assert.deepEqual(errors,[]);
    console.log(`${width}px: sticky navigation, scrollable ledger, keyboard directory and return to Overview passed.`);
    await page.close();
  }
} finally {await browser.close();}
