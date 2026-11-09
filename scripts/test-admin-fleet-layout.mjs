import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures=populated?{admin_profiles:[{role:'owner',display_name:'Preview'}],invoices:[{id:'preview-invoice',invoice_number:'PREVIEW-001',customer_name:'Test Customer',vehicle_name:'Test Vehicle',status:'draft',rental_total:1200,total:1200,created_at:new Date().toISOString(),line_items:[]}]}:{admin_profiles:[{role:'owner',display_name:'Preview'}]};
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;

const {fleet}=await import('../src/fleet-data.js');
const vehicles=fleet.slice(0,6).map((car,i)=>({...car,category_label:car.categoryLabel||car.category,is_active:true,ownership_type:i%2?'partner':'prestige',current_mileage:1200+i*100,photos:[],image_url:car.image,partner:null,agreements:[],blocks:[],expenses:[],maintenance:[],documents:[],metrics:{status:'available',revenue:0,gross_profit:0,next_reservation:null}}));
try {for(const width of [320,390,768,1440]) {
 const page=await browser.newPage({viewport:{width,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.route('**/api/**',r=>r.fulfill({json:{vehicles,role:'owner',period:{key:'month'}}}));
 await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();
 if(width<761)await page.locator('[data-workspace-menu]').click();await page.locator('[data-crm-section="vehicles"]').click();await page.waitForTimeout(500);
 assert.equal(await page.locator('.fleet-vehicle-card').count(),6);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.screenshot({path:`output/admin-workspace/${width}-fleet-refined.png`,fullPage:true});
 await page.locator('[data-fleet-ownership="partner"]').click();assert.equal(await page.locator('.fleet-vehicle-card').count(),3);assert.equal(await page.locator('[data-fleet-ownership="partner"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-fleet-ownership="all"]').click();await page.locator('[data-fleet-search]').fill('zz-no-match');await page.waitForTimeout(350);assert.equal(await page.locator('.fleet-vehicle-card').count(),0);
 await page.locator('[data-fleet-search]').fill('');await page.waitForTimeout(350);await page.locator('[data-fleet-view="list"]').click();assert.equal(await page.locator('.fleet-table tbody tr').count(),6);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.locator('[data-fleet-view="calendar"]').click();assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));assert.deepEqual(errors,[]);console.log(`${width}: grid, ownership, search, list and calendar passed`);await page.close();
}}finally{await browser.close()}
