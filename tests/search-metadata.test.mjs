import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';
import {applySearchMetadata,vehicleEntity,sitemapXml} from '../src/search-metadata.js';import {renderPublicDocument} from '../src/public-render.js';import handler from '../api/public-page.js';import sitemapHandler from '../api/sitemap.js';
const car={slug:'new-approved-car',name:'2025 Ferrari Example',make:'Ferrari',model:'Example',category:'exotic',category_label:'Exotic',price:2100,seats:2,mileage:'100 miles/day',color:'Blue',summary:'A verified test fixture.',tags:[],details:[],car_photos:[{position:0,url:'/new-car.jpg'}]};
const response=()=>({code:200,headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;return this;},send(body){this.body=body;return this;}});
const entities=doc=>JSON.parse(doc.querySelector('#search-entities').textContent)['@graph'];
test('current CRM facts replace all vehicle metadata, FAQs and absolute photo URLs',()=>{
 const raw=readFileSync('server-pages/vehicle-template.html','utf8').replace(/data-vehicle-slug="[^"]*"/g,`data-vehicle-slug="${car.slug}"`);
 const d=parseHTML(renderPublicDocument(raw,[car])).document,j=entities(d),vehicle=j.find(e=>e['@type']?.includes('Vehicle'));
 assert.equal(vehicle.offers.price,2100);assert.equal(vehicle.offers.availability,undefined);assert.equal(vehicle.color,'Blue');assert.equal(vehicle.vehicleModelDate,'2025');assert.equal(vehicle.image[0],'https://www.prestigeluxor.com/new-car.jpg');assert.match(d.title,/Ferrari Example/);assert.equal(d.querySelector('meta[property="og:title"]').content,d.title);assert.match(j.find(e=>e['@type']==='FAQPage').mainEntity[0].acceptedAnswer.text,/2,100/);assert.equal(d.querySelector('link[rel="canonical"]').href,'https://www.prestigeluxor.com/cars/new-approved-car');
});
test('metadata normalization is idempotent and never fabricates address or ratings',()=>{
 const d=parseHTML(readFileSync('server-pages/index.html','utf8')).document;applySearchMetadata(d);const first=entities(d);applySearchMetadata(d);assert.deepEqual(entities(d),first);const b=first.find(e=>e['@type']?.includes('AutoRental'));assert.equal(b.address,undefined);assert.equal(b.aggregateRating,undefined);assert.ok(first.some(e=>e['@type']==='WebSite'));
});
test('unknown rates never become zero-priced offers; malformed and future lastmod excluded',()=>{
 for(const price of [null,0,-1,'unknown',undefined])assert.equal(vehicleEntity({...car,gallery:[],price}).offers,undefined);
 const xml=sitemapXml(['','fleet'],[{slug:car.slug,updated_at:'invalid'},{slug:'other',updated_at:'2999-01-01'},{slug:'../../admin'}]);assert.ok(!xml.includes('<lastmod>'));assert.ok(!xml.includes('admin'));assert.ok(xml.includes('/cars/new-approved-car'));
});
test('new active cars added after deployment get an indexable current page and live sitemap',async t=>{
 t.mock.method(globalThis,'fetch',async url=>new Response(JSON.stringify(String(url).includes('/cars?')?[car]:[])));
 const res=response();await handler({query:{page:'cars/'+car.slug}},res);assert.equal(res.code,200);const d=parseHTML(res.body).document;assert.match(d.querySelector('h1').textContent,/Ferrari Example/);assert.equal(entities(d).find(e=>e['@type']?.includes('Vehicle')).offers.price,2100);
 const sm=response();await sitemapHandler({},sm);assert.match(sm.body,/cars\/new-approved-car/);assert.ok(!sm.body.includes('/cars/audi-r8-rental'));assert.ok(!sm.body.includes('/admin'));assert.equal(sm.headers['X-Inventory-Source'],'live');
});
test('unknown cars fail closed; inventory outages do not fabricate new pages',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('[]'));let res=response();await handler({query:{page:'cars/not-in-inventory'}},res);assert.equal(res.code,404);assert.equal(res.headers['X-Robots-Tag'],'noindex');
 globalThis.fetch=async()=>{throw Error('offline')};res=response();await handler({query:{page:'cars/not-in-inventory'}},res);assert.equal(res.code,503);const sm=response();await sitemapHandler({},sm);assert.equal(sm.headers['X-Inventory-Source'],'build-fallback');assert.match(sm.body,/cars\/ferrari-f8-tributo-rental/);
});
