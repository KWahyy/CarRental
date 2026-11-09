import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const fixtures={admin_profiles:[{role:'owner',display_name:'Audit'}],crm_customers:[],invoices:[],rental_agreements:[],quotes:[],booking_sales:[],cars:[]};
const mock=`export function createClient(){const fixtures=${JSON.stringify(fixtures)};const session={user:{id:'audit-user',email:'audit@example.test'},access_token:'mock'};const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
await page.route('**/api/**',route=>route.fulfill({json:{cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],settings:{},template:{title:'Audit template',body:'Audit only',important_terms:[]},data:[]}}));
await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();
const inventory={};
for(const section of ['overview','vehicles','requests','customers','invoices','agreements','bookings','settings']){
 await page.locator(`[data-crm-section="${section}"]`).click();await page.waitForTimeout(300);
 inventory[section]=await page.locator(`[data-section-panel="${section}"]`).evaluate(panel=>[...panel.querySelectorAll('button,a,summary,select,input[type="checkbox"]')].filter(element=>{const style=getComputedStyle(element);return element.getClientRects().length && style.visibility!=='hidden' && style.display!=='none';}).map(element=>({tag:element.tagName.toLowerCase(),text:(element.innerText||element.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,90),selector:[...element.attributes].filter(attribute=>attribute.name.startsWith('data-')).map(attribute=>`${attribute.name}=${attribute.value}`).join(' '),disabled:element.disabled||false})));
 console.log(section,inventory[section].length,inventory[section].map(item=>item.text).join(' | '));
}
mkdirSync('output/admin-audit',{recursive:true});writeFileSync('output/admin-audit/control-inventory.json',JSON.stringify({inventory,errors},null,2));
await browser.close();
