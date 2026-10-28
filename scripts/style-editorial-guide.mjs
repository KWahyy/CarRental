import {parseHTML} from 'linkedom';

const guidePhotos = {
 'lamborghini-urus-vs-rolls-royce-cullinan': [/urus s/i,/cullinan/i],
 'ferrari-rental-cost-southern-california': [/ferrari roma/i,/ferrari f8/i],
 'lamborghini-rental-cost-southern-california': [/hurac[aá]n.*spyder/i,/urus s/i],
 'lamborghini-huracan-vs-urus-rental': [/hurac[aá]n.*spyder/i,/urus s/i],
 'exotic-car-delivery-hotels-airports': [/cullinan/i,/escalade/i],
 'exotic-car-rental-cost-southern-california': [/mclaren 720/i,/ferrari roma/i],
 'choosing-exotic-car-rental': [/porsche.*cabriolet/i,/urus s/i],
 'audi-r8-rental-cost': [/audi r8/i],
 'orange-county-exotic-car-weekend': [/ferrari roma/i,/continental/i],
 'san-diego-convertible-or-suv-rental': [/continental/i,/urus s/i],
 'wedding-car-rental-checklist': [/cullinan/i,/wraith/i]
};
export function editorialCars(page, inventory) {
 const patterns=guidePhotos[page.path.split('/').at(-1)]||[];
 return [...new Set(patterns.map(pattern=>inventory.find(c=>pattern.test(c.name)&&(c.image_url||c.car_photos?.length))).filter(Boolean))];
}
export function styleEditorialIndex(html, pages, inventory, picture) {
 const {document:d}=parseHTML(html);
 d.body.classList.add('editorial-guide','editorial-journal');
 const css=d.createElement('link');css.rel='stylesheet';css.href='/src/editorial-guide.css';d.head.append(css);
 d.querySelector('.seo-page-hero .eyebrow').textContent='THE PRESTIGE LUXOR JOURNAL';
 d.querySelector('.seo-page-actions')?.remove();
 const copy=d.querySelector('.seo-copy');copy.classList.add('journal-grid');
 [...copy.children].forEach((section,i)=>{
  const page=pages[i],photos=editorialCars(page,inventory);
  const car=photos[/vs-|convertible-or-suv/.test(page.path)&&photos.length>1?1:0];
  if(!car)return;
  const a=d.createElement('a');a.className='journal-image';a.href='/'+page.path;a.setAttribute('aria-label',page.heading);
  a.innerHTML=picture(car,{alt:car.name,loading:i<2?'eager':'lazy'});section.prepend(a);
 });
 return '<!doctype html>\n'+d.documentElement.outerHTML;
}
export function styleEditorialGuide(html, page, inventory, picture) {
 const comparison=/vs-|convertible-or-suv/.test(page.path);
 const cars=editorialCars(page,inventory);
 const {document:d}=parseHTML(html);
 d.body.classList.add('editorial-guide');
 const css=d.createElement('link');css.rel='stylesheet';css.href='/src/editorial-guide.css';d.head.append(css);
 const hero=d.querySelector('.seo-page-hero');
 const back=d.createElement('a');back.className='editorial-back';back.href='/guides';back.textContent='Journal / Rental guides';hero.prepend(back);
 hero.querySelector('.eyebrow').textContent=comparison?'THE COMPARISON':'THE RENTAL GUIDE';
 hero.querySelector('.seo-page-actions')?.remove();
 const minutes=Math.max(1,Math.ceil(d.querySelector('.seo-copy').textContent.split(/\s+/).length/220));
 const date=new Date(page.datePublished+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
 const meta=d.createElement('p');meta.className='editorial-byline';meta.textContent=`By Prestige Luxor  ·  ${date}  ·  ${minutes} min read`;hero.append(meta);
 const figure=(car,lazy=false)=>{
  const f=d.createElement('figure');f.className='editorial-photo';
  f.innerHTML=picture(car,{alt:car.name,loading:lazy?'lazy':'eager'});
  const cap=d.createElement('figcaption');const a=d.createElement('a');a.href='/cars/'+car.slug;a.textContent=car.name+' — View vehicle ↗';cap.append(a);f.append(cap);return f;
 };
 if(cars.length){const gallery=d.createElement('div');gallery.className='editorial-cover'+(comparison?' editorial-cover-pair':'');gallery.append(figure(cars[0]));if(comparison&&cars[1])gallery.append(figure(cars[1]));hero.after(gallery);}
 const copy=d.querySelector('.seo-copy');
 const note=copy.querySelector('.guide-note');if(note)note.textContent='Your selected vehicle, dates and final total are confirmed by our team. Any rates shown are starting daily prices from our listed fleet.';
 const layout=d.createElement('div');layout.className='editorial-layout';copy.before(layout);
 const nav=d.createElement('nav');nav.className='editorial-index';nav.setAttribute('aria-label','In this article');
 const label=d.createElement('p');label.textContent='IN THIS ARTICLE';nav.append(label);
 [...copy.querySelectorAll(':scope > section')].forEach((section,i)=>{section.id='article-section-'+(i+1);const title=section.querySelector('h2');if(!title)return;const a=d.createElement('a');a.href='#'+section.id;a.textContent=title.textContent;nav.append(a);});
 layout.append(nav,copy);
 if(!comparison&&cars[1])copy.querySelectorAll(':scope > section')[2]?.after(figure(cars[1],true));
 return '<!doctype html>\n'+d.documentElement.outerHTML;
}
