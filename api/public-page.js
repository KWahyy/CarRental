import sitemapHandler from '../src/server-sitemap.js';
import { renderPrivateDocument } from '../src/private-render.js';
import quoteHandler from './quotes-public.js';
import agreementHandler from './agreements-public.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPublicDocument } from '../src/public-render.js';
import { loadPublicInventory } from '../src/public-inventory.js';

export function publicPagePath(value) {
  const page = String(value || 'index').replace(/^\//, '').replace(/\.html$/, '');
  if (/^(index|fleet|lamborghini|ferrari|wedding|quote|agreement|cars\/[a-z0-9][a-z0-9-]*)$/.test(page)) return page;
  return null;
}

export default async function handler(req, res) {
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  if (query.page === 'sitemap') return sitemapHandler(req, res);
  const page = publicPagePath(query.page);
  if (!page) return res.status(404).send('Page not found');
  let html;
  try { html = await readFile(join(process.cwd(), 'server-pages', page + '.html'), 'utf8'); }
  catch { if (!page.startsWith('cars/')) return res.status(404).send('Page not found'); }
  if (page === 'quote' || page === 'agreement') {
    let payload = {};
    if (query.token) {
      // Reuse the existing token authorization and public-field allowlist.
      const capture = {status(){return this;},setHeader(){return this;},json(data){payload=data;return this;},end(body){if(body)payload=JSON.parse(body);return this;}};
      await (page === 'quote' ? quoteHandler : agreementHandler)({...req,method:'GET',query:{token:query.token}},capture);
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    return res.status(200).send(renderPrivateDocument(html,page,payload));
  }
  const search = new URLSearchParams(Object.entries(query).filter(([key])=>key!=='page')).toString();
  try {
    const { fleet, ...options } = await loadPublicInventory();
    // An archived vehicle must not continue advertising a bookable listing.
    if (page.startsWith('cars/') && !fleet.some(car => car.slug === page.slice(5))) {
      res.setHeader('X-Robots-Tag','noindex');
      return res.status(404).send('Vehicle no longer listed. Browse the current fleet at /fleet.');
    }
    if (!html) {
      html = await readFile(join(process.cwd(),'server-pages','vehicle-template.html'),'utf8');
      html = html.replace(/data-vehicle-slug="[^"]*"/g, `data-vehicle-slug="${page.slice(5)}"`);
    }
    html = renderPublicDocument(html, fleet, { ...options, path: '/' + page, search });
    res.setHeader('X-Inventory-Source', 'live');
  } catch (error) {
    if (!html) { res.setHeader('Retry-After','60'); return res.status(503).send('Vehicle details temporarily unavailable. Please try again.'); }
    // Complete build-time HTML and its matching state remain usable during an outage.
    console.warn('Serving consistent inventory snapshot:', error.message);
    res.setHeader('X-Inventory-Source', 'build-fallback');
    const embedded=html.match(/<script[^>]*id="public-page-state"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if(embedded){const state=JSON.parse(embedded);html=renderPublicDocument(html,state.fleet,{...state,path:'/'+page,search});}
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).send(html);
}
