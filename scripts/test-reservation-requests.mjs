import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775';const b=await chromium.launch({channel:'chrome',headless:true});mkdirSync('output/reservation-requests',{recursive:true});
for(const width of [390,1440]){
 const p=await b.newPage({viewport:{width,height:950}});const requests=[];
 await p.route('**/api/quote',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:{ok:true,id:'test-reservation-only'}});});
 for(const flow of ['home','fleet','car']){
  await p.goto(base+(flow==='home'?'/':flow==='fleet'?'/fleet':'/cars/ferrari-f8-tributo-rental'));
  if(flow==='home'){assert.equal((await p.locator('.hero-rental-search > button').innerText()).replace(/\s+/g,' '),'Book in minutes ↗');assert.match(await p.locator('.hero-search-note').innerText(),/Request online.*confirms availability and the final price/s);}
  if(flow==='fleet')await p.locator('[data-check-availability]').first().click();
  const selector=flow==='home'?'[data-quote-form]':flow==='fleet'?'[data-availability-form]':'[data-vehicle-request-form]';const form=p.locator(selector);
  if(flow==='home') {
   await form.locator('[data-reservation-next]').click();
   assert.ok(await form.locator('[data-car-error]').isVisible());
   await form.locator('[data-car-trigger]').click();
   await form.locator('[data-car-search]').fill('not-a-real-car');
   assert.ok(await form.locator('[data-car-empty]').isVisible());
   await form.locator('[data-car-search]').fill('ferrari');
   await form.locator('.reservation-car-result').first().click();
   assert.match(await form.locator('[name="vehicle"]').inputValue(),/Ferrari/i);
   assert.equal(await form.locator('#reservation-car-panel').isVisible(),false);
  }
  await form.locator('[name="date"]').fill(flow==='car'?'2026-11-10T10:00':'2026-11-10');
  if(flow==='home') {
   await form.locator('[name="returnDate"]').fill('2026-11-09');
   await form.locator('[data-reservation-next]').click();
   assert.equal(await form.locator('[data-reservation-step="2"]').isVisible(),false);
   await form.locator('[name="returnDate"]').fill('2026-11-12');
   await form.locator('[data-reservation-next]').click();
   await form.locator('[data-reservation-back]').click();
   assert.equal(await form.locator('[name="returnDate"]').inputValue(),'2026-11-12');
   await form.locator('[data-reservation-next]').click();
  }
  if(flow!=='home')await form.locator('[name="deliveryLocation"]').fill('Los Angeles');
  if(flow==='car'&&await form.locator('[data-request-continue]').isVisible())await form.locator('[data-request-continue]').click();
  await form.locator('[name="name"]').fill('Reservation Test');await form.locator('[name="phone"]').fill('9495550100');
  await form.locator('[type="submit"]').click();const status=form.locator('[role="status"]');await status.filter({hasText:'Pending confirmation'}).waitFor();assert.match(await status.innerText(),/team member will contact you.*final price/s);assert.match(await status.innerText(),/No payment has been taken/);assert.ok(await form.locator('[type="submit"]').isDisabled());
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await status.scrollIntoViewIfNeeded();await p.screenshot({path:`output/reservation-requests/${flow}-${width}.png`});
 }
 assert.match(requests[0].message,/Return date: 2026-11-12/); assert.equal(requests.length,3);console.log(width,'passed: homepage, fleet and vehicle reservation requests (mocked)');await p.close();
}await b.close();
