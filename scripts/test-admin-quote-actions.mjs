import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true});
const quotes=[
  {id:'draft',quote_number:'AUDIT-DRAFT',status:'draft'},
  {id:'sent',quote_number:'AUDIT-SENT',status:'sent',sent_at:'2026-10-13T12:00:00Z'},
  {id:'cancel',quote_number:'AUDIT-CANCEL',status:'sent',sent_at:'2026-10-13T12:00:00Z'},
  {id:'accepted',quote_number:'AUDIT-ACCEPTED',status:'accepted',accepted_at:'2026-10-13T12:00:00Z',amount_required:300,deposit_paid_amount:0},
].map(item=>({customer_first_name:'Audit',customer_last_name:'Customer',customer_phone:'555-0100',customer_email:'audit@example.test',vehicle_name:'Audit Vehicle',rental_total:1200,amount_required:300,deposit_paid_amount:0,remaining_balance:1200,security_deposit:500,rate_amount:600,duration_value:2,duration_type:'days',rate_type:'daily',line_items:[],internal_costs:[],created_at:'2026-10-13T12:00:00Z',start_at:'2026-10-20T12:00:00Z',end_at:'2026-10-22T12:00:00Z',expires_at:'2026-10-19T12:00:00Z',revision:1,public_url:'https://example.test/audit',...item}));
const cars=[{id:'audit-car',name:'Audit Vehicle',make:'Audit',model:'Vehicle',price:600,is_active:true,security_deposit:500}];
const calls=[];
const mock=`export function createClient(){const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],invoices:[],rental_agreements:[],booking_sales:[],cars:[]};const session={user:{id:'audit',email:'audit@example.test'},access_token:'mock'};const query=table=>{let single=false,proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return(...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
try{
  const page=await browser.newPage({viewport:{width:1440,height:950},permissions:['clipboard-read','clipboard-write']});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',route=>{
    const request=route.request(),url=new URL(request.url());
    if(!url.pathname.endsWith('/quotes'))return route.fulfill({json:{invoices:[],agreements:[],template:{title:'Audit',body:'Audit',important_terms:[]}}});
    const body=request.method()==='GET'?{}:request.postDataJSON();calls.push({method:request.method(),body});
    if(request.method()==='GET'){
      const quote=quotes.find(item=>item.id===url.searchParams.get('id'));
      return route.fulfill({json:quote?{quote,events:[],revisions:[]}:{quotes,cars,customers:[],leads:[],employees:[],partners:[],reservations:[],blocks:[]}});
    }
    if(request.method()==='DELETE'){
      const index=quotes.findIndex(item=>item.id===url.searchParams.get('id'));if(index>=0)quotes.splice(index,1);
      return route.fulfill({json:{deleted:true}});
    }
    const quote=quotes.find(item=>item.id===body.id);
    if(body.action==='duplicate'){
      const copy={...quote,id:'copy',quote_number:'AUDIT-COPY',status:'draft'};quotes.push(copy);return route.fulfill({json:{quote:copy}});
    }
    if(!body.action&&request.method()==='POST'){
      const created={...quotes[0],...body,id:'created',quote_number:'AUDIT-CREATED',vehicle_name:'Audit Vehicle',rental_total:1200,amount_required:300,deposit_paid_amount:0,remaining_balance:1200,status:'draft',revision:1,public_url:'https://example.test/audit-created'};
      quotes.push(created);return route.fulfill({json:{quote:created}});
    }
    if(body.action==='send')quote.status='sent';
    if(body.action==='status'){quote.status=body.status;if(body.status==='accepted')quote.accepted_at='2026-10-14T12:00:00Z';}
    if(body.action==='record_payment'){quote.deposit_paid_amount+=body.amount;quote.status='deposit_pending';}
    if(body.action==='convert'){quote.status='converted';return route.fulfill({json:{quote,reservation:{agreement_number:'AUDIT-AGREEMENT'}}});}
    return route.fulfill({json:{quote,delivery:{delivered:true}}});
  });
  await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();
  await page.locator('[data-crm-section="requests"]').click();await page.locator('[data-open-quote-button]').first().waitFor();
  const open=async id=>{await page.locator('[data-crm-section="requests"]').click();await page.locator(`[data-open-quote-button="${id}"]`).click();await page.locator(`[data-detail-action]`).first().waitFor();};
  await open('draft');
  await page.locator('[data-detail-action="edit"]').click();await page.locator('[data-quote-builder-dialog][open]').waitFor();await page.keyboard.press('Escape');
  await page.locator('[data-detail-action="duplicate"]').click();await page.locator('[data-detail-action="delete"]').waitFor();
  await page.locator('[data-detail-action="delete"]').click();
  await open('draft');await page.locator('[data-detail-action="send"]').click();
  await page.waitForTimeout(500);
  assert.match(await page.locator('[data-detail-action="send"]').textContent(),/Resend/);
  assert.equal(quotes.find(item=>item.id==='draft').status,'sent');
  await page.locator('[data-detail-action="copy"]').click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://example.test/audit');
  await page.locator('[data-detail-action="send"]').click();
  await page.waitForTimeout(300);
  assert.equal(calls.filter(call=>call.body?.action==='send'&&call.body?.id==='draft').length,2);
  await page.locator('[data-save-followup]').click();
  await page.locator('[data-detail-action="send"]').waitFor();
  assert(calls.some(call=>call.body?.action==='follow_up'));
  await open('sent');await page.locator('[data-detail-action="accept"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-detail-action="payment"]'));
  await page.locator('[data-detail-action="payment"]').click();await page.locator('[data-payment-dialog][open]').waitFor();
  await page.locator('[data-payment-dialog] [name="amount"]').fill('300');
  await page.locator('[data-payment-dialog] button[type="submit"]').click();
  await page.locator('[data-payment-dialog][open]').waitFor({state:'hidden'});
  await open('sent');
  await page.locator('[data-detail-action="convert"]').click();
  await page.waitForTimeout(500);
  assert(calls.some(call=>call.body?.action==='convert'));
  await open('draft');
  await page.locator('[data-detail-action="decline"]').click();
  await page.locator('[data-decline-dialog][open]').waitFor();
  await page.locator('[data-decline-dialog] [name="reason"]').selectOption({index:1});
  await page.locator('[data-decline-dialog] button[type="submit"]').click();
  await page.locator('[data-decline-dialog][open]').waitFor({state:'hidden'});
  assert(calls.some(call=>call.body?.status==='declined'));
  await open('cancel');await page.locator('[data-detail-action="cancel"]').click();
  await page.waitForTimeout(300);
  assert.equal(quotes.find(item=>item.id==='cancel').status,'cancelled');
  await open('accepted');await page.locator('[data-detail-action="convert"]').count().then(count=>assert.equal(count,0));
  await page.locator('[data-crm-section="requests"]').click();
  await page.locator('[data-new-quote]').click();
  const builder=page.locator('[data-quote-builder-dialog]');
  await builder.locator('[name="customer_first_name"]').fill('New');
  await builder.locator('[name="customer_last_name"]').fill('Customer');
  await builder.locator('[name="customer_phone"]').fill('555-0142');
  await builder.locator('[data-builder-next]').click();
  await builder.locator('[name="vehicle_id"]').selectOption('audit-car');
  await builder.locator('[name="start_at"]').fill('2026-10-20T12:00');
  await builder.locator('[name="end_at"]').fill('2026-10-22T12:00');
  await builder.locator('[data-builder-next]').click();
  await builder.locator('[name="rate_amount"]').fill('600');
  await builder.locator('[data-add-line]').click();
  assert.equal(await builder.locator('[data-line-index]').count(),1);
  await builder.locator('[data-remove-line]').click();
  await builder.locator('[data-builder-next]').click();
  await builder.locator('[data-add-cost]').click();
  assert.equal(await builder.locator('[data-cost-index]').count(),1);
  await builder.locator('[data-remove-cost]').click();
  await builder.locator('[data-save-draft]').click();
  await builder.waitFor({state:'hidden'});
  assert(calls.some(call=>call.method==='POST'&&!call.body?.action&&call.body?.vehicle_id==='audit-car'));
  assert(calls.some(call=>call.body?.action==='duplicate'));
  assert(calls.some(call=>call.body?.action==='send'));
  assert(calls.some(call=>call.body?.action==='status'&&call.body.status==='accepted'));
  assert(calls.some(call=>call.body?.action==='record_payment'));
  assert.deepEqual(errors,[]);
  console.log('PASS: quote builder, line items, costs, edit/duplicate/delete/send/resend/copy/accept/payment/convert/decline/cancel/follow-up (mocked).');
}finally{await browser.close();}
