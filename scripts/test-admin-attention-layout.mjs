import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const screenshotDir=process.env.CRM_SCREENSHOT_DIR||'output/admin-workspace';
mkdirSync(screenshotDir,{recursive:true});
const fixtures={admin_profiles:[{role:'owner',display_name:'Preview'}],rental_agreements:[{id:'preview-agreement',customer_name:'Preview Customer With A Long Name',vehicle_name:'Lamborghini Huracán EVO Spyder',status:'signed',signed_at:'2026-10-01',rental_start:'2026-10-20',rental_end:'2026-10-22',deposit_status:'pending',refundable_deposit:1000}],rental_agreement_events:['signed','opened','created'].map((event_type,i)=>({id:`event-${i}`,agreement_id:'preview-agreement',event_type,detail:'Agreement updated by the preview customer.',created_at:'2026-10-12T12:00:00Z'}))};
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;

try {for(const width of [320,390,768,1440]) {
const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
await page.route('**/api/**',r=>r.fulfill({json:{cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],settings:{},data:[]}}));
await page.goto((process.env.CRM_PREVIEW_URL||'http://127.0.0.1:8775')+'/admin/');
await page.locator('[data-desk-tab="attention"]').click();
await page.locator('.attention-list>button').first().waitFor();
assert.equal(await page.locator('.attention-list>button').count(),1);
assert.equal(await page.locator('.attention-issues > span').count(),3);
assert.equal(await page.locator('.desk-log,.activity-list').count(),0);
await page.getByRole('heading',{name:'Sales follow-ups',exact:true}).waitFor();
await page.getByRole('heading',{name:'Most requested vehicles',exact:true}).waitFor();
assert.equal(await page.locator('.attention-count').textContent(),'1');
assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
assert(parseFloat(await page.locator('.attention-list strong').first().evaluate(e=>getComputedStyle(e).fontSize))>=13);
await page.locator('[data-desk-panel="attention"]').screenshot({path:`${screenshotDir}/${width}-attention-refined.png`});
assert.deepEqual(errors,[]);console.log(`${width}: grouped attention and new desk panels passed`);await page.close();
}}finally{await browser.close()}
