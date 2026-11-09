import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures=populated?{admin_profiles:[{role:'owner',display_name:'Preview'}],invoices:[{id:'preview-invoice',invoice_number:'PREVIEW-001',customer_name:'Test Customer',vehicle_name:'Test Vehicle',status:'draft',rental_total:1200,total:1200,created_at:new Date().toISOString(),line_items:[]}]}:{admin_profiles:[{role:'owner',display_name:'Preview'}]};
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const requests=[]; const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.route('**/api/**',async r=>{
   requests.push(new URL(r.request().url()).pathname);
   await new Promise(resolve=>setTimeout(resolve,100));
   await r.fulfill({json:{cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],settings:{},template:{title:'Preview',body:'Preview',important_terms:[]},data:[]}});
 });
 await page.goto('http://127.0.0.1:8775/admin/');
 await page.locator('[data-admin-view]').waitFor();
 await page.waitForTimeout(4000);
 const panels=['overview','vehicles','requests','customers','invoices','agreements','bookings'];
 for(const section of panels) {await page.locator(`[data-crm-section="${section}"]`).click();await page.waitForTimeout(200);}
 const before=requests.length;
 // Keep actual DOM nodes: switching sections must not replace loaded views.
 await page.evaluate(()=>{window.savedPanels=[...document.querySelectorAll('[data-section-panel]')].map(e=>[e,e.firstElementChild]);});
 for(let pass=0;pass<2;pass++) for(const section of panels) {
   await page.locator(`[data-crm-section="${section}"]`).click();
   assert.equal(await page.locator(`[data-section-panel="${section}"]`).evaluate(e=>e.textContent.includes("Loading ")),false,section);
 }
 assert.equal(requests.length,before,"Cached navigation made new API requests");
 assert(await page.evaluate(()=>window.savedPanels.every(([panel,node])=>panel.firstElementChild===node)),"Cached navigation rebuilt panel");
 assert.deepEqual(errors,[]);
 console.log("PASS: 14 cached switches, zero additional API requests, stable panel nodes, no loading screens.");
} finally {await browser.close();}
