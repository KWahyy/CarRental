import { safeMeasurementSearch, safeMeasurementReferrer } from './ad-measurement-url.js';
import { setOpenAIConsent } from './openai-tracking.js';
// Meta advertising measurement is opt-in and restricted to public rental pages.
const PIXEL_ID = "828705500299515";
const CONSENT_KEY = "prestige_ad_consent_v2";
const hosts = new Set(["prestigeluxor.com", "www.prestigeluxor.com"]);
let initialized = false;
let consent = false;
const sentLeads = new Set();

function permittedPage() {
  // The Pixel includes page URLs/referrers. Fail closed on unknown query data.
  if (!safeMeasurementSearch(window.location.search) || !safeMeasurementReferrer(document.referrer)) return false;
  return hosts.has(window.location.hostname)
    && /^\/(?:$|(?:fleet|wedding|lamborghini|ferrari|porsche|rolls-royce)\/?$|(?:cars|locations|guides)\/[a-z0-9-]+\/?$)/.test(window.location.pathname)
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
  try { startPixel(); setOpenAIConsent(consent); } catch { consent = false; }
  const panel = document.createElement("section");
  panel.id = "meta-advertising-choice";
  panel.setAttribute("aria-label", "Advertising privacy choices");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/src/ad-consent.css";
  document.head.append(stylesheet);
  const heading = document.createElement("h2");
  heading.textContent = "Your privacy. Your choice.";
  heading.id = "ad-consent-title";
  panel.setAttribute("aria-labelledby", heading.id);
  const text = document.createElement("p");
  text.textContent = "With your permission, Meta and OpenAI receive site activity, successful inquiry events and browser/device information to measure ads. Your form answers are never included.";
  const accept = document.createElement("button");
  accept.textContent = "Allow measurement";
  const reject = document.createElement("button");
  reject.textContent = "Decline";
  const privacy = document.createElement("a");
  privacy.href = "https://www.facebook.com/privacy/policy/";
  privacy.textContent = "Meta privacy policy";

  const settings = document.createElement("button");
  settings.textContent = "Ad privacy choices";
  settings.id = "ad-consent-settings";
  settings.onclick = () => { panel.hidden = false; settings.hidden = true; reject.focus(); };
  for (const button of [accept, reject, settings]) button.type = "button";
  function choose(allowed) {
    consent = allowed;
    try { localStorage.setItem(CONSENT_KEY, allowed ? "accepted" : "declined"); } catch { /* Session only. */ }
    setOpenAIConsent(allowed);
    if (allowed) startPixel();
    else if (initialized) window.fbq("consent", "revoke");
    panel.hidden = true;
    settings.hidden = false;
    settings.focus();
  }
  accept.onclick = () => choose(true);
  reject.onclick = () => choose(false);
  const openaiPrivacy = document.createElement("a");
  openaiPrivacy.href = "https://openai.com/policies/privacy-policy/";
  openaiPrivacy.textContent = "OpenAI privacy policy";
  const note = document.createElement("p");
  note.className = "ad-consent-note";
  note.textContent = "Optional. Your choice won’t affect your booking.";
  const actions = document.createElement("div");
  actions.className = "ad-consent-actions";
  actions.append(reject, accept);
  const links = document.createElement("nav");
  links.setAttribute("aria-label", "Advertising privacy policies");
  links.append(privacy, openaiPrivacy);
  panel.append(heading, text, note, actions, links);
  // Keep the notice available on demand without interrupting visitors.
  panel.hidden = true;
  settings.hidden = false;
  document.body.append(panel, settings);
}
