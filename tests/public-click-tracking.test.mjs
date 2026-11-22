import test from "node:test";
import assert from "node:assert/strict";
import { recordPublicClick } from "../src/public-click-tracking.js";
import { trackNewportDateClick } from "../src/newport-click.js";

test("popup taps get separate event IDs, share the fleet session and omit query parameters", async t => {
  const storage = new Map();
  const calls = [];
  const location = new URL("https://www.prestigeluxor.com/wedding?utm_campaign=example");
  const originals = ["fetch", "location", "sessionStorage"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  t.after(() => {
    for (const [key, desc] of originals) {
      if (desc) Object.defineProperty(globalThis, key, desc);
      else delete globalThis[key];
    }
  });
  Object.defineProperties(globalThis, {
    location: { configurable: true, value: location },
    sessionStorage: { configurable: true, value: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } },
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, "/rest/v1/fleet_events");
    calls.push({ options, event: JSON.parse(options.body) });
  };
  const tap = () => recordPublicClick("call_prompt_click", { placement: "call_prompt" });
  await tap();
  await tap();
  const [first, second] = calls;
  assert.equal(calls.length, 2);
  assert.equal(first.options.method, "POST");
  assert.equal(first.options.keepalive, true);
  assert.equal(first.options.credentials, "omit");
  assert.equal(first.options.referrerPolicy, "no-referrer");
  assert.notEqual(first.event.id, second.event.id);
  assert.ok(first.event.session_id);
  assert.equal(first.event.session_id, second.event.session_id);
  assert.equal(first.event.page_path, "/wedding");
  assert.equal(first.event.event_type, "call_prompt_click");
  assert.deepEqual(first.event.metadata, { placement: "call_prompt" });

  const link = {href: location.origin + "/booking?vehicle=2022-lamborghini-huracan"};
  trackNewportDateClick({ currentTarget: link, button: 0, defaultPrevented: false });
  assert.equal(calls[2].event.event_type, "availability_open");
  assert.equal(calls[2].event.id, new URL(link.href).searchParams.get("newport_evo_click"));
  assert.equal(calls[2].event.session_id, first.event.session_id);

  Object.defineProperty(globalThis, "sessionStorage", {configurable: true, get() { throw new Error("Storage disabled"); }});
  await tap();
  assert.equal(calls[3].event.session_id, "");
  location.hostname = "localhost";
  await tap();
  assert.equal(calls.length, 4);
});
