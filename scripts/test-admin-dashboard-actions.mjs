import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true});
const mock=`export function createClient(){const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],invoices:[],invoice_payments:[],rental_agreements:[],quotes:[],quote_events:[],invoice_events:[],agreement_events:[],booking_sales:[],cars:[],crm_customers:[],quote_requests:[]};const session={user:{id:'audit',email:'audit@example.test'},access_token:'mock'};const query=table=>{let single=false,proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return(...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
try{
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',route=>route.fulfill({json:{invoices:[],agreements:[],quotes:[],cars:[],vehicles:[],customers:[],partners:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],template:{title:'Audit',body:'Audit',important_terms:[]}}}));
  await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();
  const root=page.locator('[data-executive-dashboard]');
  await root.locator('[data-dashboard-range]').waitFor();
  await root.locator('[data-dashboard-range]').selectOption('custom');
  await root.locator('[data-dashboard-start]').fill('2026-10-01');
  await root.locator('[data-dashboard-end]').fill('2026-10-31');
  for(const button of await root.locator('[data-dashboard-section]').all()){
    const section=await button.getAttribute('data-dashboard-section');
    await button.click();
    assert(await page.locator(`[data-section-panel="${section}"].active`).count(),section);
    await page.locator('[data-crm-section="overview"]').click();
  }
  for(const [type,section,selector] of [['invoice','invoices','[data-invoice-form]'],['booking','bookings','[data-booking-dialog][open]'],['quote','requests','[data-quote-builder-dialog][open]']]){
    await root.locator(`[data-dashboard-create="${type}"]`).first().click();
    await page.locator(`[data-section-panel="${section}"].active`).waitFor();
    await page.locator(selector).waitFor();
    if(type==='booking'||type==='quote')await page.keyboard.press('Escape');
    await page.locator('[data-crm-section="overview"]').click();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: dashboard date range, section links, and invoice/booking/quote quick actions (mocked).');
}finally{await browser.close();}
