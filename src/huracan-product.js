// Product presentation for this listing; the shared quote and gallery handlers remain in use.
export function enhanceHuracanProduct(car) {
  const page = document.querySelector('.vehicle-private-page');
  if (!page || page.classList.contains('huracan-product')) return;
  page.classList.add('huracan-product');
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/src/huracan-product.css?v=20260909';
  document.head.append(stylesheet);

  const originalTop = page.querySelector('.vehicle-private-hero');
  const title = page.querySelector('.vehicle-private-title-card');
  const stage = page.querySelector('.vehicle-gallery-stage');
  const thumbs = page.querySelector('[data-gallery-thumbs]');
  const request = page.querySelector('.vehicle-private-request');
  const product = document.createElement('section');
  product.className = 'hp-product';
  product.setAttribute('aria-label', 'Vehicle photos and rental request');
  const gallery = document.createElement('div');
  gallery.className = 'hp-gallery';
  const panel = document.createElement('div');
  panel.className = 'hp-panel';
  originalTop.before(product);
  gallery.append(stage, thumbs);
  panel.append(title, request);
  product.append(gallery, panel);
  originalTop.remove();

  title.querySelector('h1').innerHTML = '<span>Lamborghini</span>Huracán EVO Spyder';
  title.querySelector('h1').setAttribute('aria-label', '2022 Lamborghini Huracán EVO Spyder');
  title.querySelector('[data-vehicle-category]').textContent = 'Convertible';
  title.querySelector('.vehicle-mobile-specs').remove();
  title.querySelector('a').remove();
  const essentials = document.createElement('p');
  essentials.className = 'hp-essentials';
  essentials.textContent = `${car.mileage} included · 2 seats`;
  const delivery = document.createElement('p');
  delivery.className = 'hp-delivery';
  delivery.textContent = 'Concierge delivery · Los Angeles & Orange County';
  title.append(essentials, delivery);

  request.querySelector('.eyebrow').remove();
  request.querySelector('h2').textContent = 'Check availability';
  request.querySelector(':scope > p').remove();
  request.querySelector('.vehicle-request-rate').remove();
  request.querySelector('[data-request-continue]').innerHTML = 'Check availability <span aria-hidden="true">→</span>';
  request.querySelector('button[type="submit"]').textContent = 'Request availability';
  request.querySelector('.vehicle-request-call').textContent = 'Questions? Call (949) 620-0024';
  const form = request.querySelector('form');
  // Disable the hidden step so browser validation and keyboard focus follow the visible step.
  const syncSteps = () => {
    const showingDetails = form.classList.contains('show-details');
    form.querySelectorAll('.vehicle-request-step-details input').forEach(input => { input.disabled = !showingDetails; });
    form.querySelector('[data-request-step="dates"]').inert = showingDetails;
  };
  syncSteps();
  new MutationObserver(syncSteps).observe(form, { attributes: true, attributeFilter: ['class'] });
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !form.classList.contains('show-details')) {
      event.preventDefault();
      form.querySelector('[data-request-continue]').click();
    }
  });

  document.querySelectorAll('header a, [data-mobile-menu] a').forEach(link => {
    if (link.textContent.trim().toLowerCase() === 'reserve') {
      link.href = '#vehicle-request';
      link.textContent = 'Check availability';
    }
  });
  const sticky = page.querySelector('.vehicle-mobile-actions a:last-child');
  sticky.textContent = 'Check availability';

  const overview = page.querySelector('.vehicle-private-overview');
  overview.querySelector('h2').textContent = 'Vehicle specifications';
  overview.querySelector('.eyebrow').remove();
  overview.querySelector('[data-vehicle-summary]').textContent = 'Blue exterior, open-top driving, and V10 power. Explore the photos of this vehicle and request your preferred rental date.';
  overview.querySelector('[data-vehicle-seats]').textContent = '2';
  overview.querySelector('.vehicle-private-inclusions').remove();
  overview.querySelector('.vehicle-private-rates').remove();
  const seo = page.querySelector('[data-vehicle-seo]');
  seo?.remove();
  const terms = document.createElement('section');
  terms.className = 'hp-terms';
  terms.setAttribute('aria-labelledby', 'hp-terms-title');
  terms.innerHTML = `<h2 id="hp-terms-title">Rental details</h2>
    <p>The essentials before you request your dates.</p>
    <details><summary>Driver & insurance requirements</summary><p>A valid driver’s license and active auto insurance are required. Driver and vehicle approval are confirmed before your reservation.</p></details>
    <details><summary>Security deposit</summary><p>A refundable security-deposit hold is required. The amount and release terms depend on the vehicle and driver and are disclosed before payment.</p></details>
    <details><summary>Included mileage & pricing</summary><p><span data-hp-mileage></span> is included. Additional mileage, rental length, delivery, and selected add-ons can affect your final quote. Your concierge confirms the total before you approve the booking.</p></details>
    <details><summary>Delivery & pickup</summary><p>Concierge delivery is available to approved locations across Los Angeles and Orange County. Share your city or ZIP with your request; the exact address, timing, and any delivery charge are confirmed before booking.</p></details>
    <details><summary>Luggage & vehicle walkaround</summary><p>This two-seat convertible is best for light luggage. Ask for current-condition photos or a walkaround video and confirm luggage space with the concierge.</p><a href="sms:+19496200024?body=Please%20send%20a%20walkaround%20of%20the%202022%20Lamborghini%20Huracan.">Request a walkaround video ↗</a></details>`;
  terms.querySelector('[data-hp-mileage]').textContent = car.mileage;
  page.querySelector('.vehicle-private-information').append(terms);
  setupPhotoViewer(stage, thumbs);
}

function setupPhotoViewer(stage, thumbs) {
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'hp-expand';
  open.textContent = 'View full screen ↗';
  stage.append(open);
  // Keep the shared swipe handler from capturing clicks on gallery controls.
  stage.querySelectorAll('button').forEach(button => button.addEventListener('pointerdown', event => event.stopPropagation()));
  const dialog = document.createElement('dialog');
  dialog.className = 'hp-viewer';
  dialog.setAttribute('aria-label', 'Vehicle photo viewer');
  dialog.innerHTML = `<div class="hp-viewer-toolbar"><span aria-live="polite" data-viewer-count></span><button type="button" data-viewer-close aria-label="Close photo viewer">Close ×</button></div><img alt="" /><div class="hp-viewer-controls"><button type="button" data-viewer-prev aria-label="Previous photo">← Previous</button><button type="button" data-viewer-next aria-label="Next photo">Next →</button></div>`;
  document.body.append(dialog);
  const sync = () => {
    const main = stage.querySelector('[data-gallery-main]');
    dialog.querySelector('img').src = main.src;
    dialog.querySelector('img').alt = main.alt;
    dialog.querySelector('[data-viewer-count]').textContent = stage.querySelector('[data-gallery-count]').textContent;
    thumbs.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
  };
  sync();
  new MutationObserver(sync).observe(stage.querySelector('[data-gallery-main]'), { attributes: true, attributeFilter: ['src'] });
  let previousOverflow = '';
  open.addEventListener('click', () => { sync(); previousOverflow = document.body.style.overflow; dialog.showModal(); document.body.style.overflow = 'hidden'; });
  dialog.querySelector('[data-viewer-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { document.body.style.overflow = previousOverflow; open.focus({ preventScroll: true }); });
  const advance = direction => { stage.querySelector(direction < 0 ? '[data-gallery-prev]' : '[data-gallery-next]').click(); sync(); };
  dialog.querySelector('[data-viewer-prev]').onclick = () => advance(-1);
  dialog.querySelector('[data-viewer-next]').onclick = () => advance(1);
  dialog.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); advance(event.key === 'ArrowLeft' ? -1 : 1); } });
}
