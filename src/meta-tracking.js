// Meta advertising measurement is opt-in and restricted to public rental pages.
const PIXEL_ID = "828705500299515";
const CONSENT_KEY = "prestige_meta_consent_v1";
const hosts = new Set(["prestigeluxor.com", "www.prestigeluxor.com"]);
let initialized = false;
let consent = false;
const sentLeads = new Set();

function permittedPage() {
  // The Pixel includes page URLs/referrers. Fail closed on unknown query data.
  const allowedKeys = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "gbraid", "wbraid"]);
  for (const [key, value] of new URLSearchParams(window.location.search)) {
    if (!allowedKeys.has(key) || /@|%40/i.test(value)) return false;
  }
  if (document.referrer) {
    try { if (new URL(document.referrer).search) return false; } catch { return false; }
  }
  return hosts.has(window.location.hostname)
    && /^\/(?:$|lamborghini\/?$|cars\/[a-z0-9-]+\/?$)/.test(window.location.pathname)
    && !navigator.globalPrivacyControl;
}

function startPixel() {
  if (!consent || !permittedPage()) return;
  if (initialized) { window.fbq("consent", "grant"); return; }
  // Do not initialize over another integration with unknown matching settings.
  if (window.fbq) return;
  const fbq = window.fbq = function () {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
    else fbq.queue.push(arguments);
  };
  window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  fbq("consent", "grant");
  fbq("set", "autoConfig", false, PIXEL_ID);
  fbq("init", PIXEL_ID);
  fbq("trackSingle", PIXEL_ID, "PageView");
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.append(script);
  initialized = true;
}

export function trackMetaLead(result) {
  if (!consent || !initialized || !permittedPage() || !result?.ok || !result?.id) return;
  const id = String(result.id);
  if (sentLeads.has(id)) return;
  sentLeads.add(id);
  // No form fields, booking values, or customer identifiers are passed to Meta.
  window.fbq("trackSingle", PIXEL_ID, "Lead", {}, { eventID: `quote_${id}` });
}

export function initMetaConsent() {
  if (!permittedPage() || document.getElementById("meta-advertising-choice")) return;
  let stored = null;
  try { stored = localStorage.getItem(CONSENT_KEY); } catch { /* Default off. */ }
  consent = stored === "accepted";
  try { startPixel(); } catch { consent = false; }
  const panel = document.createElement("section");
  panel.id = "meta-advertising-choice";
  panel.setAttribute("aria-label", "Meta advertising privacy choices");
  panel.style.cssText = "position:fixed;bottom:12px;left:12px;right:12px;z-index:10000;padding:16px;background:#171717;color:white;border:1px solid #aaa;border-radius:8px;font:14px/1.5 system-ui;max-width:560px;box-shadow:0 4px 24px #0008";
  const text = document.createElement("p");
  text.textContent = "Optional Meta advertising cookies: with your permission, Meta receives page visits and successful inquiry events, plus browser/device information, to measure and personalize ads. We do not send your form answers. Declining does not affect booking. This choice controls Meta tracking only.";
  const accept = document.createElement("button");
  accept.textContent = "Allow Meta cookies";
  const reject = document.createElement("button");
  reject.textContent = "Decline Meta cookies";
  const privacy = document.createElement("a");
  privacy.href = "https://www.facebook.com/privacy/policy/";
  privacy.textContent = "Meta privacy policy";
  privacy.style.color = "white";
  const settings = document.createElement("button");
  settings.textContent = "Ad privacy choices";
  settings.style.cssText = "position:fixed;bottom:8px;left:8px;z-index:9999;font:12px system-ui;padding:6px";
  settings.onclick = () => { panel.hidden = false; settings.hidden = true; reject.focus(); };
  for (const button of [accept, reject]) button.style.cssText = "padding:10px;margin:4px;border:1px solid #aaa;background:white;color:#171717;border-radius:4px;font:inherit;cursor:pointer";
  function choose(allowed) {
    consent = allowed;
    try { localStorage.setItem(CONSENT_KEY, allowed ? "accepted" : "declined"); } catch { /* Session only. */ }
    if (allowed) startPixel();
    else if (initialized) window.fbq("consent", "revoke");
    panel.hidden = true;
    settings.hidden = false;
    settings.focus();
  }
  accept.onclick = () => choose(true);
  reject.onclick = () => choose(false);
  panel.append(text, accept, reject, privacy);
  panel.hidden = stored !== null;
  settings.hidden = !panel.hidden;
  document.body.append(panel, settings);
}
