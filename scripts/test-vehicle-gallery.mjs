import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadPublicInventory} from '../src/public-inventory.js';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775',out='output/gallery-refresh';await mkdir(out,{recursive:true});
const {fleet}=await loadPublicInventory();
const selected=process.env.GALLERY_SLUGS?fleet.filter(c=>process.env.GALLERY_SLUGS.split(',').includes(c.slug)):fleet;
const queue=selected.flatMap(car=>[1440,768,390].map(width=>({car,width}))),results=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
async function worker(){while(queue.length){const {car,width}=queue.shift();const context=await browser.newContext({viewport:{width,height:960},hasTouch:width===390});const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/rest/v1/fleet_events',r=>r.fulfill({status:201,json:[]}));await p.addInitScript(()=>{window.testCLS=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.testCLS+=e.value}).observe({type:'layout-shift',buffered:true});});
try{
 await p.goto(base+'/cars/'+car.slug,{waitUntil:'load'});
 const n=car.car_photos.length,dots=p.locator('[data-gallery-dots] button');assert.equal(await dots.count(),n);
 assert.equal(await p.locator('.vehicle-gallery-strip').isVisible(),false);
 assert.equal(await p.locator('[data-gallery-next]').evaluate(el=>getComputedStyle(el).borderRadius),'50%');
 const bounds=await p.locator('.vehicle-gallery-stage').evaluate(el=>{const f=el.querySelector('.vehicle-gallery-frame').getBoundingClientRect(),d=el.querySelector('[data-gallery-dots]').getBoundingClientRect();return {frameBottom:f.bottom,dotsTop:d.top};});
 assert.ok(bounds.dotsTop>=bounds.frameBottom,'Dots must sit below the photograph');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(n>1){
  await p.locator('[data-gallery-next]').click();assert.equal(await dots.nth(1).getAttribute('aria-pressed'),'true');
  await p.locator('[data-gallery-prev]').click();assert.equal(await dots.first().getAttribute('aria-pressed'),'true');
  if(width===390){const frame=await p.locator('.vehicle-gallery-frame').boundingBox();await p.mouse.move(frame.x+frame.width*.7,frame.y+frame.height*.35);await p.mouse.down();await p.mouse.move(frame.x+frame.width*.3,frame.y+frame.height*.35,{steps:8});await p.mouse.up();assert.equal(await dots.nth(1).getAttribute('aria-pressed'),'true');await dots.first().click();}
 }
 await p.locator('[data-gallery-open]').click();assert.equal(await p.locator('dialog').evaluate(d=>d.open),true);
 await p.keyboard.press('ArrowLeft');assert.equal(await p.locator('[data-lightbox-count]').textContent(),`${n} / ${n}`);
 await p.locator('[data-lightbox-image]').evaluate(img=>img.decode());
 assert.ok(await p.locator('[data-lightbox-image]').evaluate(img=>img.naturalWidth>0));
 await p.locator('[data-lightbox-next]').click();assert.equal(await p.locator('[data-lightbox-count]').textContent(),`1 / ${n}`);
 if(car.slug==='porsche-911-gt3-rs-rental')await p.screenshot({path:`${out}/gallery-${width}.png`});
 await p.keyboard.press('Escape');assert.equal(await p.locator('dialog').evaluate(d=>d.open),false);assert.equal(await p.locator('[data-gallery-open]').evaluate(n=>document.activeElement===n),true);
 await dots.last().click();assert.equal(await dots.last().getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-gallery-count]').textContent(),`${n} / ${n}`);
 await p.reload({waitUntil:'load'});assert.equal(await p.locator('[data-gallery-count]').textContent(),`1 / ${n}`);
 if(car.slug==='porsche-911-gt3-rs-rental'){await p.locator('.vehicle-gallery-stage').screenshot({path:`${out}/slider-${width}.png`});await p.screenshot({path:`${out}/page-${width}.png`,fullPage:true});}
 assert.equal(errors.length,0);const cls=await p.evaluate(()=>window.testCLS);assert.ok(cls<.1,`CLS ${cls}`);
 results.push({slug:car.slug,width,photos:n,cls,pass:true});
}catch(e){results.push({slug:car.slug,width,error:e.message,errors});console.log('FAIL',car.slug,width,e.message);}
finally{await context.close();}
}}
await Promise.all(Array.from({length:4},worker));await browser.close();await writeFile(out+'/browser-tests.json',JSON.stringify(results,null,2));console.log(JSON.stringify({runs:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length}));process.exitCode=results.some(r=>!r.pass)?1:0;
