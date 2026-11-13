const origin='https://www.prestigeluxor.com';
export const columns=['item_id','title','description','url','brand','seller_name','seller_url','image_url','additional_image_urls','price','availability','is_ads_eligible','is_eligible_checkout'];
function publicUrl(value){try{const u=new URL(value,origin);return value&&u.protocol==='https:'?u.href:'';}catch{return '';}}
export function buildProductFeed(fleet){
 const products=[],skipped=[],seen=new Set();
 for(const car of fleet){
  const slug=car.slug,price=Number(car.price);
  const photos=[...new Set([car.image_url,...[...(car.car_photos||[])].sort((a,b)=>a.position-b.position).map(p=>p.url)].map(publicUrl).filter(Boolean))];
  if(car.is_active===false)continue;
  if(!/^[a-z0-9][a-z0-9-]*$/.test(slug||'')||!car.name||!car.make||!Number.isFinite(price)||price<=0||!photos.length||seen.has(slug)){skipped.push({slug,reason:'Missing/invalid required fields or duplicate ID'});continue;}
  seen.add(slug);
  products.push({item_id:slug,title:`${car.name} — Daily Rental`.slice(0,150),description:[`${car.name} daily car rental from Prestige Luxor in Southern California.`,car.summary||'',car.seats?`${car.seats} seats.`:'',`Starting daily rental rate: $${price.toFixed(2)} USD. Service areas include Orange County, Los Angeles, San Diego and Palm Springs. Availability, delivery charges, deposit and final total are confirmed personally before booking.`].filter(Boolean).join(' ').replace(/<[^>]*>/g,'').slice(0,5000),url:`${origin}/cars/${slug}`,brand:car.make,seller_name:'Prestige Luxor',seller_url:origin,image_url:photos[0],additional_image_urls:JSON.stringify(photos.slice(1)),price:`${price.toFixed(2)} USD`,availability:'unknown',is_ads_eligible:'true',is_eligible_checkout:'false'});
 }
 return {products,skipped};
}
export function productFeedCsv(products){const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [columns.join(','),...products.map(p=>columns.map(k=>cell(p[k])).join(','))].join('\r\n')+'\r\n';}
