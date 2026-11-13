import {loadPublicInventory} from '../src/public-inventory.js';
import {buildProductFeed,productFeedCsv} from '../src/chatgpt-product-feed.js';
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Method not allowed'});}
 try{
  const {fleet}=await loadPublicInventory({timeout:10000});
  const {products,skipped}=buildProductFeed(fleet);
  if(!products.length)throw new Error('No valid products');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','inline; filename="prestige-luxor-fleet.csv"');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');
  res.setHeader('X-Product-Count',String(products.length));
  res.setHeader('X-Skipped-Count',String(skipped.length));
  return res.status(200).send(req.method==='HEAD'?'':productFeedCsv(products));
 }catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Fleet feed temporarily unavailable. Please retry.'});}
}
