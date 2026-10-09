import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
for(const width of [1440,768,390]){
 const page=await browser.newPage({viewport:{width,height:1100}});
 for(const slug of ['ferrari-f8-tributo-rental','lamborghini-aventador-svj-rental']){
 await page.goto('http://127.0.0.1:8775/cars/'+slug);
 const bounds=await page.locator('.vehicle-private-hero').evaluate(el=>{const b=s=>el.querySelector(s).getBoundingClientRect().toJSON();return{title:b('.vehicle-private-title-card'),gallery:b('.vehicle-gallery-stage'),heading:b('h1'),overflow:document.documentElement.scrollWidth>innerWidth};});
 if(width>680){
 assert.ok(bounds.gallery.left>bounds.title.left,'Gallery sits on the right');
 assert.ok(bounds.gallery.left-bounds.title.right>=19,'Panels have a clear gap');
 assert.ok(bounds.title.top<bounds.gallery.top && bounds.title.bottom>bounds.gallery.bottom,'Text panel is taller than gallery');
 }else assert.ok(bounds.gallery.top>=bounds.title.bottom,'Mobile layout remains readable');
 assert.equal(bounds.overflow,false);
 assert.ok(bounds.heading.left>=bounds.title.left && bounds.heading.right<=bounds.title.right);
 await page.locator('[data-gallery-next]').click();assert.equal(await page.locator('[data-gallery-dots] button').nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('[data-gallery-prev]').click();
 if(slug.startsWith('ferrari'))await page.locator('.vehicle-private-hero').screenshot({path:`output/gallery-refresh/side-by-side-${width}.png`});
 }
 await page.close();console.log(width,'passed');
}
}finally{await browser.close();}
