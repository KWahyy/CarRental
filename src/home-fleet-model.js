export const escapeFleetText = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function fleetCategory(car) {
  const category = String(car.category || '').toLowerCase();
  if (/truck/i.test(car.name)) return 'Truck';
  if (/classic/.test(category)) return 'Classic';
  if (/suv/.test(category)) return 'SUV';
  if (/luxury/.test(category)) return 'Luxury';
  return 'Exotic';
}
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/benz/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export function filterHomeFleet(cars, query = '', category = 'All') {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return cars.filter(car => {
    const haystack = normalize([car.name,car.make,car.model,car.color,car.category,car.categoryLabel,...(car.tags || [])].join(' '));
    return (category === 'All' || fleetCategory(car) === category) && words.every(word=>haystack.includes(word));
  });
}
export const sortHomeFleet = cars => [...cars].sort((a,b)=>`${a.make} ${a.model} ${a.name}`.localeCompare(`${b.make} ${b.model} ${b.name}`));
export function homeFleetCard(car, picture) {
  const esc = escapeFleetText;
  const name = String(car.name || '').replace(/^\d{4}\s+/, '');
  const year = String(car.name || '').match(/^\d{4}/)?.[0];
  const detail = [year,car.color].filter(Boolean).join(' · ');
  const rate = Number(car.price) > 0 ? `<span>from <strong>${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(car.price)}</strong>/day</span>` : '<span>Request rate</span>';
  return `<article class="home-fleet-card"><a href="/cars/${encodeURIComponent(car.slug)}" aria-label="View ${esc(car.name)}"><div class="home-fleet-photo">${picture || `<img src="${esc(car.image)}" alt="${esc(car.name)}" width="600" height="400" loading="lazy" decoding="async" />`}<span class="home-fleet-badge">${fleetCategory(car)}</span></div><div class="home-fleet-card-body"><h3>${esc(name)}</h3><p>${esc(detail || car.categoryLabel)}</p><div class="home-fleet-card-bottom">${rate}<span class="home-fleet-card-cta">View car <span aria-hidden="true">↗</span></span></div></div></a></article>`;
}
