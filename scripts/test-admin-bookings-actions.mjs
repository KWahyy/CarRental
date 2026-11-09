import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const mock = `export function createClient(){
  const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],rental_agreements:[],booking_sales:[],cars:[]};
  const session={user:{id:'audit-user',email:'audit@example.test'},access_token:'mock'};
  window.__auditWrites=[];
  function from(table){let operation='',payload=null,id=null,single=false,proxy;proxy=new Proxy({}, {get(_,key){
    if(key==='then')return resolve=>{let rows=fixtures[table]||[];
      if(operation==='insert'){const row={id:'audit-booking',...payload};window.__auditWrites.push({operation,table,payload});fixtures[table]=[row,...rows];rows=[row];}
      if(operation==='update'){window.__auditWrites.push({operation,table,payload,id});const index=rows.findIndex(row=>row.id===id);if(index>=0){rows[index]={...rows[index],...payload};rows=[rows[index]];}else rows=[];}
      if(operation==='delete'){window.__auditWrites.push({operation,table,id});fixtures[table]=rows.filter(row=>row.id!==id);rows=[];}
      resolve({data:single?(rows[0]||null):rows,error:null,count:rows.length});};
    return (...args)=>{if(key==='insert'||key==='update'){operation=key;payload=args[0];}if(key==='delete')operation=key;if(key==='eq'&&args[0]==='id')id=args[1];if(key==='single'||key==='maybeSingle')single=true;return proxy;};
  }});return proxy;}
  return {from,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};
}`;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/supabase-js@2/+esm', route => route.fulfill({ contentType: 'text/javascript', body: mock }));
  await page.route('**/api/**', route => route.fulfill({ json: { vehicles: [], invoices: [], quotes: [], customers: [], agreements: [], template: { title: 'Audit', body: 'Audit', important_terms: [] } } }));
  await page.goto('http://127.0.0.1:8775/admin/');
  await page.locator('[data-admin-view]').waitFor();
  await page.locator('[data-crm-section="bookings"]').click();
  await page.locator('[data-new-booking]').click();
  await page.locator('[data-booking-dialog][open]').waitFor();
  const form = page.locator('[data-booking-form]');
  await form.locator('[name="customer_name"]').fill('Audit Customer');
  await form.locator('[name="vehicle"]').fill('Audit Vehicle');
  await form.locator('[name="total_amount"]').fill('1200');
  await form.locator('[name="amount_paid"]').fill('300');
  await form.locator('[name="start_date"]').fill('2026-10-22');
  await form.locator('[name="end_date"]').fill('2026-10-20');
  await form.getByRole('button', { name: 'Save booking' }).click();
  assert.match(await form.locator('[data-booking-status]').textContent(), /Rental end/);
  assert.equal((await page.evaluate(() => window.__auditWrites)).length, 0);
  await form.locator('[name="end_date"]').fill('2026-10-24');
  await form.getByRole('button', { name: 'Save booking' }).click();
  await page.locator('[data-booking-dialog][open]').waitFor({ state: 'hidden' });
  let writes = await page.evaluate(() => window.__auditWrites);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].payload.total_amount, 1200);
  assert.equal(writes[0].payload.amount_paid, 300);
  assert.equal(writes[0].payload.payment_status, 'partial');
  await page.locator('[data-open-booking]').click();
  await form.locator('[name="amount_paid"]').fill('1300');
  await form.getByRole('button', { name: 'Save booking' }).click();
  assert.match(await form.locator('[data-booking-status]').textContent(), /cannot exceed/);
  writes = await page.evaluate(() => window.__auditWrites);
  assert.equal(writes.length, 1);
  await form.locator('[name="amount_paid"]').fill('300');
  await form.locator('[name="cancelled"]').check();
  await form.getByRole('button', { name: 'Save booking' }).click();
  writes = await page.evaluate(() => window.__auditWrites);
  assert.equal(writes[1].payload.payment_status, 'partial');
  await page.locator('[data-open-booking]').click();
  await form.locator('[data-close-booking]').last().click();
  await page.locator('[data-booking-dialog][open]').waitFor({state:'hidden'});
  await page.locator('[data-open-booking]').click();
  await form.locator('[data-delete-booking]').click();
  await page.locator('[data-open-booking]').waitFor({state:'hidden'});
  writes = await page.evaluate(() => window.__auditWrites);
  assert(writes.some(write => write.operation === 'delete'));
  assert.deepEqual(errors, []);
  console.log('PASS: manual booking totals, partial payment, overpayment validation, and cancellation status (mocked).');
} finally { await browser.close(); }
