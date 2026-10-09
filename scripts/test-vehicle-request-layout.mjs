import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser = await chromium.launch({channel:'chrome',headless:true});
const results=[];
await mkdir('output/gallery-refresh/request-layout',{recursive:true});
for (const width of [1665,1440,1024,981,980,768,390,320]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  try {
    await page.goto((process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775')+'/cars/ferrari-f8-tributo-rental');
    await page.locator('[data-vehicle-request-form]').waitFor();
    if(width<=680) await page.locator('[data-vehicle-request-form]').evaluate(el=>el.classList.add('show-details'));
    const metrics=await page.locator('.vehicle-private-request').evaluate(panel=>{
      const p=panel.getBoundingClientRect(),style=getComputedStyle(panel),left=p.left+parseFloat(style.paddingLeft),right=p.right-parseFloat(style.paddingRight);
      const overflow=[...panel.querySelectorAll('input:not([type=hidden]),button,label')].filter(el=>!el.closest('[aria-hidden="true"]') && el.getClientRects().length && el.getBoundingClientRect().width>0).filter(el=>{const b=el.getBoundingClientRect();return b.left<left-1 || b.right>right+1}).map(el=>({tag:el.tagName,name:el.name,width:el.getBoundingClientRect().width}));
      const checkbox=panel.querySelector('[type=checkbox]').getBoundingClientRect();
      const submit=panel.querySelector('[type=submit]');
      return {overflow,checkboxWidth:checkbox.width,checkboxHeight:checkbox.height,submitHeight:submit.getBoundingClientRect().height,submitBackground:getComputedStyle(submit).backgroundColor};
    });
    assert.deepEqual(metrics.overflow,[],JSON.stringify(metrics));
    assert.ok(metrics.checkboxWidth<=24 && metrics.checkboxHeight<=24,JSON.stringify(metrics));
    assert.ok(metrics.submitHeight>=48,JSON.stringify(metrics));
    assert.equal(metrics.submitBackground,'rgb(240, 238, 232)');
    if([1665,390].includes(width))await page.locator('.vehicle-private-request').screenshot({path:`output/gallery-refresh/request-layout/after-${width}.png`});
    results.push({width,passed:true,...metrics});
  }catch(e){results.push({width,passed:false,error:e.message});}
  await page.close();
}
await browser.close();
await writeFile('output/gallery-refresh/request-layout/results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
process.exitCode=results.every(r=>r.passed)?0:1;
