import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {applySiteChrome} from '../src/site-chrome.js';
const fixture='<html><head></head><body><header class="site-header">Old</header><div data-mobile-menu>Old menu</div><main><footer>Article footer</footer></main><footer class="site-footer">Old footer</footer></body></html>';
test('shared chrome replaces only outer navigation and is idempotent',()=>{const {document:d}=parseHTML(fixture);applySiteChrome(d,{path:'/about'});applySiteChrome(d,{path:'/about'});assert.equal(d.querySelectorAll('body > header').length,1);assert.equal(d.querySelectorAll('body > footer').length,1);assert.equal(d.querySelector('main footer').textContent,'Article footer');assert.equal(d.querySelectorAll('[data-shared-nav-script]').length,1);assert.equal(d.querySelectorAll('[data-shared-nav-style]').length,1);assert.equal(d.querySelector('.desktop-nav a[href="/wedding"]').textContent,'Weddings');});
test('shared navigation marks the current route and uses local reservation form when available',()=>{const {document:d}=parseHTML(fixture);d.querySelector('main').insertAdjacentHTML('beforeend','<form id="location-quote"></form>');applySiteChrome(d,{path:'/fleet.html'});assert.equal(d.querySelector('.desktop-nav [aria-current]').getAttribute('href'),'/fleet');assert.equal(d.querySelector('.header-actions .primary-button').getAttribute('href'),'#location-quote');});
test('admin and private documents keep their focused navigation',()=>{for(const path of ['/admin/','/admin/index','/quote','/agreement']){const {document:d}=parseHTML(fixture);applySiteChrome(d,{path});assert.equal(d.querySelector('[data-shared-header]'),null);}});

test('public pages have one initially hidden concierge call prompt', () => {
  const paths = [
    '/', '/fleet.html', '/booking', '/wedding', '/partner', '/about', '/faq', '/privacy',
    '/rental-policies', '/terms', '/cars/2022-lamborghini-huracan',
    '/locations/newport-beach-exotic-car-rental', '/locations/san-diego-exotic-car-rental',
    '/guides', '/guides/ferrari-rental-cost-southern-california',
  ];
  for (const path of paths) {
    const { document } = parseHTML(fixture);
    applySiteChrome(document, { path });
    applySiteChrome(document, { path });
    const prompts = document.querySelectorAll('[data-call-prompt]');
    assert.equal(prompts.length, 1, path);
    const [prompt] = prompts;
    assert.ok(prompt.hasAttribute('hidden'), path);
    assert.equal(prompt.closest('main'), null, path);
    const dialog = prompt.matches('dialog, [role="dialog"]') ? prompt : prompt.querySelector('dialog, [role="dialog"]');
    assert.ok(dialog, path);
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      const id = dialog.getAttribute(attribute);
      assert.ok(id && document.getElementById(id)?.textContent.trim(), `${path} ${attribute}`);
    }
    const links = [...dialog.querySelectorAll('a[href]')];
    assert.deepEqual(links.map(link => link.getAttribute('href')), ['tel:+19496200024'], path);
    const photo = dialog.querySelector('img[data-call-photo]');
    assert.ok(photo, path);
    assert.equal(photo.hasAttribute('src') || photo.hasAttribute('srcset'), false, path);
    const close = dialog.querySelector('button[data-call-prompt-close]');
    assert.ok(close, path);
    assert.match(close.getAttribute('aria-label') || close.textContent, /close|dismiss/i, path);
    const secondary = [...dialog.querySelectorAll('button')].find(button =>
      button !== close && /continue|keep browsing/i.test(button.textContent),
    );
    assert.ok(secondary, path);
  }
});

test('admin and private rental documents omit the promotional call prompt', () => {
  for (const path of ['/admin/', '/admin/index.html', '/quote.html', '/agreement.html']) {
    const { document } = parseHTML(fixture);
    applySiteChrome(document, { path });
    assert.equal(document.querySelector('[data-call-prompt]'), null, path);
  }
});
