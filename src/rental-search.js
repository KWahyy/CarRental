import { enhanceDatePicker } from "./hero-calendar.js";
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
}
export function readTripSearch(search) {
  const params = new URLSearchParams(search);
  const pickup = validDate(params.get('pickup'));
  const end = validDate(params.get('return'));
  return {city:(params.get('deliveryCity') || '').trim().slice(0,100), pickup, returnDate:pickup && end >= pickup ? end : ''};
}
export function tripSearchParams(trip) {
  const params = new URLSearchParams();
  if (trip.city) params.set('deliveryCity',trip.city);
  if (trip.pickup) params.set('pickup',trip.pickup);
  if (trip.returnDate) params.set('return',trip.returnDate);
  return params;
}
export function tripSummary(trip) {
  const format = value => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(`${value}T12:00:00`));
  return [trip.city,trip.pickup && format(trip.pickup),trip.returnDate && `to ${format(trip.returnDate)}`].filter(Boolean).join(' · ');
}
export function applyTripToForm(form) {
  const trip = readTripSearch(window.location.search);
  if (trip.city && form.elements.deliveryLocation) form.elements.deliveryLocation.value = trip.city;
  for (const [name,value] of [['date',trip.pickup],['returnDate',trip.returnDate]]) {
    const field = form.elements[name];
    if (!field || !value) continue;
    if (field.type === 'datetime-local') {
      field.type = 'date';
      const label = field.closest('label')?.querySelector('span');
      if (label?.firstChild) label.firstChild.textContent = name === 'date' ? 'Pickup date' : 'Return date ';
    }
    field.min = name === 'returnDate' ? trip.pickup : new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
    field.value = value;
  }
  if (trip.city || trip.pickup) {
    const note = form.querySelector('.rental-trip-note') || document.createElement('p');
    note.className = 'rental-trip-note';
    note.textContent = `${tripSummary(trip)}. Confirm exact handoff times with your concierge.`;
    form.prepend(note);
  }
}
export function initFleetTrip() {
  const trip = readTripSearch(window.location.search);
  if (!trip.city && !trip.pickup) return;
  const note = document.querySelector('.rental-trip-banner') || document.createElement('aside');
  note.className = 'rental-trip-banner';
  note.setAttribute('aria-label','Your rental plans');
  const summary = document.createElement('strong');
  summary.textContent = tripSummary(trip);
  const detail = document.createElement('span');
  detail.textContent = 'Browse the collection below. Your dates and delivery are confirmed after you request a car.';
  const edit = document.createElement('a');
  edit.href = `/?${tripSearchParams(trip)}#rental-search`;
  edit.textContent = 'Edit trip';
  note.replaceChildren(summary,detail,edit);
  document.querySelector('.fleet-editorial-hero')?.after(note);
  const decorateLinks = () => {
    for (const link of document.querySelectorAll('a[href*="/cars/"]')) {
      const url = new URL(link.href,window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/cars/')) continue;
      for (const [key,value] of tripSearchParams(trip)) url.searchParams.set(key,value);
      const next = url.pathname+url.search+url.hash;
      if (link.getAttribute('href') !== next) link.setAttribute('href',next);
    }
  };
  decorateLinks();
  new MutationObserver(decorateLinks).observe(document.querySelector('main'),{childList:true,subtree:true});
}
function enhanceCitySelect(select) {
  if (!select || select.dataset.enhanced) return;
  select.dataset.enhanced = 'true';
  const field = select.parentElement;
  const trigger = field.querySelector('.hero-city-trigger') || document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'hero-city-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'hero-city-options');
  const value = trigger.firstElementChild || document.createElement('span');
  const chevron = trigger.querySelector('.hero-city-chevron') || document.createElement('span');
  chevron.className = 'hero-city-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(value, chevron);
  const menu = document.createElement('div');
  menu.id = 'hero-city-options';
  menu.className = 'hero-city-options';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Delivery city');
  menu.inert = true;
  menu.setAttribute('aria-hidden', 'true');
  const options = [...select.options].map(option => {
    const item = document.createElement('button');
    item.type = 'button';
    item.tabIndex = -1;
    item.setAttribute('role', 'option');
    item.textContent = option.textContent;
    item.addEventListener('click', () => {
      select.value = option.value;
      select.dispatchEvent(new Event('change', {bubbles:true}));
      sync();
      close(true);
    });
    menu.append(item);
    return item;
  });
  const sync = () => {
    value.textContent = select.selectedOptions[0].textContent;
    trigger.setAttribute('aria-label', `Delivery city: ${value.textContent}`);
    options.forEach((item, index) => item.setAttribute('aria-selected', String(index === select.selectedIndex)));
  };
  const close = (restoreFocus = false) => {
    field.classList.remove('city-open');
    trigger.setAttribute('aria-expanded', 'false');
    menu.inert = true;
    menu.setAttribute('aria-hidden', 'true');
    if (restoreFocus) trigger.focus({preventScroll:true});
  };
  const open = () => {
    document.dispatchEvent(new CustomEvent('hero-picker-open',{detail:'city'}));
    field.classList.add('city-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.inert = false;
    menu.removeAttribute('aria-hidden');
    options[select.selectedIndex].focus({preventScroll:true});
  };
  trigger.addEventListener('click', () => field.classList.contains('city-open') ? close() : open());
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
  });
  menu.addEventListener('keydown', event => {
    const index = options.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (event.key === 'ArrowUp') next = (index + options.length - 1) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    else if (event.key === 'Tab') { close(true); return; }
    else if (event.key.length === 1 && event.key !== ' ') next = options.findIndex(item => item.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
    if (next !== undefined && next >= 0) { event.preventDefault(); options[next].focus({preventScroll:true}); }
  });
  document.addEventListener('pointerdown', event => { if (!field.contains(event.target)) close(); });
  field.addEventListener('focusout', event => { if (!field.contains(event.relatedTarget)) close(); });
  document.addEventListener('hero-picker-open',event=>{if(event.detail !== 'city') close();});
  select.hidden = true;
  field.append(trigger, menu);
  sync();
}
export function initHeroSearch() {
  const form = document.querySelector('[data-hero-search]');
  if (!form) return;
  const trip = readTripSearch(window.location.search);
  const pickup = form.elements.pickup, end = form.elements.return;
  const today = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  pickup.min = today;
  if ([...form.elements.deliveryCity.options].some(option => option.value === trip.city)) form.elements.deliveryCity.value = trip.city;
  enhanceCitySelect(form.elements.deliveryCity);
  pickup.value = trip.pickup;
  end.value = trip.returnDate;
  const validate = () => {
    for (const field of [pickup,end]) field.toggleAttribute('data-empty', !field.value);
    end.min = pickup.value || today;
    end.setCustomValidity(end.value && pickup.value && end.value < pickup.value ? 'Return date must be on or after pickup.' : '');
  };
  for (const field of [pickup,end]) {
    field.addEventListener('input',validate);
    enhanceDatePicker(field);
  }
  pickup.addEventListener('change',() => {
    if (end.value && end.value < pickup.value) { end.value = ''; end.dispatchEvent(new Event('change',{bubbles:true})); }
    validate();
  });
  end.addEventListener('change',validate);
  validate();
  form.addEventListener('submit',event => {
    validate();
    if (!form.reportValidity()) event.preventDefault();
    else window.prestigeTrack?.('hero_fleet_search',{delivery_city:form.elements.deliveryCity.value});
  });
  const video = document.querySelector('[data-hero-film]');
  if (!video) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncPlayback = () => {
    if (motion.matches || document.hidden) { video.pause(); return; }
    if (!video.dataset.loaded) {
      for (const source of video.querySelectorAll('source[data-src]')) source.src = source.dataset.src;
      video.dataset.loaded = 'true';
      video.load();
    }
    video.play().catch(()=>{});
  };
  motion.addEventListener('change',syncPlayback);
  document.addEventListener('visibilitychange',syncPlayback);
  syncPlayback();
}
