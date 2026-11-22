import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures={admin_profiles:[{role:'owner',display_name:'Preview'}],rental_agreements:[{id:'preview-agreement',customer_name:'Preview Customer With A Long Name',vehicle_name:'Lamborghini Huracán EVO Spyder',status:'signed',signed_at:'2026-10-01',rental_start:'2026-10-20',rental_end:'2026-10-22',deposit_status:'pending',refundable_deposit:1000}],rental_agreement_events:['signed','opened','created'].map((event_type,i)=>({id:`event-${i}`,agreement_id:'preview-agreement',event_type,detail:'Agreement updated by the preview customer.',created_at:'2026-10-12T12:00:00Z'}))};
fixtures.cars=[{id:'owned-car',name:'Ferrari Roma',ownership_type:'prestige',image_url:'/assets/partner-fleet/ferrari-roma/01.png',is_active:true}];
fixtures.vehicle_expenses=[{id:'expense',car_id:'owned-car',category:'insurance',amount:250,expense_date:'2026-11-01'}];
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;

try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.route('**/api/**',r=>r.fulfill({json:{vehicles:[],quotes:[],customers:[],settings:{},template:{title:'Preview',body:'',important_terms:[]}}}));
 await page.goto('http://127.0.0.1:8775/admin/');
 await page.locator('.owned-car').waitFor();
 assert.equal(await page.locator('.owned-car h4').textContent(),'Ferrari Roma');
 await page.locator('.owned-fleet').screenshot({path:'output/owned-fleet/dashboard-integration.png'});
 await page.setViewportSize({width:390,height:1000});
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 assert.deepEqual(errors,[]);
 await page.close();
 const staff=await browser.newPage();
 await staff.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock.replace('role:"owner"','role:"staff"').replace('"role":"owner"','"role":"staff"')}));
 await staff.route('**/api/**',r=>r.fulfill({json:{vehicles:[],quotes:[],settings:{}}}));
 await staff.goto('http://127.0.0.1:8775/admin/');
 await staff.locator('.executive-operations').waitFor();
 assert.equal(await staff.locator('.owned-fleet').count(),0);
 console.log('PASS: owned performance integrated, responsive, and hidden for staff.');
} finally {await browser.close();}
