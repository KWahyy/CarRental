import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const populated=process.env.ADMIN_POPULATED==='1';
const fixtures=populated?{admin_profiles:[{role:'owner',display_name:'Preview'}],invoices:[{id:'preview-invoice',invoice_number:'PREVIEW-001',customer_name:'Test Customer',vehicle_name:'Test Vehicle',status:'draft',rental_total:1200,total:1200,created_at:new Date().toISOString(),line_items:[]}]}:{admin_profiles:[{role:'owner',display_name:'Preview'}]};
const mock=`export function createClient(){ const fixtures=${JSON.stringify(fixtures)}; const session={user:{id:'test-user',email:'preview@example.test'},access_token:'mock'}; const query=(table)=>{let single=false;let proxy;proxy=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(fixtures[table]?.[0]||null):(fixtures[table]||[]),error:null,count:0});return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return proxy;};}});return proxy;};return {from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}}`;

try {for(const width of [768,1440]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/supabase-js@2/+esm',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await page.route('**/api/**',r=>r.fulfill({json:{cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],data:[]}}));
 await page.goto('http://127.0.0.1:8775/admin/');await page.locator('[data-admin-view]').waitFor();await page.waitForTimeout(700);
 for(const scroll of [0,600,2000]) {
 await page.evaluate(y=>window.scrollTo(0,y),scroll);await page.waitForTimeout(100);
 const geometry=await page.evaluate(()=>{const side=document.querySelector('.admin-crm-sidebar').getBoundingClientRect(),top=document.querySelector('.admin-topbar').getBoundingClientRect();return {sideTop:side.top,sideBottom:side.bottom,headerTop:top.top,headerBottom:top.bottom,viewport:innerHeight,scroll:scrollY};});
 assert(Math.abs(geometry.headerTop)<1,JSON.stringify(geometry));assert(Math.abs(geometry.sideTop-geometry.headerBottom)<1,JSON.stringify(geometry));assert(Math.abs(geometry.sideBottom-geometry.viewport)<1,JSON.stringify(geometry));
 }
 await page.screenshot({path:`output/admin-workspace/${width}-sidebar-scrolled.png`});console.log(`${width}: header and sidebar stay pinned, sidebar fills viewport at all scroll positions`);await page.close();
}} finally {await browser.close();}
