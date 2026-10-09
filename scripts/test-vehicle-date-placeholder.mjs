import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.goto('http://127.0.0.1:8775/cars/ferrari-f8-tributo-rental');
  assert.equal(await page.locator('.vehicle-date-placeholder').count(),2);
  for(const name of ['date','returnDate']){
   const input=page.locator(`[data-vehicle-request-form] [name="${name}"]`);
   const wrapper=page.locator(`.vehicle-date-control:has([name="${name}"])`);
   const placeholder=wrapper.locator('.vehicle-date-placeholder');
   assert.equal(await placeholder.isVisible(),true, width+' '+name+' '+await wrapper.innerHTML());
   await input.fill('2026-11-20T10:00');await input.blur();
   assert.equal(await placeholder.isVisible(),false);
   await input.fill('');await input.blur();
   assert.equal(await placeholder.isVisible(),true);
  }
  await page.locator('.vehicle-request-dates').screenshot({path:`output/gallery-refresh/request-layout/dates-${width}.png`});
  await page.goto('http://127.0.0.1:8775/cars/ferrari-f8-tributo-rental?pickup=2026-11-20&return=2026-11-22');
  assert.equal(await page.locator('.vehicle-date-placeholder:visible').count(),0);
  await page.close();console.log(width,'passed');
 }
}finally{await browser.close();}
