import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures=populated?{admin_profiles:[{role:'owner',display_name:'Preview'}],invoices:[{id:'preview-invoice',invoice_number:'PREVIEW-001',customer_name:'Test Customer',vehicle_name:'Test Vehicle',status:'draft',rental_total:1200,total:1200,created_at:new Date().toISOString(),line_items:[]}]}:{admin_profiles:[{role:'owner',display_name:'Preview'}]};
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;

const agreement={id:'preview',agreement_number:'PL-001',customer_name:'Preview Customer',vehicle_name:'Rolls-Royce Cullinan',status:process.env.SIGNED_PREVIEW?'signed':'draft',signed_pdf_path:process.env.SIGNED_PREVIEW?'preview.pdf':null,quote_total:1500};
try{for(const width of [320,390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.route('**/api/**',r=>r.fulfill({json:{agreements:[agreement],agreement,events:[],role:'owner',cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],settings:{},template:{title:'Preview',body:'Preview',important_terms:[]},data:[]}}));
 await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();
 if(width<760)await page.locator('[data-workspace-menu]').click();await page.locator('[data-crm-section="agreements"]').click();
 await page.locator('[data-select-agreement]').waitFor();await page.locator('[data-agreement-search]').fill('not found');assert.equal(await page.locator('[data-select-agreement]').count(),0);await page.locator('[data-agreement-search]').fill('Preview');await page.locator('[data-select-agreement]').click();await page.locator('[data-agreement-form]:not([hidden])').waitFor();
 assert.equal(await page.locator('[data-select-agreement]').getAttribute('aria-pressed'),'true');
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.locator('[data-agreement-audit] summary').click();assert(await page.locator('[data-agreement-audit]').evaluate(e=>e.open));assert.equal(await page.locator('[data-agreement-link-card]').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(244, 246, 239)');
 await page.screenshot({path:`output/admin-workspace/${width}-agreements-refined.png`,fullPage:true});
 await page.locator('[data-new-agreement]').click();assert(await page.locator('[data-agreement-form]').isVisible());assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));assert.deepEqual(errors,[]);console.log(`${width}: agreement search, selection and editor passed`);await page.close();
}}finally{await browser.close()}
