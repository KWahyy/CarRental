import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775';
const out='output/home-motion';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
try {
 for(const width of [1440,768,390]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.motionCLS=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.motionCLS+=e.value}).observe({type:'layout-shift',buffered:true});});
  await page.goto(base);await page.waitForTimeout(400);
  // Regression: a card already visible must not jump after a stagger delay.
  const jitter=await page.evaluate(async()=>{
   const card=document.querySelectorAll('.home-delivery-card')[3];
   scrollTo({top:card.getBoundingClientRect().top+scrollY-innerHeight+120,behavior:'instant'});
   const positions=[];
   for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);positions.push(card.getBoundingClientRect().top+scrollY);}
   return Math.max(...positions)-Math.min(...positions);
  });
  assert(jitter<1,`Visible card jumped ${jitter}px at ${width}px`);
  const target=await page.locator('.home-delivery-card').first().evaluate(el=>el.getBoundingClientRect().top+scrollY);
  const sample=async y=>{await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await settle(page);return page.locator('.home-delivery-card img').first().evaluate(el=>getComputedStyle(el).transform);};
  const y=Math.max(0,target-550),start=await sample(y),end=await sample(y+400),reverse=await sample(y);
  assert.notEqual(start,end,'Scroll must actually animate imagery');
  assert.equal(start,reverse,'Same scroll position must give identical image transform');
  await page.waitForTimeout(500);
  assert.equal(start,await page.locator('.home-delivery-card img').first().evaluate(el=>getComputedStyle(el).transform),'No delayed motion after stopping');
  await page.screenshot({path:`${out}/revised-${width}.png`});
  for(const offset of [5000,900,8000,1200,0]){await sample(offset);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.goto(base+'/#quote');await settle(page);
  assert(await page.locator('[data-car-trigger]').isVisible());
  assert.equal(await page.evaluate(()=>document.getAnimations().some(a=>a.id==='prestige-entrance')),false);
  await page.emulateMedia({reducedMotion:'reduce'});await settle(page);
  assert.equal(await page.locator('.home-delivery-card img').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});await sample(y);
  assert.notEqual(await sample(y+400),await sample(y));
  const cls=await page.evaluate(()=>window.motionCLS);assert(cls<.1,`CLS ${cls}`);assert.deepEqual(errors,[]);
  report.push({width,jitter,cls,scrollLinked:true,reversible:true,errors});console.log('PASS',report.at(-1));await page.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const page=await context.newPage();await page.goto(base);assert(await page.locator('#home-fleet-title').isVisible());assert(await page.locator('#quote-title').isVisible());await context.close();
 writeFileSync(out+'/results.json',JSON.stringify(report,null,2));
} finally {await browser.close();}
