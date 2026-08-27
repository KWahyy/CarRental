import { fleet as bundledFleet, formatPrice } from "./fleet-data.js?v=fleet-consistency-20260715";
import { isSupabaseFleetConfigured, loadFleetFromSupabase, optimizedFleetImageUrl, recordFleetEvent } from "./supabase-fleet.js?v=fleet-images-20260818";
import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260720";

const grid = document.querySelector("[data-lamborghini-grid]");
const inventoryNote = document.querySelector("[data-lamborghini-note]");
const form = document.querySelector("[data-lamborghini-form]");
const vehicleSelect = document.querySelector("[data-lamborghini-select]");
const status = document.querySelector("[data-lamborghini-status]");
const submitButton = form?.querySelector("button[type='submit']");
const CAMPAIGN_SOURCE = "google-ads-landing-page";
const marque = document.body.dataset.marque || "Lamborghini";
const marqueLower = marque.toLowerCase();
const landingPath = document.body.dataset.landingPath || `/${marqueLower}`;
const marquePattern = new RegExp(marque, "i");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isRequestedMarque(car) {
  return marquePattern.test([car.make, car.name, car.model].filter(Boolean).join(" "));
}

function slugFor(car) {
  return car.slug || String(car.name || marqueLower).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function originalImage(car) {
  return car.image || car.image_url || car.gallery?.[0] || "/assets/optimized/prestige-luxor-hero.webp";
}

function optimizedImage(car) {
  return optimizedFleetImageUrl(originalImage(car), {
    width: 900,
    height: 675,
    quality: 76,
    updatedAt: car.updatedAt || car.updated_at,
  });
}

function displayModel(car) {
  const prefix = new RegExp(`^\\d{4}\\s+${marque}\\s+`, "i");
  const makeOnly = new RegExp(`^${marque}\\s+`, "i");
  return String(car.model || car.name || marque).replace(prefix, "").replace(makeOnly, "");
}

function campaignParams() {
  const params = new URLSearchParams(window.location.search);
  const allowed = ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  return allowed.map((key) => [key, params.get(key)]).filter(([, value]) => value);
}

function track(event, detail = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, page_type: `${marqueLower}_google_ads_landing_page`, ...detail });
}

function renderInventory(source) {
  const cars = source.filter(isRequestedMarque).sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  vehicleSelect.innerHTML = [
    '<option value="">Choose a vehicle</option>',
    ...cars.map((car) => `<option value="${escapeHtml(car.name)}">${escapeHtml(car.name)} — ${escapeHtml(formatPrice(car.price))}/day</option>`),
  ].join("");

  if (!cars.length) {
    grid.innerHTML = `<div class="lambo-empty"><strong>Current vehicles are being updated.</strong><p>Call the concierge for today’s ${escapeHtml(marque)} availability.</p><a href="tel:+19496200024">Call (949) 620-0024</a></div>`;
    inventoryNote.textContent = `Call for the current ${marque} selection.`;
    return;
  }

  grid.innerHTML = cars.map((car, index) => {
    const original = originalImage(car);
    const model = displayModel(car);
    const year = String(car.name || "").match(/^\d{4}/)?.[0] || "Available";
    return `
      <article class="lambo-card">
        <a class="lambo-card-media" href="/cars/${escapeHtml(slugFor(car))}" aria-label="View ${escapeHtml(car.name)}">
          <img src="${escapeHtml(optimizedImage(car))}" alt="${escapeHtml(car.name)} available for rent from Prestige Luxor" width="900" height="675" loading="${index < 3 ? "eager" : "lazy"}" decoding="async"${index === 0 ? ' fetchpriority="high"' : ""} onerror="this.onerror=null;this.src='${escapeHtml(original)}'" />
        </a>
        <div class="lambo-card-body">
          <div><span>${escapeHtml(year)} · ${escapeHtml(marque)}</span><h3>${escapeHtml(model)}</h3></div>
          <p class="lambo-card-price"><span>From</span><strong>${escapeHtml(formatPrice(car.price))}</strong><small>/day</small></p>
        </div>
        <button type="button" data-select-lamborghini="${escapeHtml(car.name)}">Check This Car <span aria-hidden="true">↗</span></button>
      </article>`;
  }).join("");
  inventoryNote.textContent = `${cars.length} ${marque} ${cars.length === 1 ? "vehicle" : "vehicles"} currently listed. Rates and availability are verified for your dates.`;
}

async function hydrateInventory() {
  renderInventory(bundledFleet);
  if (!isSupabaseFleetConfigured) return;
  try {
    const cloudFleet = await loadFleetFromSupabase();
    if (Array.isArray(cloudFleet)) renderInventory(cloudFleet);
  } catch (error) {
    console.warn(`Could not refresh ${marque} inventory:`, error);
  }
}

function localDateValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function setDateMinimums() {
  const pickup = form.elements.date;
  const returnDate = form.elements.returnDate;
  const today = localDateValue();
  pickup.min = today;
  returnDate.min = pickup.value || today;
  if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = returnDate.min;
}

grid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-lamborghini]");
  if (!button) return;
  vehicleSelect.value = button.dataset.selectLamborghini;
  document.querySelector("#availability")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => form.elements.date.focus(), 450);
  track(`select_${marqueLower}`, { vehicle: vehicleSelect.value });
});

form?.elements.date.addEventListener("change", setDateMinimums);
setDateMinimums();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const attribution = campaignParams();
  const alternatives = Boolean(data.get("alternatives"));
  const message = [
    `${marque} Google Ads landing-page request.`,
    `Return date: ${data.get("returnDate")}`,
    `Delivery city or ZIP: ${data.get("deliveryLocation")}`,
    `Similar ${marque} options approved: ${alternatives ? "Yes" : "No"}`,
    ...attribution.map(([key, value]) => `${key}: ${value}`),
  ].join("\n");
  const payload = {
    requestType: "quote",
    source: CAMPAIGN_SOURCE,
    name: data.get("name") || "",
    phone: data.get("phone") || "",
    email: data.get("email") || "",
    vehicle: data.get("vehicle") || `${marque} — help me choose`,
    date: data.get("date") || "",
    insuranceProvider: "",
    addons: alternatives ? [`Similar ${marque} options approved`] : [],
    message,
    company: data.get("company") || "",
    pageUrl: window.location.href,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Checking your request…";
  status.dataset.tone = "";
  status.textContent = "Sending your dates to the Prestige Luxor concierge…";
  track(`${marqueLower}_lead_submit`, { vehicle: payload.vehicle });

  try {
    const result = await submitQuoteRequest(payload);
    status.dataset.tone = "success";
    status.textContent = `Request received. A Prestige Luxor concierge will verify the ${marque}, dates, and exact rate with you.`;
    submitButton.textContent = "Request Received";
    form.querySelectorAll("input, select, button").forEach((control) => { control.disabled = true; });
    track(`${marqueLower}_lead_success`, { vehicle: payload.vehicle, quote_id: result.id || "" });
    void recordFleetEvent("availability_submit", {
      carSlug: slugFor({ name: payload.vehicle }),
      metadata: { source: CAMPAIGN_SOURCE, landing_page: landingPath },
    });
  } catch (error) {
    status.dataset.tone = "error";
    status.textContent = error.message || "Your request could not be sent. Call (949) 620-0024 for immediate help.";
    submitButton.disabled = false;
    submitButton.textContent = "Get Availability & Exact Rate";
    track(`${marqueLower}_lead_error`, { error_message: error.message || "unknown" });
  }
});

document.querySelectorAll("[data-campaign-call]").forEach((link) => {
  link.addEventListener("click", () => track(`${marqueLower}_call_click`, { link_location: link.closest("header") ? "header" : "page" }));
});

hydrateInventory();
track(`${marqueLower}_landing_view`);
