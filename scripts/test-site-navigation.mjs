import {chromium} from 'playwright';import {readFileSync,mkdirSync} from 'node:fs';import {parseHTML} from 'linkedom';import assert from 'node:assert/strict';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775';
const urls=[...readFileSync('server-pages/sitemap.xml','utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
let referenceFooter;const nav=[['Fleet','/fleet'],['Weddings','/wedding'],['Consignment','/partner']];
for(const path of urls){const response=await fetch(base+path);assert.equal(response.status,200,path);const d=parseHTML(await response.text()).document;assert.equal(d.querySelectorAll('[data-shared-header]').length,1,path);assert.equal(d.querySelectorAll('body > footer').length,1,path);assert.deepEqual([...d.querySelectorAll('.desktop-nav a')].map(a=>[a.textContent,a.getAttribute('href')]),nav,path);const footer=[...d.querySelectorAll('.shared-site-footer a')].map(a=>[a.textContent,a.getAttribute('href')]);referenceFooter ||= footer;assert.deepEqual(footer,referenceFooter,path);}
console.log(`PASS shared header/footer on ${urls.length} public routes`);
for(const path of ['/quote','/agreement','/admin/']){const html=await(await fetch(base+path)).text();assert(!html.includes('data-shared-header'),path);}
const b=await chromium.launch({channel:'chrome',headless:true});mkdirSync('output/shared-navigation',{recursive:true});try{
for(const width of [1440,768,390,320])for(const path of ['/','/fleet','/about','/rental-policies','/wedding','/lamborghini','/locations/san-diego-exotic-car-rental','/cars/lamborghini-huracan-evo-spyder-rental']){
 const p=await b.newPage({viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+path);await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} ${width}`);
 if(width<=900){const toggle=p.locator('[data-menu-toggle]'),menu=p.locator('#site-mobile-menu');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await menu.getByRole('link',{name:'Weddings',exact:true}).waitFor({state:'visible'});await p.keyboard.press('Escape');assert(await menu.isHidden());assert(await toggle.evaluate(e=>e===document.activeElement));await toggle.click();await menu.getByRole('link',{name:'Weddings',exact:true}).click();await p.waitForURL('**/wedding');assert(await menu.isHidden());}
 else {assert(await p.locator('.desktop-nav').isVisible());assert(await p.locator('[data-menu-toggle]').isHidden());}
 assert.deepEqual(errors,[],`${path} ${width}`);
 if(path==='/about'&&(width===1440||width===390))await p.screenshot({path:`output/shared-navigation/about-${width}.png`});await p.close();
}
}finally{await b.close();}console.log('PASS desktop/mobile navigation, keyboard close, links and private exceptions');
