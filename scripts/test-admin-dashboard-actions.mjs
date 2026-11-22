import { crmBase, openCrmPage } from "./crm-browser-helpers.mjs";
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { rentalLedger } from '../src/crm-desk-overview-ledger.js';

// Rental cash must reconcile across multiple payments, refundable deposits,
// legacy invoices, linked booking shadows, and independently paid bookings.
const ledger = rentalLedger({
  invoices:[
    {id:'modern',status:'paid',subtotal:1000,amount_paid:1300,quote_id:'p'},
    {id:'legacy',status:'paid',subtotal:100,amount_paid:100,paid_at:'2026-11-03'},
    {id:'void',status:'void',subtotal:500,amount_paid:500,paid_at:'2026-11-08'},
  ],
  invoicePayments:[
    {id:'2',invoice_id:'modern',amount:600,paid_at:'2026-11-04'},
    {id:'1',invoice_id:'modern',amount:700,paid_at:'2026-10-29'},
  ],
  agreements:[{id:'a',source_type:'invoice',source_id:'legacy'}],
  bookings:[
    {id:'shadow',amount_paid:100,booked_on:'2026-11-03',notes:'[PL_FINANCE]{"agreement_id":"a"}'},
    {id:'manual',total_amount:575.5,amount_paid:525.5,booked_on:'2026-11-12'},
  ],
  proposals:[{id:'p',lead_id:'l'}],quotes:[{id:'l',source:'referral'}],
});
assert.equal(ledger.receipts.filter(r=>r.date.startsWith('2026-11')).reduce((n,r)=>n+r.amount,0),925.5);
assert.deepEqual(ledger.receipts.filter(r=>r.invoice_id==='modern').map(r=>r.source),['referral','referral']);
assert.equal(ledger.balance,50);

const browser=await chromium.launch({channel:'chrome',headless:true});
const mock=`export function createClient(){const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],invoices:[],invoice_payments:[],rental_agreements:[],quotes:[],quote_events:[],invoice_events:[],agreement_events:[],booking_sales:[],cars:[],crm_customers:[],quote_requests:[]};const session={user:{id:'audit',email:'audit@example.test'},access_token:'mock'};const query=table=>{let single=false,proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return(...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
try{
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',route=>route.fulfill({json:{invoices:[],agreements:[],quotes:[],cars:[],vehicles:[],customers:[],partners:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],template:{title:'Audit',body:'Audit',important_terms:[]}}}));
  await page.goto(crmBase+'/admin/');await page.locator('[data-admin-view]').waitFor();
  const root=page.locator('[data-executive-dashboard]');
  await root.locator('[data-desk-cash-period]').selectOption('week');
  assert.match(await root.locator('#rv-chart').innerText(), /No rental payments/);
  await root.locator('[data-desk-reports] > summary').click();
  await root.locator('[data-dashboard-range]').waitFor();
  await root.locator('[data-dashboard-range]').selectOption('custom');
  await root.locator('[data-dashboard-start]').fill('2026-10-01');
  await root.locator('[data-dashboard-end]').fill('2026-10-31');
  const sections = await root.locator('[data-dashboard-section]:visible').evaluateAll(nodes => [...new Set(nodes.map(n => n.dataset.dashboardSection))]);
  for (const section of sections) {
    await root.locator(`[data-dashboard-section="${section}"]:visible`).first().click();
    assert(await page.locator(`[data-section-panel="${section}"].active`).count(),section);
    await openCrmPage(page,"overview");
  }
  for(const [type,section,selector] of [['invoice','invoices','[data-invoice-dialog][open]'],['booking','bookings','[data-booking-dialog][open]'],['quote','requests','[data-quote-builder-dialog][open]']]){
    await root.locator(`[data-dashboard-create="${type}"]`).first().click();
    await page.locator(`[data-section-panel="${section}"].active`).waitFor();
    await page.locator(selector).waitFor();
    await page.keyboard.press('Escape');
    await openCrmPage(page,"overview");
  }
  const traffic = page.locator('.desk-operating-reports');
  await traffic.locator('summary').click();
  await traffic.getByText('0 fleet page views').waitFor();
  await traffic.getByText('No partner checks pending.').waitFor();
  await traffic.getByText('No competitor comparisons recorded.').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: dashboard date range, section links, and invoice/booking/quote quick actions (mocked).');
}finally{await browser.close();}
