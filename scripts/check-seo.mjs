import { parseHTML } from 'linkedom';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fleet } from '../dist/src/fleet-data.js';
const exists = p => existsSync(`dist/${p}`) || existsSync(`server-pages/${p}`);
const read = p => readFileSync(existsSync(`dist/${p}`) ? `dist/${p}` : `server-pages/${p}`, 'utf8');
const sitemap = read('sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
for (const slug of ['san-diego-exotic-car-rental','palm-springs-exotic-car-rental']) assert(urls.includes(`https://www.prestigeluxor.com/locations/${slug}`), `Missing ${slug}`);
for (const make of ['porsche','rolls-royce']) assert(urls.includes(`https://www.prestigeluxor.com/${make}`), `Missing ${make}`);
for (const guide of ['guides', 'guides/lamborghini-rental-cost-southern-california', 'guides/lamborghini-huracan-vs-urus-rental', 'guides/exotic-car-delivery-hotels-airports']) assert(urls.includes(`https://www.prestigeluxor.com/${guide}`), `Missing ${guide}`);
for (const car of fleet) assert(read('fleet.html').includes(`href="/cars/${car.slug}"`), `Fleet HTML cannot link to ${car.slug}`);
for (const url of urls) {
 const path = new URL(url).pathname;
 const file = path === '/' ? 'index.html' : `${path.slice(1)}.html`;
 assert(exists(file), `Missing ${file}`);
 const html = read(file);
 assert(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html), `noindex: ${path}`);
 assert.equal([...html.matchAll(/<link rel="canonical"/g)].length,1,`Canonical count ${path}`);
 assert(html.includes(`rel="canonical" href="${url}"`),`Canonical mismatch ${path}`);
 assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,`H1 count ${path}`);
 assert(!/href="(?:https:\/\/www\.prestigeluxor\.com)?\/[^"?#]*\.html(?:[?#"])/.test(html), `Legacy link ${path}`);
 for (const [,raw] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(raw);
 for (const [,href] of html.matchAll(/href="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
  if(href.startsWith('//') || /\.[a-z0-9]+$/i.test(href) || href.startsWith('/admin') || href==='/') continue;
  assert(exists(`${href.slice(1)}.html`) || exists(`${href.slice(1)}/index.html`),`Broken link ${path} -> ${href}`);
 }
}
for(const car of fleet) {
 const html=read(`cars/${car.slug}.html`);
 assert(html.includes('class="vehicle-private-page"'),`Missing product shell ${car.slug}`);
 const image=parseHTML(html).document.querySelector('[data-gallery-main]');
 assert(image?.getAttribute('src'),`Missing initial image ${car.slug}`);
 assert(Number(image.getAttribute('width'))>0 && Number(image.getAttribute('height'))>0,`Unreserved product image ${car.slug}`);
 assert(html.includes('data-vehicle-seo'),`Missing rental facts ${car.slug}`);
}
console.log(`PASS: ${urls.length} indexable pages; ${fleet.length} crawlable vehicles; canonicals, links, headings and JSON-LD verified.`);
