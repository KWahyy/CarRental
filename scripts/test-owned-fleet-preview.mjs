import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8776/output/owned-fleet/preview.html');
  await page.locator('.owned-car').first().waitFor();
  assert.equal(await page.locator('.owned-car').count(),3);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
  await page.locator('.owned-breakdown summary').first().click();
  assert(await page.locator('.owned-breakdown').first().getAttribute('open')!==null);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Expanded detail overflow');
  await page.locator('.owned-breakdown summary').first().click();
  const prior=await page.locator('.owned-totals strong').nth(1).textContent();
  await page.locator('[data-owned-expense]').first().click();
  await page.locator('[name=amount]').fill('150');
  await page.getByRole('button',{name:'Save preview cost'}).click();
  assert.notEqual(await page.locator('.owned-totals strong').nth(1).textContent(),prior);
  await page.locator('#period').selectOption('10');
  await page.screenshot({path:`output/owned-fleet/${width}-preview.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`${width}: cards, period filter, breakdown, local expense entry, no overflow passed`);
  await page.close();
 }
}finally{await browser.close();}
