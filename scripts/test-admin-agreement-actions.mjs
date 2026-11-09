import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true});
const mock=`export function createClient(){const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],invoices:[],quotes:[],cars:[],car_photos:[],rental_agreements:[],booking_sales:[]};const session={user:{id:'audit',email:'audit@example.test'},access_token:'mock'};const query=table=>{let single=false,proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return(...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
const calls=[];let agreement=null;
try{
  const page=await browser.newPage({viewport:{width:1440,height:950},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?'DELETE':undefined));
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',route=>{
    const request=route.request(),url=new URL(request.url()),body=['POST','PATCH','PUT'].includes(request.method())?request.postDataJSON():{};calls.push({path:url.pathname,method:request.method(),body});
    if(url.pathname.endsWith('/agreement-pdf'))return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'});
    if(url.pathname.endsWith('/agreement-settings'))return route.fulfill({json:{template:{title:'Audit terms',body:'Audit only',important_terms:[],version:1}}});
    if(url.pathname.endsWith('/agreements')){
      if(request.method()==='GET')return route.fulfill({json:url.searchParams.has('id')?{agreement,events:[],public_url:'https://example.test/sign/audit'}:{agreements:agreement?[agreement]:[],role:'owner'}});
      if(request.method()==='DELETE'){agreement=null;return route.fulfill({json:{deleted:true}});}
      if(body.action==='send')return route.fulfill({json:{agreement,public_url:'https://example.test/sign/audit',delivery:{delivered:true}}});
      agreement={id:'00000000-0000-4000-8000-000000000001',agreement_number:'AUDIT-001',status:'draft',...body};
      return route.fulfill({json:{agreement,public_url:'https://example.test/sign/audit'}});
    }
    return route.fulfill({json:{invoices:[],quotes:[],cars:[],vehicles:[],customers:[],partners:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[]}});
  });
  await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();
  await page.locator('[data-crm-section="agreements"]').click();await page.locator('[data-new-agreement]').click();
  const form=page.locator('[data-agreement-form]');
  await form.locator('[name="customer_name"]').fill('Audit Customer');
  await form.locator('[data-open-agreement-vehicle-picker]').click();
  await page.locator('[data-agreement-vehicle-dialog][open]').waitFor();
  await page.locator('[data-agreement-manual-vehicle]').fill('Audit Roadster');
  await page.locator('[data-use-manual-agreement-vehicle]').click();
  assert.equal(await form.locator('[name="vehicle_name"]').inputValue(),'Audit Roadster');
  await form.locator('[name="rental_start_at"]').fill('2026-10-20T12:00');
  await form.locator('[name="rental_end_at"]').fill('2026-10-22T12:00');
  await form.locator('[name="quote_total"]').fill('1200');
  await form.locator('[data-save-agreement]').click();
  await page.getByText('Agreement saved.',{exact:false}).waitFor();
  assert.equal(agreement.vehicle_name,'Audit Roadster');
  await page.locator('[data-copy-agreement-link]').click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://example.test/sign/audit');
  await page.locator('[data-resend-agreement]').click();
  await page.getByText('Agreement emailed', {exact:false}).waitFor();
  assert(calls.some(call=>call.body?.action==='send'));
  agreement={...agreement,status:'signed',signed_pdf_path:'audit-signed.pdf'};
  await page.locator('[data-select-agreement]').click();
  await page.locator('[data-download-agreement]').getByText('Download signed PDF').waitFor();
  const download=page.waitForEvent('download');await page.locator('[data-download-agreement]').click();await download;
  await page.locator('[data-delete-agreement]').click();
  await page.getByText('AUDIT-001 deleted.',{exact:false}).waitFor();
  assert.equal(agreement,null);
  assert.deepEqual(errors,[]);
  console.log('PASS: agreement manual vehicle, save, copy, send, signed PDF request, and signed delete (mocked).');
}finally{await browser.close();}
