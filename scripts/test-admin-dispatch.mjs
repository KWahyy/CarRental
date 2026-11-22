import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { deskDay } from '../src/crm-dispatch-data.js';

const day = deskDay();
function offsetDay(days) {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}
const nextDay = offsetDay(7);
const pickupId = '11111111-1111-4111-8111-111111111111';
const cars = [
  { id: 'roma', name: 'Ferrari Roma', ownership_type: 'partner', image_url: '/assets/partner-fleet/ferrari-roma/01.png', is_active: true },
  { id: 'wraith', name: 'Rolls-Royce Wraith', ownership_type: 'partner', image_url: '/assets/partner-fleet/rolls-royce-wraith/01.jpg', is_active: true },
  { id: 'owned-evo', slug: '2022-lamborghini-huracan', name: 'Lamborghini Huracán EVO Spyder', ownership_type: 'prestige', image_url: '/assets/owned-fleet/huracan-evo/cover.jpg', is_active: true },
  { id: 'retired', name: 'Archived vehicle', ownership_type: 'partner', is_active: false },
];
const agreements = [
  { id: pickupId, agreement_number: 'QA-1001', status: 'signed', signed_at: day, customer_name: 'Avery Miller', rental_start: day, rental_start_at: day + 'T17:00:00Z', rental_end_at: nextDay + 'T18:00:00Z', vehicle_id: 'roma', vehicle_name: cars[0].name, rental_total: 1295, amount_paid: 900 },
  { id: '22222222-2222-4222-8222-222222222222', agreement_number: 'QA-1002', status: 'vehicle_out', signed_at: day, customer_name: 'Jordan Lee', rental_end: day, rental_end_at: day + 'T21:00:00Z', vehicle_id: 'wraith', vehicle_name: cars[1].name, rental_total: 850, amount_paid: 850, license_file_path: 'test', insurance_file_path: 'test' },
];
const fixtures = {
  cars, rental_agreements: agreements,
  invoices: [{ id: 'invoice', invoice_number: 'QA-1008', status: 'sent', customer_name: 'Avery Miller', subtotal: 1295, amount_paid: 900, issue_date: day, due_date: day, vehicle_id: 'roma', vehicle_name: cars[0].name }],
  invoice_payments: [{ id: 'payment', invoice_id: 'invoice', amount: 900, paid_at: day + 'T16:00:00Z' }],
  quote_requests: [
    ['Avery Lane','Rolls-Royce Wraith',2], ['Cameron Scott','McLaren 720S Spider',6],
    ['Alex Morgan','Ferrari Roma',9], ['Emery Brooks','Mercedes-Maybach GLS 600',4],
    ['Jules Park','Porsche 911 GT3 RS',5], ['Jordan Ellis','Chevrolet Impala Convertible',1],
    ['Sage Monroe','Lamborghini Urus',3], ['Reese Bennett','Ferrari Portofino',7],
  ].map(([name,vehicle,minute])=>({id:'lead-'+minute,name,vehicle,status:'new',rental_date:nextDay,
    created_at:day+'T15:0'+minute+':00Z',source:'website'})),
  rental_agreement_events: [
    {id:'event-1',agreement_id:pickupId,event_type:'signed',detail:'Rental agreement signed for the Ferrari Roma.',created_at:day+'T16:30:00Z'},
    {id:'event-2',agreement_id:agreements[1].id,event_type:'opened',detail:'Return details opened for the Rolls-Royce Wraith.',created_at:day+'T12:30:00Z'},
  ],
};

fixtures.quote_requests.push(
  {id:'already-booked',name:'Taylor North',vehicle:'Porsche 911 GT3 RS',status:'booked',created_at:day+'T17:00:00Z'},
  {id:'price-alias',name:'Evan Stone',vehicle:'Ferrari Roma - $995/day',status:'lost',created_at:offsetDay(-2)+'T18:00:00Z'},
  {id:'on-boundary',name:'Mila Torres',vehicle:'ferrari roma',status:'lost',created_at:offsetDay(-29)+'T18:00:00Z'},
  {id:'too-old',name:'Mia Stone',vehicle:'Ferrari Roma',status:'lost',created_at:offsetDay(-30)+'T18:00:00Z'},
  {id:'synthetic',name:'Pixel Test',vehicle:'Ferrari Roma',status:'lost',created_at:offsetDay(-1)+'T18:00:00Z'},
  {id:'pending-request',name:'Ari Lopez',vehicle:'Rolls-Royce Wraith',status:'checking',created_at:offsetDay(-3)+'T18:00:00Z',follow_up_at:nextDay+'T18:00:00Z'},
);
const reminder = {id:'proposal-due',quote_number:'PL-Q-1091',customer_first_name:'Julian',customer_last_name:'Gray',vehicle_name:'Ferrari Roma',status:'follow_up',follow_up_at:offsetDay(-3)+'T18:00:00Z',sent_at:offsetDay(-6)+'T18:00:00Z',expires_at:offsetDay(10)+'T18:00:00Z',start_at:nextDay+'T18:00:00Z'};
fixtures.quotes = [
  reminder,
  {...reminder,id:'proposal-today',quote_number:'PL-Q-1092',customer_first_name:'Marisol',customer_last_name:'Lee',vehicle_name:'Bentley Continental GTC',follow_up_at:day+'T22:00:00Z'},
  {...reminder,id:'signed-off',customer_first_name:'Closed',status:'converted'},
  {...reminder,id:'declined',customer_first_name:'Declined',status:'declined'},
  {...reminder,id:'out-of-date',customer_first_name:'Expired',expires_at:offsetDay(-1)+'T18:00:00Z'},
];

function mockClient(data, role, failedTable) {
  return `export function createClient(){
    const fixtures=${JSON.stringify({...data,admin_profiles:[{role}]})};
    const session={user:{id:'audit',email:'audit@example.test'},access_token:'mock'};
    function from(table){
      let single=false;
      let rows=fixtures[table]||[];
      const query=new Proxy({}, {get(_,key){
        if(key==='then')return resolve=>resolve(table===${JSON.stringify(failedTable)}?{data:null,error:new Error('Fixture unavailable')}:{data:single?(rows[0]||null):rows,error:null,count:0});
        return (...args)=>{
          if(key==='single'||key==='maybeSingle')single=true;
          if(key==='eq' && table==='rental_agreement_events')rows=rows.filter(row=>row[args[0]]===args[1]);
          return query;
        };
      }});
      return query;
    }
    return {from,auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};
  }`;
}


const browser = await chromium.launch({channel:'chrome',headless:true});
const preview = (process.env.CRM_PREVIEW_URL || 'http://127.0.0.1:8775') + '/admin/';

async function inspectChart(root, page, width) {
  const periods = root.locator('[data-dashboard-chart-period]');
  const first = periods.first();
  const label = root.locator('[data-period-label]');
  const summary = await label.textContent();
  if (width<768) await first.tap(); else await first.hover();
  assert.equal(await label.textContent(), await first.getAttribute('data-period'));
  assert.equal(await root.locator('[data-period-value]').innerText(), await first.getAttribute('data-value'));
  await first.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await label.textContent(), await periods.nth(1).getAttribute('data-period'));
  await page.keyboard.press('Escape');
  assert.equal(await label.textContent(), summary);
}

async function inspectInbox(root, page, role) {
  const inbox=root.locator('[data-desk-panel="inquiries"]');
  const results=inbox.locator('[data-desk-results]');
  const rows=results.locator('[data-dashboard-open="quote"]');
  assert.equal(await rows.first().getAttribute('data-id'),'lead-9');
  await rows.first().click();
  const review=page.locator('[data-inquiry-review][open]');
  assert.match(await review.innerText(),/Alex Morgan/);
  assert.match(await review.innerText(),/Ferrari Roma/);
  assert.equal(await review.locator('[data-prepare-inquiry]').count(),role==='viewer'?0:1);
  await page.keyboard.press('Escape');
  assert(await rows.first().evaluate(button=>button===document.activeElement));

  const search=inbox.locator('[data-desk-search]');
  await search.fill('Maybach');
  assert.deepEqual(await rows.evaluateAll(buttons=>buttons.map(b=>b.dataset.id)),['lead-4']);
  await rows.first().click();
  await review.getByRole('heading',{name:'Emery Brooks'}).waitFor();
  await review.locator('[data-dispatch-close]').click();
  await search.fill('unmatched rental');
  assert.equal(await rows.count(),0);
  assert.match(await results.innerText(),/no |nothing/i);
  await search.fill('');
  const status=inbox.locator('[data-desk-status]');
  await status.selectOption('all');
  assert.equal(await rows.first().getAttribute('data-id'),'already-booked');
  await status.selectOption('new');
  const next=inbox.locator('[data-desk-page="next"]');
  await next.click();
  assert.notEqual(await rows.first().getAttribute('data-id'),'lead-9');
  await inbox.locator('[data-desk-page="prev"]').click();
  assert.equal(await rows.first().getAttribute('data-id'),'lead-9');
}

async function inspectCalendar(root,page){
  const calendar=root.locator('[data-desk-calendar]');
  const days=calendar.locator('[data-desk-calendar-day]');
  assert.equal(await days.count(),7);
  const currentWeek=await days.evaluateAll(items=>items.map(item=>item.dataset.deskCalendarDay));
  assert(currentWeek.includes(day));
  await calendar.locator('[data-desk-calendar-nav="next"]').click();
  await calendar.locator(`[data-desk-calendar-day="${nextDay}"]`).click();
  const movement = calendar.locator('[data-desk-calendar-handoff]').first();
  await movement.click();
  const dialog=page.locator('dialog.dispatch-handoff[open]');
  assert.match(await dialog.innerText(),/QA-1001/);
  assert.match(await dialog.innerText(),/Return/);
  assert.equal(await dialog.locator('[data-dispatch-mark]').count(),0);
  await page.keyboard.press('Escape');
  await calendar.locator('[data-desk-calendar-nav="prev"]').click();
  assert.deepEqual(await days.evaluateAll(items=>items.map(item=>item.dataset.deskCalendarDay)),currentWeek);
}

async function inspectDeskPanels(root,page,{quiet,failedTable,role,width}) {
  const followups = root.locator('[data-desk-followups]');
  const demand = root.locator('[data-desk-demand]');
  await followups.getByRole('heading',{name:'Sales follow-ups',exact:true}).waitFor();
  await demand.getByRole('heading',{name:'Most requested vehicles',exact:true}).waitFor();
  assert.equal(await root.getByRole('heading',{name:'Recent activity',exact:true}).count(),0);
  const snapshot = root.locator('.desk-context');
  assert(await demand.evaluate(el=>el.previousElementSibling?.matches('.desk-context')),'Vehicle demand should directly follow Fleet snapshot');
  const positions = await Promise.all([snapshot,demand].map(el=>el.boundingBox()));
  assert(positions[1].y >= positions[0].y + positions[0].height - 1, 'Demand should sit under Fleet snapshot');
  const reminders = followups.locator('[data-dashboard-open]');
  const vehicles = demand.locator('details');
  if (quiet) {
    assert.equal(await reminders.count(),0);
    assert.match(await followups.innerText(),/no follow-ups scheduled/i);
    assert.equal(await vehicles.count(),0);
    assert.match(await demand.innerText(),/no |yet/i);
    return;
  }
  if (failedTable==='quote_requests') {
    assert.match(await demand.innerText(),/unavailable|could not|couldn.t|unable/i);
    assert.equal(await vehicles.count(),0);
  } else {
    assert.equal(await vehicles.count(),3);
    const top=vehicles.first();
    assert.match(await top.locator('summary').innerText(),/Ferrari Roma/i);
    assert.match(await top.locator('summary').innerText(),/3 inquiries/i);
    await top.locator('summary').click();
    const linked=top.locator('[data-dashboard-open="quote"]');
    assert.deepEqual(await linked.evaluateAll(items=>items.map(button=>button.dataset.id)),['lead-9','price-alias','on-boundary']);
    await linked.nth(1).click();
    const review = page.locator('[data-inquiry-review][open]');
    await review.getByRole('heading',{name:'Evan Stone'}).waitFor();
    assert.equal(await review.locator('[data-prepare-inquiry]').count(),role==='viewer'?0:1);
    await page.keyboard.press('Escape');
    assert(await linked.nth(1).evaluate(button=>button===document.activeElement));
    await top.locator('summary').click();
  }
  if (failedTable==='quotes') {
    assert.match(await followups.innerText(),/unavailable|could not|couldn.t|unable/i);
    assert.equal(await followups.locator('[data-dashboard-open="proposal"]').count(),0);
  } else {
    assert.match(await reminders.first().innerText(),/Julian Gray/);
    assert.equal(await reminders.first().getAttribute('data-urgency'),'overdue');
    assert(await followups.getByText('Marisol Lee').isVisible());
    assert.equal(await followups.locator('[data-id="signed-off"],[data-id="declined"],[data-id="out-of-date"]').count(),0);
  }
  if (failedTable!=='quote_requests') {
    const inquiry=reminders.filter({hasText:'Ari Lopez'});
    assert.equal(await inquiry.getAttribute('data-dashboard-open'),'quote');
    await inquiry.click();
    await page.locator('[data-inquiry-review][open]').getByRole('heading',{name:'Ari Lopez'}).waitFor();
    await page.keyboard.press('Escape');
  }
  if (!failedTable && (role==='viewer' || width===1440)) {
    await followups.locator('[data-id="proposal-due"]').click();
    const detail=page.locator('[data-section-panel="requests"]');
    await detail.locator('[data-detail-action="pdf"]').waitFor();
    assert.match(await detail.innerText(),/PL-Q-1091/);
    assert.match(await detail.innerText(),/Julian Gray/);
    if (role==='viewer') assert(!await detail.locator('[data-save-followup]').isVisible());
    await page.locator(width<761?'[data-workspace-tab="overview"]':'[data-crm-section="overview"]').filter({visible:true}).first().click();
    await followups.waitFor();
  }
  if (!failedTable && role==='owner' && [390,1440].includes(width)) {
    const out=process.env.CRM_SCREENSHOT_DIR||tmpdir();
    await followups.screenshot({animations:'disabled',path:join(out,`desk-sales-followups-${width}.png`)});
    await demand.screenshot({animations:'disabled',path:join(out,`desk-vehicle-demand-${width}.png`)});
  }
}

try {
  for (const [width,role,quiet,failedTable] of [
    [1440,'owner'],[768,'owner'],[390,'owner'],[390,'viewer'],[320,'staff'],[1440,'owner',true],
    [390,'owner',false,'quote_requests'],[1440,'owner',false,'quotes'],[1440,'owner',false,'rental_agreements'],[320,'staff',false,'invoices']
  ]) {
    const data=quiet?{cars}:fixtures;
    const page=await browser.newPage({viewport:{width,height:width<768?844:900},hasTouch:width<768,timezoneId:'America/Los_Angeles'});
    page.setDefaultTimeout(5000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/supabase-js@2/+esm',route=>route.fulfill({contentType:'text/javascript',body:mockClient(data,role,failedTable)}));
    let writes=0;
    await page.route('**/api/**',route=>{
      if(route.request().method()==='POST'){
        const body=route.request().postDataJSON();
        assert.equal(body.id,pickupId);
        assert.equal(body.action,'pickup_ready');
        writes++;
        return route.fulfill({json:{ready:true}});
      }
      const url=new URL(route.request().url());
      if (url.pathname==='/api/quotes' && url.searchParams.has('id')) {
        const quote=data.quotes?.find(item=>item.id===url.searchParams.get('id'));
        return route.fulfill({status:quote?200:404,json:quote?{quote,role,events:[],revisions:[]}:{error:'Quote missing'}});
      }
      if(url.pathname==='/api/fleet') {
        const vehicles=cars.map(car=>({...car,metrics:{status:'available',next_reservation:null,current_agreement:null,bookings:0,revenue:0,gross_profit:0},photos:[],documents:[],maintenance:[],expenses:[],agreements:[],blocks:[]}));
        return route.fulfill({json:{vehicles,role,period:{key:'month',start:day,end:nextDay}}});
      }
      return route.fulfill({json:{agreements:data.rental_agreements||[],agreement:agreements[0],cars,vehicles:cars,quotes:data.quotes||[],role,invoices:data.invoices||[],customers:[],events:[],partners:[],leads:[],employees:[],reservations:[],blocks:[],activities:[],items:[],availability:[],settings:{},template:{title:'Fixture',body:'',important_terms:[]}}});
    });
    await page.goto(preview);
    const root=page.locator('[data-executive-dashboard]');
    await root.getByRole('heading',{name:'Rental desk',exact:true}).waitFor();
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    assert.equal(await overflow(),false,`${width}px desk overflow`);
    assert.doesNotMatch(await root.innerText(),/Huracán EVO/i,'Unscheduled vehicle appears in the company overview');
    const goTab=tab=>root.locator(`[data-desk-tab="${tab}"]`).click();
    const panel=tab=>root.locator(`[data-desk-panel="${tab}"]`);
    const handoffs=panel('handoffs');
    const context=root.locator('.desk-context');
    const scheduleFailed=['invoices','rental_agreements'].includes(failedTable);
    assert.equal(await context.locator('dd').first().innerText(),'3');
    assert.match(await context.innerText(),/1 owned · 2 partner/);
    const collection=context.locator('.desk-context-lines > div').last();
    if(role==='staff') assert.match(await collection.innerText(),/Bookings this month/);
    else assert.match(await collection.innerText(),/Payments this month/);
    if(role!=='staff' || scheduleFailed) assert.equal(await collection.locator('dd').innerText(),scheduleFailed?'—':quiet?'$0':'$900');
    assert.equal(await root.locator('[data-desk-tab="inquiries"] span').innerText(),failedTable==='quote_requests'?'—':quiet?'0':'8');
    assert.equal(await root.locator('[data-desk-tab="handoffs"] span').innerText(),scheduleFailed?'—':quiet?'0':'3');
    const capturePanels=!quiet&&!failedTable&&role==='owner'&&[390,1440].includes(width);
    if(!failedTable){
      await page.screenshot({animations:'disabled',path:join(process.env.CRM_SCREENSHOT_DIR||tmpdir(),`prestige-overview-${role}-${width}${quiet?'-quiet':''}.png`)});
    }
    if(capturePanels) await root.locator('[data-desk-screen="desk"]').screenshot({animations:'disabled',path:join(process.env.CRM_SCREENSHOT_DIR||tmpdir(),`prestige-desk-panel-${width}.png`)});
    await inspectDeskPanels(root,page,{quiet,failedTable,role,width});
    if(quiet) {
      await goTab('inquiries');
      assert.equal(await panel('inquiries').locator('[data-dashboard-open]').count(),0);
      assert.match(await panel('inquiries').innerText(),/no |clear|caught up|empty/i);
      await goTab('handoffs');
      assert.equal(await handoffs.locator('.dispatch-row').count(),0);
      assert.match(await handoffs.innerText(),/no |clear|empty/i);
      await goTab('attention');
      assert.equal(await panel('attention').locator('[data-dashboard-open]').count(),0);
      assert.match(await panel('attention').innerText(),/no |clear|caught up|empty/i);
    } else if(failedTable){
      await goTab('inquiries');
      if(failedTable!=='quote_requests') assert.match(await panel('inquiries').innerText(),/Alex Morgan/);
      else assert.match(await panel('inquiries').innerText(),/unavailable|could not|couldn.t|unable/i);
      await goTab('attention');
      if(failedTable!=='rental_agreements') assert.match(await panel('attention').innerText(),/Avery Miller/);
      await goTab('handoffs');
      if(scheduleFailed) {
        assert.equal(await handoffs.locator('[data-dispatch-refresh]').count(),1);
        assert.match(await handoffs.innerText(),/unavailable|could not|couldn.t|unable/i);
      } else assert.match(await handoffs.innerText(),/Ferrari Roma/);
    } else {
      await inspectInbox(root,page,role);
      await inspectCalendar(root,page);
      await goTab('attention');
      assert.match(await panel('attention').innerText(),/Avery Miller/);
      assert.doesNotMatch(await panel('attention').innerText(),/Alex Morgan/);
      await goTab('handoffs');
      assert.match(await handoffs.innerText(),/Ferrari Roma/);
      assert.match(await handoffs.innerText(),/Rolls-Royce Wraith/);
      await handoffs.locator('button[data-dispatch-scope="pickup"]').click();
      assert.equal(await handoffs.locator('.dispatch-row').count(),1);
      const fromCalendar=width===390 && role==='owner';
      const pickup = fromCalendar ? root.locator('[data-desk-calendar-handoff]').first() : handoffs.locator('.dispatch-row');
      if(fromCalendar) await goTab('inquiries');
      await pickup.click();
      const handoff=page.locator('dialog.dispatch-handoff[open]');
      assert.match(await handoff.innerText(),/QA-1001/);
      assert.match(await handoff.innerText(),/\$395/);
      if(role==='viewer'){
        assert.equal(await handoff.locator('[data-dispatch-mark]').count(),0);
        await page.keyboard.press('Escape');
        assert.equal(writes,0);
      } else {
        await handoff.locator('[data-dispatch-mark]').click();
        await handoff.getByText('Pickup preparation recorded.').waitFor();
        assert.equal(writes,1);
        await handoff.locator('[data-dispatch-close]').click();
        if(fromCalendar) {
          await page.waitForFunction(()=>document.activeElement.hasAttribute('data-desk-calendar-handoff'),{},{timeout:2000});
          await goTab('handoffs');
        }
        await handoffs.locator('button[data-dispatch-scope="ready"]').click();
        assert.equal(await handoffs.locator('.dispatch-row').count(),1);
        await handoffs.locator('select[data-dispatch-scope]').selectOption('return');
        assert.match(await handoffs.innerText(),/Rolls-Royce Wraith/);
      }
    }
    await root.locator('[data-desk-view="reports"]').click();
    assert.equal(await overflow(),false,`${width}px reports overflow`);
    if(capturePanels) await root.locator('[data-desk-screen="reports"]').screenshot({animations:'disabled',path:join(process.env.CRM_SCREENSHOT_DIR||tmpdir(),`prestige-reports-panel-${width}.png`)});
    if(role==='staff') assert.equal(await root.locator('.owned-report').count(),0);
    else assert.equal(await root.locator('.owned-report').getAttribute('open'),null);
    if(!failedTable && !quiet) {
      await inspectChart(root,page,width);
      if(role!=='staff') assert.match(await root.innerText(),/\$900/);
    }
    await root.locator('[data-desk-view="desk"]').click();
    if(role==='viewer'){
      await page.locator('[data-workspace-menu]').click();
      await page.locator('dialog [data-workspace-tab="customers"]').click();
      assert(await page.locator('[data-section-panel="customers"]').isVisible());
      assert.equal(writes,0);
    }
    assert.deepEqual(await page.getByText(/fleet details are still syncing|cannot read properties of undefined/i).filter({visible:true}).allTextContents(),[]);
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(`PASS ${width}px ${role} ${failedTable?'unavailable '+failedTable:quiet?'quiet':'populated'} rental desk`);
  }
} finally {
  await browser.close();
}
