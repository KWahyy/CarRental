const ATTRIBUTION_KEY = "prestige_luxor_attribution";
const TRACKED_QUERY_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid"];

function readAttribution() {
  try {
    return JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY)) || {};
  } catch {
    return {};
  }
}

function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const incoming = Object.fromEntries(TRACKED_QUERY_KEYS.map((key) => [key, params.get(key) || ""]).filter(([, value]) => value));
  const current = readAttribution();
  const attribution = {
    ...current,
    ...incoming,
    landing_page: current.landing_page || `${window.location.pathname}${window.location.search}`,
    first_referrer: current.first_referrer || document.referrer || "direct",
  };
  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Tracking remains best-effort when storage is unavailable.
  }
  return attribution;
}

const attribution = captureAttribution();

window.prestigeAttribution = () => ({ ...attribution });
window.prestigeTrack = (eventName, properties = {}) => {
  const detail = {
    page_path: window.location.pathname,
    page_title: document.title,
    ...attribution,
    ...properties,
  };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...detail });
  if (typeof window.gtag === "function") window.gtag("event", eventName, detail);
};

function formType(form) {
  if (form.matches("[data-location-quote]")) return "location_quote";
  if (form.matches("[data-quote-form]")) return "homepage_quote";
  if (form.matches("[data-marque-form]")) return "marque_availability";
  if (form.matches("[data-vehicle-request-form]")) return "vehicle_availability";
  if (form.matches("[data-wedding-form]")) return "wedding_inquiry";
  if (form.matches("[data-partner-form]")) return "partner_application";
  return form.getAttribute("aria-label") || form.id || "website_form";
}

const startedForms = new WeakSet();
document.addEventListener("focusin", (event) => {
  const form = event.target.closest("form");
  if (!form || startedForms.has(form)) return;
  startedForms.add(form);
  window.prestigeTrack("form_started", { form_type: formType(form) });
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("form");
  if (!form) return;
  window.prestigeTrack("form_submit_attempted", { form_type: formType(form) });
}, true);

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  const context = link.closest("header") ? "header" : link.closest("footer") ? "footer" : link.closest(".hero, [class*='hero']") ? "hero" : "content";
  if (href.startsWith("tel:")) window.prestigeTrack("call_clicked", { link_context: context });
  else if (href.startsWith("sms:")) window.prestigeTrack("text_clicked", { link_context: context });
  else if (href.startsWith("mailto:")) window.prestigeTrack("email_clicked", { link_context: context });
  else if (href.includes("#quote") || href.includes("#location-quote")) window.prestigeTrack("quote_cta_clicked", { link_context: context });
  else if (/^\/cars\//.test(href)) window.prestigeTrack("vehicle_clicked", { link_context: context, vehicle_slug: href.split("/").pop().replace(/\.html$/, "") });
});
