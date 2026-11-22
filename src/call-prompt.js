import { recordPublicClick } from './public-click-tracking.js';

const sessionKey = 'prestige.call-prompt.seen';
const delay = 18_000;
const blueEvo = { name: 'Lamborghini Huracán EVO Spyder', src: '/assets/owned-fleet/huracan-evo/cover.jpg' };
const weddingCar = { name: 'Rolls-Royce Cullinan', src: '/assets/fleet-optimized/rolls-royce-cullinan-white.webp' };
const competingUI = [
  'dialog[open]:not([data-call-prompt])', '.hero-calendar.calendar-open',
  '#site-mobile-menu:not([hidden])', '#meta-advertising-choice:not([hidden])',
  'body.availability-open', 'body.fleet-filters-open', '[data-tone="success"]',
].join(',');

function alreadyShown() {
  try { return sessionStorage.getItem(sessionKey) === '1'; }
  catch { return false; }
}

function personalize(prompt) {
  const route = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  const title = prompt.querySelector('.call-prompt-title');
  const copy = prompt.querySelector('.call-prompt-copy');
  if (route === '/partner') {
    prompt.querySelector('.call-prompt-label').textContent = 'Fleet consignment';
    title.textContent = 'List your car with us.';
    copy.textContent = 'Call our team about your car, its rental potential and how consignment works.';
  } else if (route === '/wedding') {
    title.textContent = 'Wedding date set?';
    copy.textContent = 'Call with your date and venue. We’ll check the cars and help you plan your arrival.';
    return weddingCar;
  } else {
    const name = document.querySelector('.booking-dialog-caption h3, [data-vehicle-title]')?.textContent.trim();
    if (name && name !== 'Vehicle') {
      const model = name.replace(/^\d{4}\s+/, '');
      const image = document.querySelector('.booking-dialog-visual img, [data-gallery-main]');
      title.textContent = 'Have dates in mind?';
      copy.textContent = 'Call to check availability and delivery pricing for the ' + model + '.';
      if (image?.getAttribute('src')) return { name: model, src: image.currentSrc || image.src };
    }
  }
  return blueEvo;
}

async function loadPhoto(prompt) {
  const img = prompt.querySelector('[data-call-photo]');
  let car = personalize(prompt);
  img.src = car.src;
  try {
    await img.decode();
  } catch (error) {
    if (car === blueEvo) throw error;
    car = blueEvo;
    img.src = car.src;
    await img.decode();
  }
  prompt.querySelector('.call-prompt-caption').textContent = car.name;
}

function initCallPrompt(prompt) {
  // The local review link replays the normal visitor experience on each reload.
  const preview = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
    && new URLSearchParams(location.search).get('preview') === 'call';
  if ((!preview && alreadyShown()) || typeof prompt.showModal !== 'function') return;

  const controller = new AbortController();
  const { signal } = controller;
  let timer;
  let revision = 0;
  let loading = false;

  function pause() {
    revision++;
    clearTimeout(timer);
    timer = undefined;
  }

  function busy() {
    return document.activeElement?.closest('form, input, textarea, select, [contenteditable="true"]')
      || document.querySelector(competingUI);
  }

  function dismiss() {
    controller.abort();
    pause();
    if (prompt.open) prompt.close();
    prompt.hidden = true;
  }

  async function show() {
    timer = undefined;
    if (document.hidden || busy()) return;
    if (!preview && alreadyShown()) { dismiss(); return; }

    const started = revision;
    loading = true;
    try {
      await loadPhoto(prompt);
    } catch {
      dismiss();
      return;
    } finally {
      loading = false;
    }
    if (signal.aborted) return;
    if (started !== revision || document.hidden || busy()) { schedule(); return; }

    prompt.hidden = false;
    prompt.showModal();
    if (!preview) {
      try { sessionStorage.setItem(sessionKey, '1'); } catch { /* Keep the page-level cap. */ }
      window.prestigeTrack?.('call_prompt_shown');
    }
  }

  function schedule() {
    if (signal.aborted || prompt.open) return;
    if (document.hidden || busy()) { pause(); return; }
    if (timer === undefined && !loading) timer = setTimeout(show, delay);
  }

  prompt.querySelector('[data-call-prompt-close]').addEventListener('click', dismiss, { signal });
  prompt.querySelector('[data-call-prompt-later]').addEventListener('click', dismiss, { signal });
  prompt.querySelector('a[href^="tel:"]').addEventListener('click', event => {
    if (!prompt.open || !event.isTrusted || event.defaultPrevented || event.button !== 0) return;
    void recordPublicClick('call_prompt_click', { placement: 'call_prompt' });
    dismiss();
  }, { signal });
  let backdropPress = false;
  prompt.addEventListener('pointerdown', event => { backdropPress = event.target === prompt; }, { signal });
  prompt.addEventListener('click', event => {
    if (backdropPress && event.target === prompt) dismiss();
    backdropPress = false;
  }, { signal });
  prompt.addEventListener('cancel', event => { event.preventDefault(); dismiss(); }, { signal });
  prompt.addEventListener('close', dismiss, { signal });

  for (const event of ['focusin', 'focusout', 'click', 'toggle']) {
    document.addEventListener(event, () => queueMicrotask(schedule), { capture: event === 'toggle', signal });
  }
  document.addEventListener('input', event => {
    if (event.target.closest('[data-vehicle-request-form], [data-quote-form], [data-location-quote], [data-wedding-form], [data-partner-form]')) dismiss();
  }, { signal });
  document.addEventListener('visibilitychange', schedule, { signal });
  window.addEventListener('pagehide', () => prompt.open ? dismiss() : pause(), { signal });
  window.addEventListener('pageshow', schedule, { signal });
  schedule();
}

const prompt = document.querySelector('[data-call-prompt]');
if (prompt) initCallPrompt(prompt);
