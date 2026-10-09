import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {loadPublicInventory} from '../src/public-inventory.js';
import {writeFile} from 'node:fs/promises';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775';
const {fleet}=await loadPublicInventory();
const urus=fleet.find(c=>c.slug==='lamborghini-urus-s-rental');
assert.equal(urus.car_photos.length,32);
assert.ok(urus.car_photos.every(p=>!['/assets/partner-fleet/lamborghini-urus-s/02.webp','/assets/partner-fleet/lamborghini-urus-s/03.webp'].includes(p.url)));
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
for(const width of [1440,768,390])for(const slug of ['ferrari-296-gtb-rental','lamborghini-urus-s-rental']){
 const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/rest/v1/fleet_events',r=>r.fulfill({status:201,json:[]}));
 await p.goto(base+'/cars/'+slug,{waitUntil:'load'});
 const main=p.locator('[data-gallery-main]');await main.evaluate(img=>img.decode());
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(slug.startsWith('ferrari')){
  assert.equal(await main.evaluate(el=>getComputedStyle(el).objectFit),'cover');
  assert.equal(await main.evaluate(el=>getComputedStyle(el).objectPosition),'50% 65%');
  await p.locator('[data-gallery-dot="3"]').click();
  assert.equal(await main.evaluate(el=>getComputedStyle(el).objectFit),'contain','Close-ups retain the complete detail');
  await p.locator('[data-gallery-dot="0"]').click();
 }else{
  assert.equal(await p.locator('[data-gallery-dots] button').count(),32);
  await p.locator('[data-gallery-next]').click();
  assert.ok(!(await main.getAttribute('src')).includes('/02.webp'));
 }
 await p.locator('[data-gallery-open]').click();
 assert.equal(await p.locator('[data-lightbox-image]').evaluate(el=>getComputedStyle(el).objectFit),'contain');
 await p.keyboard.press('Escape');
 await p.locator('.vehicle-private-hero').screenshot({path:`output/gallery-refresh/corrected-${slug}-${width}.png`});
 await p.reload({waitUntil:'load'});
 assert.equal(await p.locator('[data-gallery-count]').textContent(),slug.startsWith('ferrari')?'1 / 9':'1 / 32');
 assert.deepEqual(errors,[]);
 results.push({slug,width,pass:true});await context.close();
}
await browser.close();await writeFile('output/gallery-refresh/gallery-corrections-tests.json',JSON.stringify(results,null,2));console.log(`${results.length} gallery correction checks passed; Supabase Urus photo count: 32`);
