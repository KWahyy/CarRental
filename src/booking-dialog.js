import { fleet, formatPrice } from './live-fleet.js';
export function initBookingDialog(car, doc = document) {
  const request = doc.querySelector('#vehicle-request');
  if (!request || doc.querySelector('.booking-page-layout')) return;
  const bookingPage = doc.body.hasAttribute('data-booking-page');
  const destination = new URL('/booking', doc.defaultView.location.origin);
  destination.search = doc.defaultView.location.search;
  destination.searchParams.set('vehicle', car.slug);
  destination.searchParams.delete('preview');
  if (!bookingPage) {
    const launch = doc.createElement('div');
    launch.className = 'booking-launch';
    launch.innerHTML = '<h2>Your next drive.</h2><p>Choose your dates and delivery location.</p><a>Start reservation →</a>';
    launch.querySelector('a').href = destination.pathname + destination.search;
    request.replaceWith(launch);
    doc.querySelectorAll('a[href="#vehicle-request"]').forEach(link => { link.href = destination.pathname + destination.search; });
    const style = doc.createElement('link'); style.rel='stylesheet'; style.href='/src/booking-dialog.css'; doc.head.append(style);
    return;
  }
  const style = doc.createElement('link');
  style.rel = 'stylesheet'; style.href = '/src/booking-dialog.css'; doc.head.append(style);
  const dialog = doc.createElement('section');
  dialog.className = 'booking-dialog booking-page-layout';
  dialog.setAttribute('aria-labelledby', 'booking-dialog-title');
  const launch = doc.createElement('div');
  launch.className = 'booking-launch';
  launch.innerHTML = '<p>YOUR NEXT DRIVE</p><h2>Make it yours.</h2><p>Choose your dates. We’ll handle the details.</p><a href="#vehicle-request">Start reservation <span aria-hidden="true">↗</span></a>';
  request.replaceWith(launch);
  launch.after(dialog);
  const close = doc.createElement('button'); close.type = 'button'; close.className = 'booking-dialog-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Close booking');
  const heading = request.querySelector('h2'); heading.id = 'booking-dialog-title'; heading.textContent = 'Book your drive.';
  const vehicle = doc.createElement('p'); vehicle.className = 'booking-dialog-car'; vehicle.textContent = car.name; heading.after(vehicle);
  const intro = vehicle.nextElementSibling;
  if (intro?.tagName === 'P') intro.textContent = 'Choose your dates and delivery location. Your concierge will personally finalize your booking.';
  const visual = doc.createElement('section');
  visual.className = 'booking-dialog-visual';
  const image = doc.createElement('img');
  const galleryImage = doc.querySelector('[data-gallery-main]');
  image.src = galleryImage?.currentSrc || galleryImage?.src || car.image || '';
  image.alt = car.name;
  const caption = doc.createElement('div'); caption.className = 'booking-dialog-caption';
  const brand = doc.createElement('p'); brand.textContent = 'PRESTIGE LUXOR / PRIVATE COLLECTION';
  const name = doc.createElement('h3'); name.textContent = car.name;
  const note = doc.createElement('p'); note.textContent = 'An exceptional car. A personal experience.';
  caption.append(brand, name, note); visual.append(image, caption);
  const steps = doc.createElement('div'); steps.className = 'booking-dialog-progress';
  steps.setAttribute('aria-label', 'Booking steps');
  steps.innerHTML = '<span><b>01</b> Your trip</span><span><b>02</b> Your details</span>';
  request.querySelector('form').before(steps);
  const form = request.querySelector('form');
  for (const fieldName of ['date', 'returnDate']) {
    const input = form.elements[fieldName];
    const existing = input.value;
    const label = input.closest('label').querySelector(':scope > span');
    label.firstChild.textContent = fieldName === 'date' ? 'Pickup date' : 'Return date ';

    input.type = 'date'; input.value = existing.slice(0,10); input.min = input.min.slice(0,10);
    const control = input.parentElement; control.classList.add('booking-calendar-control');
    const display = control.querySelector('.vehicle-date-placeholder');
    const sync = () => {
      display.textContent = input.value ? new Date(input.value + 'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}) : 'Select date';
      control.classList.toggle('has-date',Boolean(input.value));
    };
    input.addEventListener('change',sync);
    input.addEventListener('click',()=>{try{input.showPicker?.();}catch{ /* Native control remains usable. */ }});
    sync();
  }
  vehicle.remove();
  request.querySelector('.eyebrow').textContent = 'YOUR RESERVATION';
  heading.textContent = 'A drive to remember.';
  if (intro?.tagName === 'P') intro.textContent = 'Tell us when and where. We’ll take care of the rest.';
  dialog.append(close, visual, request);
  close.remove();
  const back = doc.createElement('a'); back.className = 'booking-page-back';
  back.href = '/cars/' + encodeURIComponent(car.slug); back.textContent = '← Back to vehicle';
  const main = doc.querySelector('[data-vehicle-page]');
  main.replaceChildren(back, dialog);
  const tokens = value => new Set(String(value || '').toLowerCase().split(/\s+/));
  const category = tokens(car.category);
  const alternatives = fleet.filter(item => item.slug !== car.slug && item.image && item.active !== false)
    .map(item => ({item, score: [...tokens(item.category)].filter(token => category.has(token)).length * 3 + (item.make === car.make ? 2 : 0)}))
    .sort((a,b) => b.score - a.score || Math.abs(a.item.price - car.price) - Math.abs(b.item.price - car.price))
    .slice(0,3).map(entry => entry.item);
  if (alternatives.length) {
    const section = doc.createElement('section'); section.className = 'booking-similar'; section.setAttribute('aria-labelledby','booking-similar-title');
    section.innerHTML = '<div class="booking-similar-heading"><div><p>EXPLORE YOUR OPTIONS</p><h2 id="booking-similar-title">Another way to arrive.</h2></div><a href="/fleet">View the collection ↗</a></div><div class="booking-similar-grid"></div>';
    const grid = section.querySelector('.booking-similar-grid');
    for (const item of alternatives) {
      const link = doc.createElement('a'); link.className = 'booking-similar-card';
      const url = new URL('/booking', doc.defaultView.location.origin); url.search = doc.defaultView.location.search; url.searchParams.set('vehicle',item.slug); link.href = url.pathname + url.search;
      const photo = doc.createElement('img'); photo.src = item.image; photo.alt = item.name; photo.loading = 'lazy'; photo.width = 640; photo.height = 420;
      const detail = doc.createElement('div');
      const label = doc.createElement('p'); label.textContent = item.categoryLabel || item.make;
      const title = doc.createElement('h3'); title.textContent = item.name.replace(/^\d{4}\s+/, '');
      const rate = doc.createElement('span'); rate.textContent = item.price ? 'From ' + formatPrice(item.price) + ' / day' : 'Rate confirmed personally';
      const action = doc.createElement('strong'); action.textContent = 'Book this vehicle ↗';
      detail.append(label,title,rate,action); link.append(photo,detail); grid.append(link);
    }
    main.append(section);
  }
  doc.title = 'Book ' + car.name + ' | Prestige Luxor';
}
