import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';

const browser=await chromium.launch({channel:'chrome',headless:true});
mkdirSync('output/admin-workspace',{recursive:true});
const fixture={
  admin_profiles:[{role:'owner',display_name:'Preview'}],
  crm_customers:[
    {id:'customer-one',first_name:'Preview',last_name:'Customer',email:'preview@example.test',phone:'5551234567',marketing_consent_status:'unknown',marketing_tags:[],notes:''},
    {id:'customer-two',first_name:'Second',last_name:'Customer',email:'second@example.test',phone:'5552345678',marketing_consent_status:'unsubscribed',marketing_tags:['SUV'],notes:''}
  ],
  rental_agreements:[{id:'agreement-one',customer_id:'customer-one',customer_name:'Preview Customer',vehicle_name:'Preview Vehicle',status:'signed',rental_total:1000,created_at:'2026-10-01T12:00:00Z'}]
};
const mock=`export function createClient(){
  const fixtures=${JSON.stringify(fixture)};
  const session={user:{id:'preview-user',email:'preview@example.test'},access_token:'mock'};
  function from(table){let single=false,op='',payload=null,id=null;let proxy;
    proxy=new Proxy({}, {get(_,key){
      if(key==='then')return resolve=>{let rows=fixtures[table]||[];
        if(op==='update'){const index=rows.findIndex(row=>row.id===id);if(index>=0){rows[index]={...rows[index],...payload};rows=[rows[index]];}else rows=[];}
        if(op==='insert'){const row={id:'new-customer',...payload};fixtures[table]=[...rows,row];rows=[row];}
        resolve({data:single?(rows[0]||null):rows,error:null,count:rows.length});};
      return (...args)=>{if(key==='update'||key==='insert'){op=key;payload=args[0];}if(key==='eq'&&args[0]==='id')id=args[1];if(key==='single'||key==='maybeSingle')single=true;return proxy;};
    }});return proxy;
  }
  return {from,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};
}`;
try {
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:950}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
    await page.route('**/api/**',route=>route.fulfill({json:{cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],settings:{},template:{title:'Preview',body:'Preview',important_terms:[]},data:[]}}));
    await page.goto('http://127.0.0.1:8775/admin/');
    await page.locator('[data-admin-view]').waitFor();
    if(width<760)await page.locator('[data-workspace-menu]').click();
    await page.locator('[data-crm-section="customers"]').click();
    await page.locator('[data-customer-marketing-form]').waitFor();
    assert.equal(await page.locator('.customer-marketing-overview strong').textContent(),'0 contacts opted in');
    assert.equal(await page.locator('[data-customer-key]').count(),2);
    await page.locator('[data-customer-search]').fill('Second');
    assert.equal(await page.locator('[data-customer-key]').count(),1);
    await page.locator('[data-customer-search]').fill('');
    await page.locator('[data-customer-view="renters"]').click();
    assert.equal(await page.locator('[data-customer-key]').count(),1);
    await page.locator('[data-customer-view="all"]').click();
    await page.locator('[data-customer-notes-form] [name="notes"]').fill('Audit preference');
    await page.locator('[data-customer-notes-form] button[type="submit"]').click();
    await page.locator('[data-refresh-customers]').click();
    await page.waitForFunction(() => document.querySelector('[data-customer-notes-form] [name="notes"]')?.value === 'Audit preference');
    await page.screenshot({path:`output/admin-workspace/${width}-customers-marketing.png`,fullPage:true});
    await page.locator('[data-marketing-status]').selectOption('subscribed');
    await page.locator('[data-customer-marketing-form] button[type="submit"]').click();
    assert.match(await page.locator('[data-customer-marketing-message]').textContent(),/Record how/);
    await page.locator('[name="marketing_source"]').fill('Preview website checkbox');
    await page.locator('[name="marketing_tags"]').fill('convertibles, weddings');
    await page.locator('[data-customer-marketing-form] button[type="submit"]').click();
    await page.locator('.customer-marketing-overview strong').getByText('1 contact opted in').waitFor();
    await page.locator('[data-customer-email-ready]').click();
    assert.equal(await page.locator('[data-customer-key]').count(),1);
    assert.equal(await page.locator('[data-customer-key]').first().getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[name="marketing_source"]').inputValue(),'Preview website checkbox');
    await page.locator('[name="marketing_email"]').fill('new-address@example.test');
    await page.locator('[data-customer-marketing-form] button[type="submit"]').click();
    assert.match(await page.locator('[data-customer-marketing-message]').textContent(),/Not recorded/);
    await page.locator('[name="marketing_email"]').fill('preview@example.test');
    await page.locator('[data-marketing-status]').selectOption('unsubscribed');
    await page.locator('[data-customer-marketing-form] button[type="submit"]').click();
    await page.locator('.customer-marketing-overview strong').getByText('0 contacts opted in').waitFor();
    assert.equal(await page.locator('[data-customer-key]').count(),0);
    await page.locator('[data-customer-view="all"]').click();
    await page.locator('[data-customer-key="customer:customer-one"]').click();
    await page.locator('[data-marketing-status]').selectOption('unknown');
    await page.locator('[data-customer-marketing-form] button[type="submit"]').click();
    assert.match(await page.locator('[data-customer-marketing-message]').textContent(),/Keep this contact opted out/);
    assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
    assert.deepEqual(errors,[]);
    console.log(`${width}: consent capture, eligibility, opt-out and layout passed`);
    await page.close();
  }
}finally{await browser.close();}
