import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true});
const mock=`export function createClient(){const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],invoices:[],invoice_payments:[],rental_agreements:[],quotes:[],quote_events:[],invoice_events:[],agreement_events:[],booking_sales:[],cars:[],crm_customers:[],quote_requests:[{id:'sample-inquiry',status:'new',name:'Alex Morgan',email:'alex@example.test',vehicle:'Ferrari Roma',created_at:'2026-11-01T15:00:00Z'}]};const session={user:{id:'audit',email:'audit@example.test'},access_token:'mock'};const query=table=>{let single=false,proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return(...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
try{
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',route=>route.fulfill({json:{invoices:[],agreements:[],quotes:[],cars:[],vehicles:[],customers:[],partners:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],template:{title:'Audit',body:'Audit',important_terms:[]}}}));
  await page.goto((process.env.CRM_PREVIEW_URL||'http://127.0.0.1:8775')+'/admin/');await page.locator('[data-admin-view]').waitFor();
  const root=page.locator('[data-executive-dashboard]');
  await root.locator('[data-desk-view="reports"]').click();
  await root.locator('[data-dashboard-range]').waitFor();
  await root.locator('[data-dashboard-range]').selectOption('custom');
  await root.locator('[data-dashboard-start]').fill('2026-10-01');
  await root.locator('[data-dashboard-end]').fill('2026-10-31');
  for(const [view,tab,section] of [['reports',null,'requests'],['desk','handoffs','bookings'],['desk',null,'vehicles']]){
    await root.locator(`[data-desk-view="${view}"]`).click();
    if(tab) await root.locator(`[data-desk-tab="${tab}"]`).click();
    await root.locator(`[data-dashboard-section="${section}"]:visible`).click();
    await page.locator(`[data-section-panel="${section}"].active`).waitFor();
    await page.locator('[data-crm-section="overview"]').click();
  }
  for(const [type,section,selector] of [['invoice','invoices','[data-invoice-form]'],['booking','bookings','[data-booking-dialog][open]'],['quote','requests','[data-quote-builder-dialog][open]']]){
    const actionMenu = root.locator('details.desk-create-menu');
    if (type !== 'booking' && !await actionMenu.evaluate(menu=>menu.open)) await actionMenu.locator('summary').click();
    await root.locator(`[data-dashboard-create="${type}"]`).first().click();
    await page.locator(`[data-section-panel="${section}"].active`).waitFor();
    await page.locator(selector).waitFor();
    if(type==='booking'||type==='quote')await page.keyboard.press('Escape');
    await page.locator('[data-crm-section="overview"]').click();
  }
  await root.locator('[data-desk-tab="inquiries"]').click();
  await root.locator('[data-desk-results] [data-id="sample-inquiry"]').click();
  await page.locator('[data-inquiry-review] [data-prepare-inquiry]').click();
  const builder=page.locator('[data-quote-builder-dialog][open]');
  await builder.waitFor();
  assert.equal(await builder.locator('[data-builder-lead]').inputValue(),'sample-inquiry');
  assert.match(await builder.locator('input[name="customer_email"]').inputValue(),/alex@example.test/);
  assert.equal(await page.locator('[data-inquiry-review]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: dashboard date range, section links, and invoice/booking/quote quick actions and inquiry-to-quote prefill (mocked).');
}finally{await browser.close();}
