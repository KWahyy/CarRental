import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures=populated?{admin_profiles:[{role:'owner',display_name:'Preview'}],invoices:[{id:'preview-invoice',invoice_number:'PREVIEW-001',customer_name:'Test Customer',vehicle_name:'Test Vehicle',status:'draft',rental_total:1200,total:1200,created_at:new Date().toISOString(),line_items:[]}]}:{admin_profiles:[{role:'owner',display_name:'Preview'}]};
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;

const quotes=['draft','sent'].map((status,i)=>({id:'test-'+i,quote_number:'TEST-00'+i,customer_first_name:'Preview',customer_last_name:'Customer',customer_name:'Preview Customer',customer_phone:'555-0100',vehicle_name:'Test Vehicle '+i,status,rental_total:1200,amount_required:300,created_at:'2026-10-13T12:00:00Z',start_at:'2026-10-20T12:00:00Z',end_at:'2026-10-22T12:00:00Z',expires_at:'2026-10-19T12:00:00Z',line_items:[],internal_costs:[]}));
try {for(const width of [320,390,768,1440]) {
 const page=await browser.newPage({viewport:{width,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.route('**/api/**',r=>{const id=new URL(r.request().url()).searchParams.get('id');return r.fulfill({json:id?{quote:quotes.find(q=>q.id===id),events:[],revisions:[]}:{quotes,cars:[],customers:[],leads:[],employees:[],partners:[],reservations:[],blocks:[]}})});
 await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();if(width<761)await page.locator('[data-workspace-menu]').click();await page.locator('[data-crm-section="requests"]').click();await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-open-quote]').count(),2);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:`output/admin-workspace/${width}-quotes-refined.png`,fullPage:true});
 await page.locator('[data-quote-search]').pressSequentially('zznomatch');assert.equal(await page.locator('[data-quote-search]').inputValue(),'zznomatch');assert(await page.locator('[data-quote-search]').evaluate(e=>e===document.activeElement));await page.locator('[data-clear-quote-filters]').click();assert.equal(await page.locator('[data-open-quote]').count(),2);
 await page.locator('[data-quote-scope="accepted"]').click();assert.equal(await page.locator('[data-quote-scope="accepted"]').getAttribute('aria-pressed'),'true');await page.locator('[data-clear-quote-filters]').click();
 await page.locator('[data-open-quote-button]').first().click();await page.waitForTimeout(250);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:`output/admin-workspace/${width}-quote-detail-refined.png`,fullPage:true});await page.locator('[data-back-quotes]').click();
 await page.locator('[data-new-quote]').click();await page.locator('[data-quote-builder-dialog][open]').waitFor();assert(!await page.locator('[data-quote-builder-dialog]').evaluate(e=>e.scrollWidth>e.clientWidth+1));await page.screenshot({path:`output/admin-workspace/${width}-quote-builder-refined.png`});
 for(const step of [1,2,3,0]) {await page.locator(`[data-builder-step-button="${step}"]`).click();assert(!await page.locator('[data-quote-builder-dialog]').evaluate(e=>e.scrollWidth>e.clientWidth+1));}
 assert.equal(await page.locator('.quote-summary-lines strong').first().evaluate(e=>getComputedStyle(e).color),'rgb(41, 46, 36)');
 await page.keyboard.press('Escape');assert.deepEqual(errors,[]);console.log(`${width}: quote list, continuous search, clear filters, detail and builder passed`);await page.close();
}} finally {await browser.close();}
