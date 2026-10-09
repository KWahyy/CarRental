import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [1440,768,390]){
const p=await b.newPage({viewport:{width,height:1800}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const slug of ['ferrari-f8-tributo-rental','lamborghini-aventador-svj-rental']){
await p.goto('http://127.0.0.1:8775/cars/'+slug);
assert.equal(await p.locator('.vehicle-private-rates,.vehicle-seo-facts').count(),0);
assert.equal(await p.locator('.vehicle-private-faq details').count(),6);
await p.locator('.vehicle-private-faq summary').first().click();assert.equal(await p.locator('.vehicle-private-faq details').first().getAttribute('open'),'');
assert.equal(await p.locator('[data-related] a').count(),3);
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);
if(slug.startsWith('ferrari')){await p.locator('.vehicle-private-information').screenshot({path:`output/gallery-refresh/overview-refined-${width}.png`});await p.locator('.vehicle-seo-details').screenshot({path:`output/gallery-refresh/guide-refined-${width}.png`});}
}await p.close();console.log(width,'passed');
}}finally{await b.close();}
