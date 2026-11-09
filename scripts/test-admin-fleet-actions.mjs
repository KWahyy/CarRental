import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fleet } from '../src/fleet-data.js';

const browser=await chromium.launch({channel:'chrome',headless:true});
const initial={...fleet[0],id:'audit-existing',category_label:fleet[0].categoryLabel||fleet[0].category,is_active:true,ownership_type:'prestige',photos:[],agreements:[],blocks:[],expenses:[],maintenance:[],documents:[],metrics:{status:'available',revenue:0,gross_profit:0,next_reservation:null}};
const vehicles=[initial];
const calls=[];
let failPhotos=true;
const mock=`export function createClient(){const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],invoices:[],rental_agreements:[],booking_sales:[],cars:[]};const session={user:{id:'audit',email:'audit@example.test'},access_token:'mock'};const query=table=>{let single=false,proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return(...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
try{
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',route=>{
    const request=route.request(),url=new URL(request.url()),body=request.method()==='GET'?{}:request.postDataJSON();
    if(!url.pathname.endsWith('/fleet'))return route.fulfill({json:{invoices:[],quotes:[],agreements:[],template:{title:'Audit',body:'Audit',important_terms:[]}}});
    calls.push({method:request.method(),body});
    if(body.action==='photos'&&failPhotos){failPhotos=false;return route.fulfill({status:500,json:{error:'Audit photo service unavailable'}});}
    if(body.action==='archive'){const vehicle=vehicles.find(item=>item.id===body.car_id);if(vehicle)vehicle.is_active=false;return route.fulfill({json:{archived:true}});}
    if(body.action==='vehicle'){
      const vehicle={...initial,...body,id:body.id||'audit-created',name:`${body.make} ${body.model}`,photos:[],agreements:[],blocks:[],expenses:[],maintenance:[],documents:[],metrics:initial.metrics};
      const index=vehicles.findIndex(item=>item.id===vehicle.id);if(index>=0)vehicles[index]=vehicle;else vehicles.push(vehicle);
      return route.fulfill({json:{vehicle}});
    }
    if(url.searchParams.has('id'))return route.fulfill({json:{vehicle:vehicles.find(item=>item.id===url.searchParams.get('id')),activity:[],mileage:[]}});
    return route.fulfill({json:{vehicles,role:'owner',period:{key:'month'}}});
  });
  await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();
  await page.locator('[data-crm-section="vehicles"]').click();await page.locator('.fleet-vehicle-card').waitFor();
  await page.locator('.fleet-vehicle-card').first().click();
  for(const tab of ['reservations','calendar','financials','maintenance','documents','activity','overview']){
    await page.locator(`[data-vehicle-tab="${tab}"]`).click();
    assert.match(await page.locator(`[data-vehicle-tab="${tab}"]`).getAttribute('class'),/active/);
  }
  await page.locator('[data-fleet-action="block"]').click();
  await page.locator('[data-fleet-action-dialog][open]').waitFor();
  await page.locator('[data-fleet-action-form] [name="reason"]').fill('Audit hold');
  await page.locator('[data-fleet-action-form] button[type="submit"]').click();
  await page.locator('[data-fleet-action-dialog][open]').waitFor({state:'hidden'});
  assert(calls.some(call=>call.body?.action==='block'));
  await page.locator('[data-fleet-action="expense"]').click();
  await page.locator('[data-fleet-action-dialog][open]').waitFor();
  await page.locator('[data-fleet-action-form] [name="amount"]').fill('75');
  await page.locator('[data-fleet-action-form] button[type="submit"]').click();
  await page.locator('[data-fleet-action-dialog][open]').waitFor({state:'hidden'});
  assert(calls.some(call=>call.body?.action==='expense'));
  await page.locator('[data-fleet-action="maintenance"]').click();
  await page.locator('[data-fleet-action-dialog][open]').waitFor();
  await page.locator('[data-fleet-action-form] button[type="submit"]').click();
  await page.locator('[data-fleet-action-dialog][open]').waitFor({state:'hidden'});
  assert(calls.some(call=>call.body?.action==='maintenance'));
  await page.locator('[data-vehicle-tab="documents"]').click();
  await page.locator('[data-fleet-action="document"]').click();
  await page.locator('[data-fleet-action-dialog][open]').waitFor();
  assert(await page.locator('[data-fleet-action-form] [name="document_file"]').evaluate(input=>input.required&&input.validity.valueMissing));
  await page.locator('[data-fleet-action-form] button[type="submit"]').click();
  assert(await page.locator('[data-fleet-action-dialog]').evaluate(dialog=>dialog.open));
  assert(!calls.some(call=>call.body?.action==='document'));
  await page.locator('[data-close-fleet-action]').last().click();
  await page.locator('[data-fleet-add]').click();
  const form=page.locator('[data-fleet-vehicle-form]');
  await form.locator('[name="name"]').fill('Audit Roadster');
  await form.locator('[name="make"]').fill('Audit');
  await form.locator('[name="model"]').fill('Roadster');
  await form.getByRole('button',{name:'Save Vehicle'}).click();
  await page.getByText('Audit photo service unavailable').waitFor();
  assert.equal(await form.getAttribute('data-vehicle-id'),'audit-created');
  await form.getByRole('button',{name:'Save Vehicle'}).click();
  await page.locator('[data-fleet-vehicle-dialog][open]').waitFor({state:'hidden'});
  assert.equal(calls.filter(call=>call.body.action==='vehicle'&&call.method==='POST').length,1);
  assert.equal(calls.filter(call=>call.body.action==='vehicle'&&call.method==='PATCH').length,1);
  await page.locator('[data-fleet-action="archive"]').click();
  assert(calls.some(call=>call.body?.action==='archive'));
  assert.deepEqual(errors,[]);
  console.log('PASS: fleet tabs, block/expense/maintenance/archive, document validation, and duplicate-safe retry (mocked).');
}finally{await browser.close();}
