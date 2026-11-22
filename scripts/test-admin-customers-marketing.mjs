import { crmBase, openCrmPage } from "./crm-browser-helpers.mjs";
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
  invoices:[{id:'invoice-one',invoice_number:'PL-I-21',customer_id:'customer-one',customer_name:'Preview Customer',vehicle_name:'Preview Vehicle',status:'draft',total:200,created_at:'2026-09-05T12:00:00Z'}],
  rental_agreements:[{id:'agreement-one',agreement_number:'PL-A-21',customer_id:'customer-one',customer_name:'Preview Customer',vehicle_name:'Preview Vehicle',status:'signed',rental_total:1000,created_at:'2026-10-01T12:00:00Z'}]
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
    const apiReads = [];
    const delayed = new Map();
    function hold(path) {
      let unblock;
      delayed.set(path, new Promise(resolve => {unblock=resolve;}));
      return () => {delayed.delete(path); unblock();};
    }
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      apiReads.push(url.pathname + url.search);
      if (delayed.has(url.pathname)) await delayed.get(url.pathname);
      const result = {cars:[],vehicles:[],partners:[],quotes:[],customers:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],settings:{},template:{title:'Preview',body:'Preview',important_terms:[]},data:[]};
      if (url.pathname === '/api/invoices') Object.assign(result, {invoices:fixture.invoices,invoice:{...fixture.invoices[0],notes:'Fresh invoice detail'},role:'owner'});
      if (url.pathname === '/api/agreements') Object.assign(result, {agreements:fixture.rental_agreements,agreement:fixture.rental_agreements[0],events:[],public_url:'https://example.test/test-only',role:'owner'});
      await route.fulfill({json:result});
    });
    await page.goto(crmBase+'/admin/');
    await page.locator('[data-admin-view]').waitFor();

    await openCrmPage(page,"customers");
    await page.locator('[data-customer-marketing-form]').waitFor();
    assert.equal(await page.locator('.customer-marketing-overview strong').textContent(),'0 contacts opted in');
    assert.equal(await page.locator('[data-customer-key]').count(),2);
    const directorySearch = page.locator('[data-customer-search]');
    const notes = page.locator('[data-customer-notes-form] [name="notes"]');
    const source = page.locator('[name="marketing_source"]');
    await notes.fill('Unsent notes'); await source.fill('Unsent source');
    const profileNode = await page.locator('.customer-profile').elementHandle();
    const inputNode = await directorySearch.elementHandle();
    await directorySearch.fill('Preview');
    assert(await directorySearch.evaluate((input, original) => input === original && input === document.activeElement, inputNode));
    assert(await page.locator('.customer-profile').evaluate((profile, original) => profile === original, profileNode));
    await directorySearch.fill('Second');
    assert.equal(await notes.inputValue(),'');
    await directorySearch.fill('no matching client');
    assert.equal(await page.locator('[data-customer-key]').count(),0);
    await directorySearch.fill('Preview');
    assert.equal(await notes.inputValue(),'Unsent notes');
    assert.equal(await source.inputValue(),'Unsent source');
    await notes.fill(''); await source.fill('');

    // Hold the target endpoint so the cached customer record must paint first.
    const link = type => page.locator(`.customer-record-row[data-customer-record="${type}"]`);
    const releaseInvoice = hold('/api/invoices');
    await link('invoice').click();
    await page.locator('.bl-folio h3').getByText('PL-I-21').waitFor({timeout:5000});
    releaseInvoice();
    await page.getByText('Fresh invoice detail').waitFor();
    const listReads = apiReads.filter(path => path === '/api/invoices').length;
    await openCrmPage(page,'customers'); await link('invoice').click();
    await page.waitForFunction(() => document.querySelector('.bl-folio h3')?.textContent === 'PL-I-21');
    assert.equal(apiReads.filter(path => path === '/api/invoices').length,listReads);
    await openCrmPage(page,'customers');
    const releaseAgreement = hold('/api/agreements');
    await link('agreement').click();
    await page.locator('[data-agreement-editor][open] [data-agreement-title]').getByText('PL-A-21').waitFor({timeout:5000});
    const detailRead = page.waitForResponse(response => response.url().includes('/api/agreements?id=agreement-one'));
    await page.locator('[data-close-agreement-editor]').click();
    releaseAgreement(); await detailRead;
    assert.equal(await page.locator('[data-agreement-editor][open]').count(),0);
    assert.equal(apiReads.filter(path => path === '/api/agreement-settings').length,0);
    await openCrmPage(page,'customers');
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
    await page.locator('.directory-totals summary').click();
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
    await page.locator('[data-new-customer]').click();
    const createForm=page.locator('[data-customer-create-dialog]');
    await createForm.getByLabel('First name').fill('Alex');
    await createForm.getByRole('button',{name:'Save customer'}).click();
    await createForm.getByRole('status').getByText('Enter a first name and at least one contact method.').waitFor();
    await createForm.getByLabel('Email').fill('alex@example.test');
    await createForm.getByRole('button',{name:'Save customer'}).click();
    await createForm.waitFor({state:'hidden'});
    await page.locator('.customer-profile-hero h3').getByText('Alex',{exact:true}).waitFor();
    await page.locator('[data-customer-create-quote]').click();
    const quote=page.locator('dialog[open] [name="customer_first_name"]');
    await quote.waitFor();
    assert.equal(await quote.inputValue(),'Alex');
    await page.keyboard.press('Escape');
    assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
    assert.deepEqual(errors,[]);
    console.log(`${width}: customer search, unsaved profile edits, linked billing records, consent and layout passed`);
    await page.close();
  }
}finally{await browser.close();}
