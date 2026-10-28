import { currentAttribution } from './lead-attribution.js';
import { initMetaConsent } from "./meta-tracking.js?v=20260909";

// Keep top-of-page navigation out of the address bar, including older #top links.
function clearTopFragment() {
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
}
if (window.location.hash === "#top") clearTopFragment();

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("a[href]");
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
  const destination = new URL(link.href, window.location.href);
  if (destination.hash !== "#top" || destination.origin !== window.location.origin
    || destination.pathname !== window.location.pathname || destination.search !== window.location.search) return;
  event.preventDefault();
  clearTopFragment();
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
});

initMetaConsent();

const GOOGLE_ADS_HOSTS = new Set(["prestigeluxor.com", "www.prestigeluxor.com"]);
const attribution = currentAttribution();
window.prestigeAttribution = currentAttribution;
window.prestigeTrack = (eventName, properties = {}) => {
  const detail = {
    page_path: window.location.pathname,
    page_title: document.title,
    acquisition_source: attribution.source,
    acquisition_channel: attribution.channel,
    landing_page: attribution.landing_page,
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
  if (href.startsWith("tel:")) {
    window.prestigeTrack("call_clicked", { link_context: context });
    if (GOOGLE_ADS_HOSTS.has(window.location.hostname) && typeof window.gtag_report_call_conversion === "function") {
      event.preventDefault();
      window.gtag_report_call_conversion(href);
    }
  }
  else if (href.startsWith("sms:")) window.prestigeTrack("text_clicked", { link_context: context });
  else if (href.startsWith("mailto:")) window.prestigeTrack("email_clicked", { link_context: context });
  else if (href.includes("#quote") || href.includes("#location-quote")) window.prestigeTrack("quote_cta_clicked", { link_context: context });
  else if (/^\/cars\//.test(href)) window.prestigeTrack("vehicle_clicked", { link_context: context, vehicle_slug: href.split("/").pop().replace(/\.html$/, "") });
});
