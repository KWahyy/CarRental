import { fleet, isPublicRendered } from './live-fleet.js';
import { fleetPictureMarkup } from './supabase-fleet.js';
import { filterHomeFleet, homeFleetFilterMarkup, homeFleetCard, sortHomeFleet } from './home-fleet-model.js';
import { readTripSearch, tripSearchParams } from './rental-search.js';
const root = document.querySelector('[data-home-fleet]');
if (root) {
  const cars = sortHomeFleet(fleet);
  const search = root.querySelector('input[type="search"]');
  const grid = root.querySelector('[data-home-fleet-grid]');
  const count = root.querySelector('[data-home-fleet-count]');
  const more = root.querySelector('[data-home-fleet-more]');
  const empty = root.querySelector('[data-home-fleet-empty]');
  const categories = root.querySelector('[data-home-fleet-categories]');
  let active = 'All', limit = 9, activeBrand = '';
  const trip = tripSearchParams(readTripSearch(location.search));
  if (!isPublicRendered) categories.innerHTML=homeFleetFilterMarkup(cars);
  categories.addEventListener('click',event=>{
    const button=event.target.closest('[data-category]');
    if(!button)return;
    active=button.dataset.category;limit=9;render();
  });
  function render() {
    const filtered = filterHomeFleet(cars,search.value,active,activeBrand);
    const visible = filtered.slice(0,limit);
    grid.innerHTML = visible.map(car=>homeFleetCard(car,fleetPictureMarkup(car.image,{alt:car.name,width:600,height:400,quality:78,updatedAt:car.updatedAt,loading:'lazy'}))).join('');
    if (trip.size) for (const link of grid.querySelectorAll('a')) link.href += `?${trip}`;
    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'car' : 'cars'}${filtered.length > limit ? ` · Showing ${limit}` : ''}`;
    more.hidden = filtered.length <= limit;
    empty.hidden = filtered.length > 0;
    for (const button of categories.querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.category === active));
    for (const button of root.querySelectorAll('[data-home-fleet-query]')) button.setAttribute('aria-pressed',String(button.dataset.homeFleetQuery === search.value));
  }
  search.addEventListener('input',()=>{activeBrand='';limit=9;render();});
  root.querySelectorAll('[data-home-fleet-query]').forEach(button=>button.addEventListener('click',()=>{
    search.value = search.value === button.dataset.homeFleetQuery ? '' : button.dataset.homeFleetQuery;
    activeBrand='';active='All';limit=9;render();
  }));
  root.querySelector('[data-home-fleet-reset]').addEventListener('click',()=>{search.value='';activeBrand='';active='All';limit=9;render();search.focus({preventScroll:true});});
  more.addEventListener('click',()=>{
    const previous = limit;
    limit+=9;render();
    grid.querySelectorAll('a')[previous]?.focus({preventScroll:true});
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable="true"]')) {event.preventDefault();search.focus();}
  });
  document.addEventListener('home-fleet-filter',event=>{
    const filter=event.detail;
    activeBrand = filter.startsWith('brand:') ? filter.slice(6) : '';
    search.value = filter.startsWith('brand:') ? filter.slice(6) : filter.startsWith('type:') ? filter.slice(5) : '';
    active = /suv/.test(filter) ? 'Luxury SUVs' : /luxury/.test(filter) ? 'All' : /supercar|exotic/.test(filter) ? 'Exotics' : 'All';
    limit=9;render();
    root.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  });
  if (!isPublicRendered) render();
  else if (trip.size) for (const link of grid.querySelectorAll('a')) link.href += `?${trip}`;
}
