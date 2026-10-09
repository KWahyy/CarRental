import { brandFor } from './vehicle-brands.js';
export const escapeFleetText = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function fleetCategory(car) {
  const category = String(car.category || '').toLowerCase();
  if (/truck/i.test(`${car.name} ${category}`)) return 'Truck';
  if (fleetCategories(car).includes('Classics')) return 'Classic';
  if (/suv/.test(category)) return 'SUV';
  if (/luxury/.test(category)) return 'Luxury';
  return 'Exotic';
}
export function fleetCategories(car) {
  const category=String(car.category || '').toLowerCase();
  const text=[car.name,car.model,car.category,car.categoryLabel,...(car.tags || [])].join(' ').toLowerCase();
  const year=Number(car.year || String(car.name || '').match(/^(\d{4})\b/)?.[1]);
  const classic=/classic|vintage/.test(category) || (year>1900 && year<1990);
  const truck=/truck|f-?150|raptor/.test(text);
  const suv=!truck && /suv|urus|cullinan|escalade|range rover|defender|g63|g-wagon|gls/.test(text);
  const convertible=/convertible|cabriolet|\bspyder\b|\bspider\b|\bgtc\b|\bcielo\b|\bdawn\b/.test(text);
  const sedan=!suv && !truck && !convertible && /sedan|\bm[35]\b|s[ -]?(580|680|500|class)|panamera|flying spur|ghost|phantom/.test(text);
  const exotic=!classic && !truck && !suv && /supercar|exotic/.test(category);
  const result=[];
  if(exotic)result.push('Exotics');
  if(convertible)result.push('Convertibles');
  if(suv)result.push('Luxury SUVs');
  if(sedan && !classic)result.push('Luxury sedans');
  if(classic)result.push('Classics');
  if(!exotic && !classic && !truck && !suv && !sedan && !convertible && /luxury|coupe/.test(text))result.push('Luxury coupes');
  if(truck)result.push('Trucks');
  return result;
}
export const HOME_FLEET_CATEGORIES=['All','Exotics','Convertibles','Luxury SUVs','Luxury sedans','Classics','Luxury coupes','Trucks'];
export function homeFleetFilters(cars,query='',brand='') {
  const matching=filterHomeFleet(cars,query,'All',brand);
  return HOME_FLEET_CATEGORIES.filter(category=>category==='All'||cars.some(car=>fleetCategories(car).includes(category))).map(category=>({category,label:category==='All'?'All cars':category,count:category==='All'?matching.length:matching.filter(car=>fleetCategories(car).includes(category)).length}));
}
export function homeFleetFilterMarkup(cars) {
  return homeFleetFilters(cars).map(({category,label})=>`<button type="button" data-category="${category}" aria-pressed="${category==='All'}">${label}</button>`).join('');
}
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/benz/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export function filterHomeFleet(cars, query = '', category = 'All', brand = '') {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return cars.filter(car => {
    const haystack = normalize([brandFor(car),car.name,car.make,car.model,car.color,car.category,car.categoryLabel,...(car.tags || [])].join(' '));
    return (!brand || brandFor(car) === brand) && (category === 'All' || (HOME_FLEET_CATEGORIES.includes(category) ? fleetCategories(car).includes(category) : fleetCategory(car) === category)) && words.every(word=>haystack.includes(word));
  });
}
// Curated merchandising order; availability and prices still come from Supabase.
export const FEATURED_FLEET_SLUGS = Object.freeze([
  'mclaren-720s-spider-rental',
  'porsche-911-gt3-rs-rental',
  'lamborghini-huracan-evo-spyder-rental',
  'lamborghini-urus-performante-rental',
  'ferrari-f8-tributo-rental',
  'mclaren-750s-rental',
  'mercedes-amg-g63-rental',
  'ferrari-roma-rental',
  'rolls-royce-cullinan-black-badge-rental',
  'lamborghini-urus-s-rental',
  'mclaren-570s-rental',
]);
const featuredRank = new Map(FEATURED_FLEET_SLUGS.map((slug,index)=>[slug,index]));
export const sortHomeFleet = cars => [...cars].sort((a,b)=>
  (featuredRank.get(a.slug) ?? Infinity) - (featuredRank.get(b.slug) ?? Infinity)
  || `${a.make || ''} ${a.model || ''} ${a.name}`.localeCompare(`${b.make || ''} ${b.model || ''} ${b.name}`)
);
export function homeFleetCard(car, picture) {
  const esc = escapeFleetText;
  const name = String(car.name || '').replace(/^\d{4}\s+/, '');
  const year = String(car.name || '').match(/^\d{4}/)?.[0];
  const detail = [year,car.color].filter(Boolean).join(' · ');
  const rate = Number(car.price) > 0 ? `<span>from <strong>${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(car.price)}</strong>/day</span>` : '<span>Request rate</span>';
  return `<article class="home-fleet-card"><a href="/cars/${encodeURIComponent(car.slug)}" aria-label="View ${esc(car.name)}"><div class="home-fleet-photo">${picture || `<img src="${esc(car.image)}" alt="${esc(car.name)}" width="600" height="400" loading="lazy" decoding="async" />`}<span class="home-fleet-badge">${fleetCategory(car)}</span></div><div class="home-fleet-card-body"><h3>${esc(name)}</h3><p>${esc(detail || car.categoryLabel)}</p><div class="home-fleet-card-bottom">${rate}<span class="home-fleet-card-cta">View car <span aria-hidden="true">↗</span></span></div></div></a></article>`;
}
