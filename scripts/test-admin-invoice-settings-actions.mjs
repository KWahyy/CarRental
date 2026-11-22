import { crmBase, openCrmPage } from "./crm-browser-helpers.mjs";
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const mock = `export function createClient(){const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],quote_requests:[],rental_agreements:[],booking_sales:[],cars:[]};const session={user:{id:'audit-user',email:'audit@example.test'},access_token:'mock'};const query=table=>{let single=false,proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>{const rows=window.auditFinanceTables?.[table]||fixtures[table]||[];return resolve({data:single?(rows[0]||null):rows,error:null,count:0});};return(...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
let invoices=[];
let template={title:'Audit terms',body:'Audit only',important_terms:[],version:1};
const calls=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:950},acceptDownloads:true});
  const car={id:"audit-car",name:"Audit Vehicle",ownership_type:"prestige",is_active:true,photos:[],agreements:[],blocks:[],expenses:[],maintenance:[],documents:[],metrics:{status:"available",revenue:0,gross_profit:0,next_reservation:null}};
  await page.addInitScript(car=>{
    window.auditFinanceTables={cars:[car],invoices:[],invoice_payments:[]};
    window.auditFinanceChanges=0;
    window.addEventListener("prestige:finance-updated",()=>window.auditFinanceChanges++);
  },car);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    const body=['POST','PATCH','PUT'].includes(method)?request.postDataJSON():{};
    calls.push({path,method,body});
    if(path.endsWith('/fleet'))return route.fulfill({json:{role:'owner',vehicles:[car],partners:[],activities:[],blocks:[],reservations:[],expenses:[]}});
    if(path.endsWith('/invoice-pdf'))return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'});
    if(path.endsWith('/invoices')){
      if(method==='GET')return route.fulfill({json:{invoices,role:'owner'}});
      if(method==='DELETE'){invoices=invoices.filter(item=>item.id!==url.searchParams.get('id'));await page.evaluate(rows=>{window.auditFinanceTables.invoices=rows},invoices);return route.fulfill({json:{deleted:true}});}
      if(body.action){const index=invoices.findIndex(item=>item.id===body.id);const original=invoices[index];const updated={...original,...(body.action==='record_payment'?{amount_paid:Number(original.amount_paid||0)+Number(body.amount),status:'partially_paid'}:body.action==='release_hold'?{deposit_hold_status:'released'}:body.action==='void'?{status:'void'}:{})};invoices[index]=updated;
        await page.evaluate(({rows,body})=>{
          window.auditFinanceTables.invoices=rows;
          if(body.action==='record_payment')window.auditFinanceTables.invoice_payments.push({id:'payment-1',invoice_id:body.id,amount:body.amount,paid_at:body.payment_date+'T12:00:00Z',method:body.payment_method});
        },{rows:invoices,body});
        return route.fulfill({json:{invoice:updated}});}
      const row={invoice_number:'AUDIT-001',status:'draft',amount_paid:0,total:Number(body.daily_rate||0)*Number(body.rental_days||1),subtotal:Number(body.daily_rate||0)*Number(body.rental_days||1),...body,id:body.id||'00000000-0000-4000-8000-000000000001'};invoices=[row];await page.evaluate(rows=>{window.auditFinanceTables.invoices=rows},invoices);return route.fulfill({json:{invoice:row}});
    }
    if(path.endsWith('/agreement-settings')){
      if(method==='PUT'){template={...template,...body,version:template.version+1};return route.fulfill({json:{template}});}
      return route.fulfill({json:{template}});
    }
    return route.fulfill({json:{agreements:[],quotes:[],cars:[],vehicles:[],customers:[],partners:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],template}});
  });
  await page.goto(crmBase+'/admin/');await page.locator('[data-admin-view]').waitFor();
  await openCrmPage(page,"vehicles");
  await page.locator('[data-fleet-feature] [data-fleet-statement]').waitFor();
  await openCrmPage(page,"invoices");
  await page.locator('[data-new-invoice]').click();
  const form=page.locator('[data-invoice-form]');
  assert(await form.isVisible());
  await form.locator('[name="customer_name"]').fill('Audit Customer');
  await form.locator('[name="vehicle_name"]').fill('Audit Vehicle');
  await form.locator('[name="rental_start"]').fill('2026-10-20');
  await form.locator('[name="rental_end"]').fill('2026-10-22');
  await form.locator('[name="daily_rate"]').fill('500');
  assert.equal(await form.locator('[name="rental_days"]').inputValue(),'2');
  assert.match(await page.locator('[data-invoice-total]').textContent(),/1,000/);
  await form.locator('[data-save-invoice]').click();
  await page.getByText('Invoice saved.',{exact:false}).waitFor();
  assert.equal(invoices.length,1);
  assert.equal(invoices[0].customer_name,'Audit Customer');
  assert.equal(invoices[0].rental_days,2);
  await page.locator('[data-close-invoice-editor]').click();
  await page.locator('[data-invoice-search]').fill('no-match');assert.equal(await page.locator('[data-select-invoice]').count(),0);
  await page.locator('[data-invoice-search]').fill('AUDIT');assert.equal(await page.locator('[data-select-invoice]').count(),1);
  await page.locator('[data-edit-invoice]').click();
  const beforePdf=await page.evaluate(()=>window.auditFinanceChanges);
  const download=page.waitForEvent('download');await form.locator('[data-download-invoice]').click();await download;
  assert.equal(await page.evaluate(()=>window.auditFinanceChanges),beforePdf,"Downloading the saved invoice must reuse the cached ledger.");
  await form.locator('[data-record-payment]').click();
  await page.locator('.invoice-payment [name=amount]').fill('300');
  await page.locator('.invoice-payment button[type=submit]').click();
  await page.getByText('Payment recorded.',{exact:false}).waitFor();
  assert(calls.some(call=>call.body?.action==='record_payment'&&call.body.amount===300));
  await page.waitForFunction(()=>document.querySelector('#rv-total')?.textContent==='$300' &&
    document.querySelector('[data-owned-retained]')?.textContent==='$300' &&
    document.querySelector('[data-fleet-feature]')?.textContent.includes('$300'));
  assert.equal(await page.evaluate(()=>window.auditFinanceChanges),beforePdf+1,"A saved payment must invalidate financial views once.");
  await form.locator('[data-void-invoice]').click();
  await page.getByText('Invoice voided.',{exact:false}).waitFor();
  await page.locator('[data-close-invoice-editor]').click();
  await page.locator('[data-new-invoice]').click();
  await form.locator('[name="customer_name"]').fill('Second Audit Customer');
  await form.locator('[name="vehicle_name"]').fill('Second Audit Vehicle');
  await form.locator('[name="deposit_method"]').selectOption('authorization_hold');
  await form.locator('[name="refundable_deposit"]').fill('500');
  await form.locator('[data-save-invoice]').click();
  await page.getByText('Invoice saved.',{exact:false}).waitFor();
  await form.locator('[data-release-hold]').click();
  await page.getByText('Deposit hold marked released.',{exact:false}).waitFor();
  await form.locator('[data-continue-agreement]').click();
  await page.locator('[data-section-panel="agreements"].active').waitFor();
  await page.locator("[data-agreement-editor][open]").waitFor();
  assert.equal(await page.locator('[data-agreement-form] [name=customer_name]').inputValue(),'Second Audit Customer');
  await page.locator("[data-close-agreement-editor]").click();
  await openCrmPage(page,"invoices");
  await page.locator("[data-edit-invoice]").click();
  await form.locator('[data-delete-invoice]').click();
  await page.getByText('was deleted.',{exact:false}).waitFor();
  assert.equal(invoices.length,0);
  await openCrmPage(page,"settings");
  await page.waitForFunction(() => document.querySelector('[data-agreement-template-form] [name="title"]')?.value === 'Audit terms');
  await page.locator('[data-agreement-template-form] [name="title"]').fill('Updated audit terms');
  await page.locator('[data-agreement-template-form] button[type="submit"]').click();
  await page.getByText('Template version 2 saved.',{exact:false}).waitFor();
  assert.equal(template.title,'Updated audit terms',JSON.stringify(calls.filter(call=>call.path.endsWith('/agreement-settings'))));
  assert(calls.some(call=>call.path.endsWith('/invoices')&&call.method==='POST'));
  assert(calls.some(call=>call.path.endsWith('/agreement-settings')&&call.method==='PUT'));
  assert.deepEqual(errors,[]);
  console.log('PASS: invoice create/search/totals/PDF/payment/void/hold/agreement/delete and template save (mocked).');
} finally { await browser.close(); }
