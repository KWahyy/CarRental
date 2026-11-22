import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {bindOperatingReports} from '../src/crm-desk-overview.js';

function report(t, {readCalls, readFleet}) {
  const {document} = parseHTML('<details class="desk-operating-reports"><div data-desk-operating-content></div></details>');
  const previous = {document: globalThis.document, window: globalThis.window};
  t.after(() => Object.assign(globalThis, previous));
  let aggregateSince;
  const query = {
    select() {return this;},
    neq(field, value) {assert.deepEqual([field, value], ['event_type', 'call_prompt_click']); return this;},
    gte(field, since) {assert.deepEqual([field, since], ['created_at', aggregateSince]); return this;},
    order() {return this;},
    limit(limit) {assert.equal(limit, 5000); return readFleet();},
  };
  globalThis.document = document;
  globalThis.window = {prestigeLuxorSupabase: {
    from(name) {assert.equal(name, 'fleet_events'); return query;},
    rpc(name, {since}) {
      assert.equal(name, 'popup_call_metrics');
      assert.ok(Math.abs(Date.now() - Date.parse(since) - 30 * 86400000) < 10000);
      aggregateSince = since;
      return readCalls();
    },
  }};
  bindOperatingReports({model: {quotes: [], cars: [], partners: []}, failedTables: new Set()});
  const details = document.querySelector('details');
  return {
    open() {details.open = true; return details.ontoggle();},
    close() {details.open = false; return details.ontoggle();},
    popup() {return details.querySelector('[data-popup-call-summary]');},
    fleet() {return details.querySelector('[data-traffic-summary]');},
  };
}

test('renders exact call counts independently of the fleet traffic sample', async t => {
  let resolveCalls, fleetRead = false;
  const ui = report(t, {
    readCalls: () => new Promise(resolve => {resolveCalls = resolve;}),
    readFleet: () => {fleetRead = true; return {error: new Error('fleet unavailable')};},
  });
  assert.equal(fleetRead, false);
  const pending = ui.open();
  assert.equal(fleetRead, true);
  resolveCalls({data: [{tap_count: '7001', session_count: '2000'}]});
  await pending;
  assert.match(ui.fleet().textContent, /could not be loaded/);
  assert.match(ui.popup().textContent, /Popup call taps7,001/);
  assert.match(ui.popup().textContent, /Sessions that tapped2,000/);
});

test('distinguishes an unreadable count from zero and retries after reopening', async t => {
  let calls = 0;
  const ui = report(t, {
    readCalls: () => ++calls === 1 ? {error: new Error('offline')} : {data: [{tap_count: 0, session_count: 0}]},
    readFleet: () => ({data: [{event_type: 'fleet_page_view'}]}),
  });
  await ui.open();
  assert.match(ui.fleet().textContent, /1 fleet page views/);
  assert.match(ui.popup().textContent, /unavailable/);
  assert.equal(ui.popup().querySelector('strong'), null);
  await ui.close();
  await ui.open();
  assert.deepEqual([...ui.popup().querySelectorAll('strong')].map(el => el.textContent), ['0', '0']);
});
