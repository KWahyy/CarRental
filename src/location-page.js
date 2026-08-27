import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260720";

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function track(eventName, properties = {}) {
  if (typeof window.prestigeTrack === "function") {
    window.prestigeTrack(eventName, properties);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...properties });
  if (typeof window.gtag === "function") window.gtag("event", eventName, properties);
}

for (const form of document.querySelectorAll("[data-location-quote]")) {
  const status = form.querySelector("[data-location-quote-status]");
  const submit = form.querySelector("button[type='submit']");
  const pickupDate = form.elements.date;
  const returnDate = form.elements.returnDate;
  const locationSlug = form.dataset.locationSlug || "location";
  const locationName = form.dataset.locationName || "Southern California";
  let started = false;

  if (pickupDate) pickupDate.min = localDateValue();
  if (returnDate) returnDate.min = localDateValue();
  pickupDate?.addEventListener("change", () => {
    if (!returnDate) return;
    returnDate.min = pickupDate.value || localDateValue();
    if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = returnDate.min;
  });

  form.addEventListener("focusin", () => {
    if (started) return;
    started = true;
    track("quote_started", { form_type: "location_quote", location_slug: locationSlug });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const vehicle = String(data.get("vehicle") || "Vehicle recommendation requested");
    const returnValue = String(data.get("returnDate") || "Not provided");
    const deliveryLocation = String(data.get("deliveryLocation") || "Not provided");
    const notes = String(data.get("message") || "");
    const payload = {
      source: `location-page-${locationSlug}`,
      name: data.get("name") || "",
      phone: data.get("phone") || "",
      email: data.get("email") || "",
      date: data.get("date") || "",
      vehicle,
      addons: [],
      message: [`Service area: ${locationName}`, `Return date: ${returnValue}`, `Delivery city or ZIP: ${deliveryLocation}`, notes].filter(Boolean).join("\n"),
      company: data.get("company") || "",
      pageUrl: window.location.href,
    };

    submit.disabled = true;
    submit.textContent = "Sending request...";
    form.setAttribute("aria-busy", "true");
    status.dataset.tone = "";
    status.textContent = "Saving your private availability request...";
    track("quote_submit_attempted", { form_type: "location_quote", location_slug: locationSlug, vehicle });

    try {
      await submitQuoteRequest(payload);
      status.dataset.tone = "success";
      status.textContent = "Request received. A Prestige Luxor concierge will contact you shortly.";
      track("location_quote_confirmation_shown", { location_slug: locationSlug, vehicle });
      form.reset();
      if (pickupDate) pickupDate.min = localDateValue();
      if (returnDate) returnDate.min = localDateValue();
    } catch (error) {
      status.dataset.tone = "error";
      status.textContent = error?.message || "We could not save this request. Please call or text the concierge.";
      track("quote_submit_failed", { form_type: "location_quote", location_slug: locationSlug });
    } finally {
      submit.disabled = false;
      submit.textContent = "Check availability";
      form.removeAttribute("aria-busy");
    }
  });
}
