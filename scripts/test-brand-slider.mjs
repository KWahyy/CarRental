import {chromium} from 'playwright';import assert from 'node:assert/strict';import {featuredBrands} from '../src/vehicle-brands.js';
const b=await chromium.launch({channel:'chrome',headless:true});
for(const width of [1440,768,390]){
 const p=await b.newPage({viewport:{width,height:960},reducedMotion:'reduce',hasTouch:width===390});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8775/',{waitUntil:'load'});
 const rail=p.locator('[data-brand-grid]');await rail.scrollIntoViewIfNeeded();
 assert.deepEqual((await rail.locator('.brand-name').allTextContents()).slice(0,6),featuredBrands);
 assert.equal(await p.locator('[data-brand-prev]').isDisabled(),true);
 await p.locator('[data-brand-next]').click();await p.waitForTimeout(250);assert.ok(await rail.evaluate(el=>el.scrollLeft>20));
 await p.locator('[data-brand-dots] button').first().click();await p.waitForTimeout(250);assert.equal(await rail.evaluate(el=>el.scrollLeft),0);
 const box=await rail.boundingBox();
 if(width===390){
  const cdp=await p.context().newCDPSession(p),y=box.y+box.height*.5;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.85,y}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*(.85-i*.08),y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(500);
  assert.ok(await rail.evaluate(el=>el.scrollLeft>20),'Native touch swipe must scroll');
  await p.locator('[data-brand-dots] button').first().click();await p.waitForTimeout(250);
 }

 await p.mouse.move(box.x+box.width*.8,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.2,box.y+box.height*.5,{steps:12});await p.mouse.up();await p.waitForTimeout(250);
 assert.ok(await rail.evaluate(el=>el.scrollLeft>20),'Dragging must scroll');
 assert.equal(await p.locator('[data-home-fleet] input[type="search"]').inputValue(),'','Dragging must not filter');
 await p.locator('[data-brand-dots] button').first().click();await p.waitForTimeout(250);
 await rail.locator('[data-shop-filter="brand:Porsche"]').click();assert.equal(await p.locator('[data-home-fleet] input[type="search"]').inputValue(),'Porsche');
 await rail.scrollIntoViewIfNeeded();await p.locator('.shop-panel').first().screenshot({path:`output/brand-connections/slider-${width}.png`});assert.deepEqual(errors,[]);console.log('PASS',width);await p.close();
}
await b.close();
