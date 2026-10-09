import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8772';
const output='output/seo/2026-10-09';await mkdir(output,{recursive:true});
const response=await fetch(base+'/sitemap.xml');assert.equal(response.status,200);
const xml=await response.text(),urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
assert.equal(new Set(urls).size,urls.length);assert(!urls.some(u=>/\/(admin|quote|agreement)(\/|$|\?)/.test(u)));
const robots=await (await fetch(base+'/robots.txt')).text();assert.match(robots,/User-agent: \*\s+Allow: \//);assert.match(robots,/Sitemap: https:\/\/www.prestigeluxor.com\/sitemap.xml/);
const rows=[],titles=new Set(),descriptions=new Set();
for(const url of urls){
 const path=new URL(url).pathname,r=await fetch(base+path),html=await r.text(),{document:d}=parseHTML(html);
 assert.equal(r.status,200,path);assert.equal(d.querySelectorAll('h1').length,1,path);assert.equal(d.querySelectorAll('link[rel="canonical"]').length,1,path);assert.equal(d.querySelector('link[rel="canonical"]').href,url,path);assert(!/noindex/.test(d.querySelector('meta[name="robots"]')?.content||''),path);
 assert(!titles.has(d.title),'Duplicate title '+path);titles.add(d.title);const description=d.querySelector('meta[name="description"]')?.content;assert(description,'Missing description '+path);assert(!descriptions.has(description),'Duplicate description '+path);descriptions.add(description);
 assert.equal(d.querySelectorAll('.seo-delivery-nav').length,path.startsWith('/cars/')?0:1,'Repeated/missing exploration nav '+path);
 const entities=[...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(el=>{const j=JSON.parse(el.textContent);return j['@graph']||[j]});
 const business=entities.filter(e=>[e['@type']].flat().includes('AutoRental'));assert.equal(business.length,1,path);assert.equal(business[0].address,undefined);assert.equal(business[0].aggregateRating,undefined);
 if(path!=='/')assert.equal(entities.filter(e=>e['@type']==='BreadcrumbList').length,1,path);
 const vehicle=entities.find(e=>[e['@type']].flat().includes('Vehicle'));
 if(path.startsWith('/cars/')){assert(vehicle,path);assert.equal(vehicle.url,url);assert(vehicle.offers.price>0);assert.equal(vehicle.offers.availability,undefined);assert(vehicle.image.every(src=>src.startsWith('https://')));assert.equal(d.querySelector('meta[property="og:title"]').content,d.title);assert(d.querySelector('[data-vehicle-request-form]'));}
 const faq=entities.find(e=>e['@type']==='FAQPage');
 if(faq){const text=d.querySelector('main').textContent.replace(/\s+/g,' ');for(const q of faq.mainEntity){assert(text.includes(q.name.replace(/\s+/g,' ')),'Invisible FAQ question '+path);assert(text.includes(q.acceptedAnswer.text.replace(/\s+/g,' ')),'Invisible FAQ answer '+path);}}
 assert.equal(d.querySelectorAll('img:not([alt])').length,0,path);
 rows.push({path,status:r.status,title:d.title,description,schemaTypes:entities.map(e=>e['@type']),vehicle:!!vehicle,faqCount:faq?.mainEntity.length||0,htmlBytes:Buffer.byteLength(html)});
}
for(const path of ['/quote','/agreement','/admin/']){const r=await fetch(base+path);if(path==='/admin/'&&r.status===404)continue;const html=await r.text();assert(/noindex/.test(r.headers.get('x-robots-tag')||'')||/noindex/.test(parseHTML(html).document.querySelector('meta[name="robots"]')?.content||''),'Private indexability '+path);}
await writeFile(output+'/search-readiness.json',JSON.stringify({pages:rows.length,vehicles:rows.filter(r=>r.vehicle).length,robots,results:rows},null,2));console.log(`PASS: ${rows.length} raw HTML pages; unique metadata, canonical URLs, visible schema, business identity, breadcrumbs, image alt text and private exclusions.`);
