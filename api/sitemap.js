import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPublicInventory } from '../src/public-inventory.js';
import { sitemapXml } from '../src/search-metadata.js';
export default async function handler(req,res) {
 const snapshot=JSON.parse(await readFile(join(process.cwd(),'server-pages/seo-routes.json'),'utf8'));
 let fleet=snapshot.fleet;
 try { ({fleet}=await loadPublicInventory()); res.setHeader('X-Inventory-Source','live'); }
 catch { res.setHeader('X-Inventory-Source','build-fallback'); }
 res.setHeader('Content-Type','application/xml; charset=utf-8');
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');
 return res.status(200).send(sitemapXml(snapshot.pages,fleet));
}
