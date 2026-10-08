import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fleet } from '../dist/src/fleet-data.js';
const read = p => readFileSync(`dist/${p}`, 'utf8');
const sitemap = read('sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
for (const slug of ['san-diego-exotic-car-rental','palm-springs-exotic-car-rental']) assert(urls.includes(`https://www.prestigeluxor.com/locations/${slug}`), `Missing ${slug}`);
for (const make of ['porsche','rolls-royce']) assert(urls.includes(`https://www.prestigeluxor.com/${make}`), `Missing ${make}`);
for (const car of fleet) assert(read('fleet.html').includes(`href="/cars/${car.slug}"`), `Fleet HTML cannot link to ${car.slug}`);
for (const url of urls) {
 const path = new URL(url).pathname;
 const file = path === '/' ? 'index.html' : `${path.slice(1)}.html`;
 assert(existsSync(`dist/${file}`), `Missing ${file}`);
 const html = read(file);
 assert(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html), `noindex: ${path}`);
 assert.equal([...html.matchAll(/<link rel="canonical"/g)].length,1,`Canonical count ${path}`);
 assert(html.includes(`rel="canonical" href="${url}"`),`Canonical mismatch ${path}`);
 assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,`H1 count ${path}`);
 assert(!/href="(?:https:\/\/www\.prestigeluxor\.com)?\/[^"?#]*\.html(?:[?#"]) /.test(html), `Legacy link ${path}`);
 for (const [,raw] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(raw);
 for (const [,href] of html.matchAll(/href="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
  if(href.startsWith('//') || /\.[a-z0-9]+$/i.test(href) || href.startsWith('/admin') || href==='/') continue;
  assert(existsSync(`dist${href}.html`) || existsSync(`dist${href}/index.html`),`Broken link ${path} -> ${href}`);
 }
}
for(const car of fleet) {
 const html=read(`cars/${car.slug}.html`);
 assert(html.includes('class="vehicle-private-page"'),`Missing product shell ${car.slug}`);
 assert(/data-gallery-main[^>]*src=/.test(html),`Missing initial image ${car.slug}`);
 assert(html.includes('data-vehicle-seo'),`Missing rental facts ${car.slug}`);
}
console.log(`PASS: ${urls.length} indexable pages; ${fleet.length} crawlable vehicles; canonicals, links, headings and JSON-LD verified.`);
