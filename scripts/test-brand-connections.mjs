import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {loadPublicInventory} from '../src/public-inventory.js';
import {brandFor} from '../src/vehicle-brands.js';
import {mkdir,writeFile} from 'node:fs/promises';
const {fleet}=await loadPublicInventory();
const groups=new Map();for(const car of fleet){const brand=brandFor(car);assert.notEqual(brand,'Other',car.name);groups.set(brand,[...(groups.get(brand)||[]),car]);}
await mkdir('output/brand-connections',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
for(const width of [1440,390]){
 const p=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/rest/v1/fleet_events',r=>r.fulfill({status:201,json:[]}));
 await p.goto('http://127.0.0.1:8775/',{waitUntil:'load'});
 for(const [brand,cars] of groups){
  const tile=p.locator('[data-brand-grid] [data-shop-filter]').filter({has:p.locator('.brand-name',{hasText:new RegExp('^'+brand+'$')})});
  assert.equal(await tile.locator('strong').textContent(),`${cars.length} ${cars.length===1?'car':'cars'}`);
  await tile.click();
  const links=await p.locator('[data-home-fleet-grid] a').evaluateAll(nodes=>nodes.map(a=>new URL(a.href).pathname));
  assert.equal(links.length,Math.min(cars.length,9),brand);
  assert.ok(links.every(url=>cars.some(c=>url==='/cars/'+c.slug)),brand);
 }
 await p.locator('[data-brand-grid]').evaluate(el=>el.scrollLeft=0);
 await p.locator('[data-brand-grid]').screenshot({path:`output/brand-connections/brands-${width}.png`});
 assert.deepEqual(errors,[]);results.push({width,brands:groups.size,cars:fleet.length,pass:true});await p.close();
}
await browser.close();await writeFile('output/brand-connections/results.json',JSON.stringify(results,null,2));console.log(results);
