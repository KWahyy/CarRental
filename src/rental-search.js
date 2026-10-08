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
function tripSummary(trip) {
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
  const note = document.createElement('aside');
  note.className = 'rental-trip-banner';
  note.setAttribute('aria-label','Your rental plans');
  const summary = document.createElement('strong');
  summary.textContent = tripSummary(trip);
  const detail = document.createElement('span');
  detail.textContent = 'Browse the collection below. Your dates and delivery are confirmed after you request a car.';
  const edit = document.createElement('a');
  edit.href = `/?${tripSearchParams(trip)}#rental-search`;
  edit.textContent = 'Edit trip';
  note.append(summary,detail,edit);
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
export function initHeroSearch() {
  const form = document.querySelector('[data-hero-search]');
  if (!form) return;
  const trip = readTripSearch(window.location.search);
  const pickup = form.elements.pickup, end = form.elements.return;
  const today = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  pickup.min = today;
  if (trip.city) form.elements.deliveryCity.value = trip.city;
  pickup.value = trip.pickup;
  end.value = trip.returnDate;
  const validate = () => {
    end.min = pickup.value || today;
    end.setCustomValidity(end.value && pickup.value && end.value < pickup.value ? 'Return date must be on or after pickup.' : '');
  };
  pickup.addEventListener('change',validate);
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
