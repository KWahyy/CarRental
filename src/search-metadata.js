import { vehicleYear, publicVehicleSummary, vehicleFaqItems, vehicleSeoTitle, vehicleSeoDescription } from './vehicle-content.js';
import { brandFor } from './vehicle-brands.js';
export const SITE_URL = 'https://www.prestigeluxor.com';
const absolute = value => new URL(value || '/', SITE_URL).href;
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const usd = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value));
export function businessEntity() {
 return {'@type':['AutoRental','Organization'],'@id':SITE_URL+'/#business',name:'Prestige Luxor',url:SITE_URL+'/',logo:absolute('/assets/prestige-luxor-logo-dark.png'),image:absolute('/assets/prestige-luxor-search-preview.jpg'),telephone:'+1-949-620-0024',email:'Contact@prestigeluxor.com',description:'Delivery-only exotic and luxury car rentals in Southern California. Vehicles, dates, driver approval and delivery arrangements are confirmed before reservation.',areaServed:['Orange County, California','Los Angeles County, California','San Diego County, California','Riverside County, California'],sameAs:['https://www.instagram.com/prestige.luxor/']};
}
export function vehicleEntity(car, {price=car.price}={}) {
 const url=absolute('/cars/'+car.slug),year=vehicleYear(car),rate=Number(price);
 const images=[...new Set([...(car.gallery||[]),car.image].filter(Boolean))].map(absolute);
 return {'@type':['Product','Vehicle'],'@id':url+'#vehicle',name:car.name,url,description:publicVehicleSummary(car),image:images,brand:{'@type':'Brand',name:brandFor(car)},model:car.model,category:car.categoryLabel||car.category, ...(/^\d{4}$/.test(year)?{vehicleModelDate:year}:{}),...(car.color?{color:car.color}:{}),...(Number(car.seats)>0?{vehicleSeatingCapacity:Number(car.seats)}:{}),additionalProperty:[
  ...(car.mileage?[{'@type':'PropertyValue',name:'Included mileage',value:car.mileage}]:[]),
  {'@type':'PropertyValue',name:'Additional mileage',value:'$5 per mile'},
  {'@type':'PropertyValue',name:'Security deposit',value:'From $1,000; exact hold and release terms confirmed before payment'},
  {'@type':'PropertyValue',name:'Driver requirements',value:'18+ subject to vehicle approval; one year of driving experience, valid license and full-coverage insurance'}
 ],...(Number.isFinite(rate)&&rate>0?{offers:{'@type':'Offer',url,price:rate,priceCurrency:'USD',description:'Starting daily rental rate. Exact vehicle and requested dates require confirmation; delivery, mileage and other charges are quoted separately.',businessFunction:'http://purl.org/goodrelations/v1#LeaseOut',seller:{'@id':SITE_URL+'/#business'},priceSpecification:{'@type':'UnitPriceSpecification',price:rate,priceCurrency:'USD',unitText:'DAY'}}}:{})};
}
function script(document,id,data) {
 let el=document.getElementById(id);if(!el){el=document.createElement('script');el.id=id;el.type='application/ld+json';document.head.append(el);}el.textContent=json({'@context':'https://schema.org',...data});
}
function setMeta(document,attribute,key,value){let el=document.querySelector(`meta[${attribute}="${key}"]`);if(!el){el=document.createElement('meta');el.setAttribute(attribute,key);document.head.append(el);}el.setAttribute('content',value);}
export function applySearchMetadata(document,{car,price}={}) {
 if(/noindex/.test(document.querySelector('meta[name="robots"]')?.getAttribute('content')||'')&&!car)return;
 // Replace partial legacy entities with one complete, current business definition.
 const retained=[];
 document.querySelectorAll('script[type="application/ld+json"]').forEach(el=>{
  try{const data=JSON.parse(el.textContent);for(const entity of data['@graph']||[data]){
   const types=[entity['@type']].flat();
   if(types.some(t=>['Organization','LocalBusiness','AutoRental','BreadcrumbList','FAQPage'].includes(t)))continue;
   if(car&&types.some(t=>['Product','Vehicle','Car'].includes(t)))continue;
   retained.push(entity);
  }el.remove();}catch{}
 });
 const canonicalEl=document.querySelector('link[rel="canonical"]');
 const url=car?absolute('/cars/'+car.slug):canonicalEl?.getAttribute('href');if(!url)return;
 if(car){
  canonicalEl?.setAttribute('href',url);
  document.querySelectorAll('[data-vehicle-slug]').forEach(el=>el.setAttribute('data-vehicle-slug',car.slug));
  document.title=vehicleSeoTitle(car);setMeta(document,'name','description',vehicleSeoDescription(car,usd));
  setMeta(document,'name','robots','index, follow, max-image-preview:large');
  for(const prefix of ['og','twitter']){const attr=prefix==='og'?'property':'name';setMeta(document,attr,prefix+':title',document.title);setMeta(document,attr,prefix+':description',vehicleSeoDescription(car,usd));if(car.image)setMeta(document,attr,prefix+':image',absolute(car.image));setMeta(document,attr,prefix+':image:alt',car.name);}
  setMeta(document,'property','og:url',url);
 }
 const path=new URL(url).pathname;
 const crumbs=[{name:'Home',item:SITE_URL+'/'}];
 if(car)crumbs.push({name:'Fleet',item:SITE_URL+'/fleet'});
 else if(path.startsWith('/guides/'))crumbs.push({name:'Rental guides',item:SITE_URL+'/guides'});
 if(path!=='/')crumbs.push({name:car?.name||document.querySelector('h1')?.textContent.trim().replace(/\s+/g,' ')||document.title,item:url});
 const graph=[...retained,businessEntity(),...(car?[vehicleEntity(car,{price})]:[]),...(crumbs.length>1?[{'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,...c}))}]:[])];
 // Extract only the FAQs actually visible on this response, including updated CRM facts.
 let faqs;
 if(car)faqs=vehicleFaqItems(car,usd);
 else faqs=[...document.querySelectorAll('main details')].map(el=>{const summary=el.querySelector('summary')?.cloneNode(true);summary?.querySelectorAll('span').forEach(s=>s.remove());return {question:summary?.textContent.trim(),answer:[...el.querySelectorAll('p')].map(p=>p.textContent.trim()).join(' ')};}).filter(f=>f.question&&f.answer);
 if(faqs?.length)graph.push({'@type':'FAQPage','@id':url+'#faq',mainEntity:faqs.map(f=>({'@type':'Question',name:f.question,acceptedAnswer:{'@type':'Answer',text:f.answer}}))});
 script(document,'search-entities',{'@graph':graph});
}
export function sitemapXml(pages,fleet) {
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const entries=[...new Set(pages)].map(path=>({url:absolute('/'+path.replace(/^\//,''))}));
 for(const car of fleet){if(!/^[a-z0-9][a-z0-9-]*$/.test(car.slug))continue;const date=car.updated_at||car.updatedAt;entries.push({url:absolute('/cars/'+car.slug),lastmod:date&&!Number.isNaN(Date.parse(date))&&Date.parse(date)<=Date.now()?new Date(date).toISOString():null});}
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+entries.map(e=>`  <url><loc>${escape(e.url)}</loc>${e.lastmod?`<lastmod>${e.lastmod}</lastmod>`:''}</url>`).join('\n')+'\n</urlset>\n';
}
