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
  if(flow==='home')await form.locator('[name="vehicle"]').selectOption({index:1});
  await form.locator('[name="date"]').fill(flow==='car'?'2026-11-10T10:00':'2026-11-10');
  if(flow!=='home')await form.locator('[name="deliveryLocation"]').fill('Los Angeles');
  if(flow==='car'&&await form.locator('[data-request-continue]').isVisible())await form.locator('[data-request-continue]').click();
  await form.locator('[name="name"]').fill('Reservation Test');await form.locator('[name="phone"]').fill('9495550100');
  await form.locator('[type="submit"]').click();const status=form.locator('[role="status"]');await status.filter({hasText:'Pending confirmation'}).waitFor();assert.match(await status.innerText(),/team member will contact you.*final price/s);assert.match(await status.innerText(),/No payment has been taken/);assert.ok(await form.locator('[type="submit"]').isDisabled());
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await status.scrollIntoViewIfNeeded();await p.screenshot({path:`output/reservation-requests/${flow}-${width}.png`});
 }
 assert.equal(requests.length,3);console.log(width,'passed: homepage, fleet and vehicle reservation requests (mocked)');await p.close();
}await b.close();
