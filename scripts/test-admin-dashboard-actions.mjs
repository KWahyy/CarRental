import { crmBase, openCrmPage } from "./crm-browser-helpers.mjs";
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { fleet } from '../src/fleet-data.js';
import { rentalLedger } from '../src/crm-desk-overview-ledger.js';

// Rental cash must reconcile across multiple payments, refundable deposits,
// legacy invoices, linked booking shadows, and independently paid bookings.
const ledger = rentalLedger({
  invoices:[
    {id:'modern',status:'paid',subtotal:1000,amount_paid:1300,quote_id:'p'},
    {id:'legacy',status:'paid',subtotal:100,amount_paid:100,paid_at:'2026-11-03'},
    {id:'void',status:'void',subtotal:500,amount_paid:500,paid_at:'2026-11-08'},
  ],
  invoicePayments:[
    {id:'2',invoice_id:'modern',amount:600,paid_at:'2026-11-04'},
    {id:'1',invoice_id:'modern',amount:700,paid_at:'2026-10-29'},
  ],
  agreements:[{id:'a',source_type:'invoice',source_id:'legacy'}],
  bookings:[
    {id:'shadow',amount_paid:100,booked_on:'2026-11-03',notes:'[PL_FINANCE]{"agreement_id":"a"}'},
    {id:'manual',total_amount:575.5,amount_paid:525.5,booked_on:'2026-11-12'},
  ],
  proposals:[{id:'p',lead_id:'l'}],quotes:[{id:'l',source:'referral'}],
});
assert.equal(ledger.receipts.filter(r=>r.date.startsWith('2026-11')).reduce((n,r)=>n+r.amount,0),925.5);
assert.deepEqual(ledger.receipts.filter(r=>r.invoice_id==='modern').map(r=>r.source),['referral','referral']);
assert.equal(ledger.balance,50);

const showcaseSlugs = ['2022-lamborghini-huracan','mercedes-maybach-s580-rental','mclaren-750s-rental'];
const cars = fleet.filter(car => showcaseSlugs.includes(car.slug) || /DeVille|Impala/.test(car.name)).map(car => ({
  id:car.id, slug:car.slug, name:car.name, make:car.make, model:car.model, image_url:car.image_url,
  operational_status:car.slug === 'mclaren-750s-rental' ? 'vehicle_out' : 'available',
  ownership_type:car.slug === '2022-lamborghini-huracan' ? 'prestige' : 'partner',
}));
const browser = process.env.CRM_TEST_WEBKIT === '1'
  ? await webkit.launch({headless:true})
  : await chromium.launch({channel:'chrome',headless:true});
// The last (expenses) read can be held open to interact with the dashboard
// before and after an actual asynchronous refresh completes.
const mock = `export function createClient() {
  const session = {user:{id:'audit',email:'audit@example.test'}, access_token:'mock'};
  const tables = window.deskFixtures = {
    admin_profiles:[{role:'owner',display_name:'Audit'}], cars:${JSON.stringify(cars)},
    booking_sales:[], quote_requests:Array.from({length:5}, (_,i)=>({id:'lead-'+i,name:'Test '+i,status:'new'})),
  };
  window.overviewReads = 0;
  function from(table) {
    let single = false;
    const proxy = new Proxy({}, {get(_, key) {
      if (key === 'then') return async resolve => {
        if (table === 'vehicle_expenses') {
          window.overviewReads++;
          await window.expenseGate;
        }
        const rows = tables[table] || [];
        resolve({data:single ? rows[0] || null : rows,error:null,count:rows.length});
      };
      return () => { if (key==='single' || key==='maybeSingle') single=true; return proxy; };
    }});
    return proxy;
  }
  return {from, auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
    storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};
}`;
async function testOverviewReturn(width) {
  const page = await browser.newPage({viewport:{width,height:900},hasTouch:width < 500,isMobile:width < 500});
  try {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/supabase-js@2/+esm', route => route.fulfill({contentType:'text/javascript',body:mock}));
    await page.route('**/api/**', route => route.fulfill({json:{vehicles:[],role:'owner',period:{key:'month'}}}));
    const now = new Date('2026-11-22T18:00:00Z');
    await page.clock.setFixedTime(now);
    await page.goto(crmBase+'/admin/?page=overview');
    await page.getByRole('button',{name:'View all 5 leads →'}).click();
    assert.equal(await page.locator('[data-desk-inquiry]').count(),5);
    const reads = () => page.evaluate(() => window.overviewReads);
    const initialReads = await reads();
    for (let pass=0; pass<2; pass++) {
      await openCrmPage(page,'vehicles');
      await openCrmPage(page,'overview');
      assert.equal(await page.locator('[data-desk-inquiry-list]').getAttribute('aria-expanded'),'true');
    }
    assert.equal(await reads(),initialReads,'A fresh Overview should not fetch expenses on return');

    // Expire the cached snapshot, return, then open the schedule before the read finishes.
    await openCrmPage(page,'vehicles');
    await page.clock.setFixedTime(new Date(now.valueOf()+61_000));
    await page.evaluate(() => {
      window.expenseGate = new Promise(resolve => { window.releaseExpenses = resolve; });
      window.deskFixtures.booking_sales = [{id:'paid-rental',total_amount:125,amount_paid:125,booked_on:'2026-11-22'}];
    });
    await openCrmPage(page,'overview');
    await page.waitForFunction(n => window.overviewReads > n,initialReads);
    await page.getByRole('button',{name:'View schedule',exact:true}).click();
    const schedule = page.getByRole('dialog',{name:'Upcoming schedule'});
    await schedule.waitFor();
    await page.evaluate(() => {
      window.scheduleNode = document.querySelector('[data-desk-dialog]');
      window.leadsNode = document.querySelector('[data-desk-inquiry]');
      window.releaseExpenses();
    });
    await page.waitForFunction(() => document.querySelector('#rv-total')?.textContent === '$125');
    assert(await schedule.isVisible(),'Completing the in-flight refresh dismissed the schedule');
    assert(await page.evaluate(() => window.scheduleNode === document.querySelector('[data-desk-dialog]') && window.leadsNode === document.querySelector('[data-desk-inquiry]')));
    await page.goBack();
    await page.locator('[data-section-panel="vehicles"]:visible').waitFor();
    assert.equal(await page.locator('dialog:modal').count(),0,'Hidden Overview trapped focus on Fleet');
    await page.goForward();
    await schedule.waitFor();
    await schedule.getByRole('button',{name:'Close details'}).click();
    await page.getByRole('button',{name:'Show fewer leads'}).waitFor();

    // A payment notification updates balances immediately, even inside the freshness window.
    await page.evaluate(() => {
      window.deskFixtures.booking_sales[0].amount_paid = 150;
      window.deskFixtures.booking_sales[0].total_amount = 150;
      window.dispatchEvent(new CustomEvent('prestige:finance-updated'));
    });
    await page.waitForFunction(() => document.querySelector('#rv-total')?.textContent === '$150');
    assert.equal(await page.locator('[data-desk-inquiry]').count(),5);
    assert.deepEqual(errors,[]);
    console.log('PASS: '+width+' px, two warm returns with zero Overview reloads; late refresh retained schedule, lead rows, and expansion; payment updated Revenue.');
  } finally { await page.close(); }
}
try{
  for (const width of [1440,390]) await testOverviewReturn(width);
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mock}));
  await page.route('**/api/**',route=>route.fulfill({json:{invoices:[],agreements:[],quotes:[],cars:[],vehicles:[],customers:[],partners:[],employees:[],reservations:[],blocks:[],leads:[],activities:[],items:[],availability:[],template:{title:'Audit',body:'Audit',important_terms:[]}}}));
  const testedVehicleRecords = [];
  await page.route('**/api/fleet?**',route=>{
    const id = new URL(route.request().url()).searchParams.get('id');
    const vehicles = cars.map(car=>({...car,metrics:{status:car.operational_status},photos:[],agreements:[],blocks:[],expenses:[],maintenance:[],documents:[]}));
    if (!id) return route.fulfill({json:{vehicles,role:'owner',period:{key:'month'}}});
    testedVehicleRecords.push(id);
    return route.fulfill({json:{vehicle:vehicles.find(car=>car.id===id),activity:[],mileage:[]}});
  });
  await page.goto(crmBase+'/admin/');await page.locator('[data-admin-view]').waitFor();
  const root=page.locator('[data-executive-dashboard]');
  const snapshot = root.locator('#fleet');
  const cards = snapshot.locator('[data-desk-record="vehicle"]');
  await cards.first().waitFor();
  assert.deepEqual(await cards.evaluateAll(items=>items.map(item=>item.dataset.id)),showcaseSlugs.map(slug=>cars.find(car=>car.slug===slug).id));
  assert.deepEqual(await cards.locator('.car-title').allTextContents(),['Huracan EVO Spyder','S580','750S']);
  assert.equal(await cards.nth(1).locator('img').getAttribute('data-original-photo'),'/assets/partner-fleet/mercedes-maybach-s580/02.webp');
  assert.deepEqual(await cards.locator('.state').allTextContents(),['Available','Available','On rent']);
  await snapshot.locator('[data-desk-fleet-filter="vehicle_out"]').click();
  assert.deepEqual(await cards.locator('.car-title').allTextContents(),['750S']);
  await snapshot.locator('[data-desk-fleet-filter="all"]').click();
  await snapshot.locator('[data-desk-fleet-expand]').click();
  assert.equal(await cards.count(),cars.length);
  await snapshot.locator('[data-desk-fleet-expand]').click();
  for (const slug of showcaseSlugs) {
    const car = cars.find(row=>row.slug===slug);
    await Promise.all([
      page.waitForResponse(response=>new URL(response.url()).searchParams.get('id')===car.id),
      snapshot.locator(`[data-id="${car.id}"]`).click(),
    ]);
    await page.locator('[data-back-fleet]').waitFor();
    assert.equal(testedVehicleRecords.at(-1),car.id);
    await openCrmPage(page,'overview');
  }
  await root.locator('[data-desk-cash-period]').selectOption('week');
  assert.match(await root.locator('#rv-chart').innerText(), /No rental payments/);
  await root.locator('[data-desk-reports] > summary').click();
  await root.locator('[data-dashboard-range]').waitFor();
  await root.locator('[data-dashboard-range]').selectOption('custom');
  await root.locator('[data-dashboard-start]').fill('2026-10-01');
  await root.locator('[data-dashboard-end]').fill('2026-10-31');
  const sections = await root.locator('[data-dashboard-section]:visible').evaluateAll(nodes => [...new Set(nodes.map(n => n.dataset.dashboardSection))]);
  for (const section of sections) {
    await root.locator(`[data-dashboard-section="${section}"]:visible`).first().click();
    assert(await page.locator(`[data-section-panel="${section}"].active`).count(),section);
    await openCrmPage(page,"overview");
  }
  for(const [type,section,selector] of [['invoice','invoices','[data-invoice-dialog][open]'],['booking','bookings','[data-booking-dialog][open]'],['quote','requests','[data-quote-builder-dialog][open]']]){
    await root.locator(`[data-dashboard-create="${type}"]`).first().click();
    await page.locator(`[data-section-panel="${section}"].active`).waitFor();
    await page.locator(selector).waitFor();
    await page.keyboard.press('Escape');
    await openCrmPage(page,"overview");
  }
  const traffic = page.locator('.desk-operating-reports');
  await traffic.locator('summary').click();
  await traffic.getByText('0 fleet page views').waitFor();
  await traffic.getByText('No partner checks pending.').waitFor();
  await traffic.getByText('No competitor comparisons recorded.').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: featured fleet order, live status filters, linked vehicle records, dashboard date range, section links, and invoice/booking/quote quick actions (mocked).');
}finally{await browser.close();}
