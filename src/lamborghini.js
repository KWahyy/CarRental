import { fleet as bundledFleet, formatPrice } from "./fleet-data.js?v=fleet-consistency-20260715";
import { fleetPictureMarkup, recordFleetEvent } from "./supabase-fleet.js?v=native-picture-flow-20260901";
import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260720";

const grid = document.querySelector("[data-lamborghini-grid]");
const inventoryNote = document.querySelector("[data-lamborghini-note]");
const form = document.querySelector("[data-lamborghini-form]");
const vehicleSelect = document.querySelector("[data-lamborghini-select]");
const status = document.querySelector("[data-lamborghini-status]");
const submitButton = form?.querySelector("button[type='submit']");
const formSteps = form ? [...form.querySelectorAll("[data-form-step]")] : [];
const formProgress = form ? [...form.querySelectorAll("[data-form-progress]")] : [];
const selectionSummary = form?.querySelector("[data-lamborghini-summary]");
const deliveryMobile = form?.elements.deliveryLocation;
const deliveryDesktop = form?.elements.deliveryLocationDesktop;
const mobileLayout = window.matchMedia("(max-width: 700px)");
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

function updateSelectedVehicle() {
  const selected = vehicleSelect?.value || "";
  grid?.querySelectorAll("[data-select-lamborghini]").forEach((button) => {
    const isSelected = button.dataset.selectLamborghini === selected;
    button.setAttribute("aria-pressed", String(isSelected));
    button.closest(".lambo-card")?.classList.toggle("is-selected", isSelected);
    const label = button.querySelector("[data-select-label]");
    if (label) label.textContent = isSelected ? "Selected" : "Check This Car";
  });
}

function displayDate(value) {
  if (!value) return "date not selected";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function updateSelectionSummary() {
  if (!selectionSummary || !form) return;
  const vehicle = form.elements.vehicle?.value || "Lamborghini not selected";
  const pickup = displayDate(form.elements.date?.value);
  const returnDate = displayDate(form.elements.returnDate?.value);
  const location = (mobileLayout.matches ? deliveryMobile?.value : deliveryDesktop?.value)?.trim() || "delivery location not entered";
  selectionSummary.textContent = `${vehicle} · ${pickup} to ${returnDate} · ${location}`;
}

function syncResponsiveDeliveryField() {
  if (!deliveryMobile || !deliveryDesktop) return;
  deliveryMobile.disabled = !mobileLayout.matches;
  deliveryDesktop.disabled = mobileLayout.matches;
}

function setActiveFormStep(stepNumber, { focus = true } = {}) {
  if (formSteps.length !== 2) return;
  formSteps.forEach((step) => step.classList.toggle("is-active", step.dataset.formStep === String(stepNumber)));
  formProgress.forEach((item) => {
    const isActive = item.dataset.formProgress === String(stepNumber);
    item.classList.toggle("is-active", isActive);
    if (isActive) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  if (focus) {
    const target = formSteps.find((step) => step.dataset.formStep === String(stepNumber));
    target?.querySelector("input:not([type='hidden']), select")?.focus({ preventScroll: true });
  }
}

function validateFormStep(step) {
  if (!step) return true;
  const invalid = [...step.querySelectorAll("input, select")].find((control) => !control.checkValidity());
  if (!invalid) return true;
  invalid.reportValidity();
  return false;
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
    const model = displayModel(car);
    const year = String(car.name || "").match(/^\d{4}/)?.[0] || "Available";
    return `
      <article class="lambo-card">
        <a class="lambo-card-media" href="/cars/${escapeHtml(slugFor(car))}" aria-label="View ${escapeHtml(car.name)}">
          ${fleetPictureMarkup(originalImage(car), { alt: `${car.name} available for rent from Prestige Luxor`, width: 900, height: 675, quality: 76, updatedAt: car.updatedAt || car.updated_at, loading: index < 3 ? "eager" : "lazy", fetchPriority: index === 0 ? "high" : "" })}
        </a>
        <div class="lambo-card-body">
          <div><span>${escapeHtml(year)} · ${escapeHtml(marque)}</span><h3>${escapeHtml(model)}</h3></div>
          <p class="lambo-card-price"><span>From</span><strong>${escapeHtml(formatPrice(car.price))}</strong><small>/day</small></p>
        </div>
        <button type="button" data-select-lamborghini="${escapeHtml(car.name)}" aria-pressed="false"><span data-select-label>Check This Car</span><span aria-hidden="true">↗</span></button>
      </article>`;
  }).join("");
  updateSelectedVehicle();
  inventoryNote.textContent = `${cars.length} ${marque} ${cars.length === 1 ? "vehicle" : "vehicles"} currently listed. Rates and availability are verified for your dates.`;
}

function hydrateInventory() {
  renderInventory(bundledFleet);
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
  updateSelectedVehicle();
  updateSelectionSummary();
  document.querySelector("#availability")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => form.elements.date.focus(), 450);
  track(`select_${marqueLower}`, { vehicle: vehicleSelect.value });
});

form?.elements.date.addEventListener("change", setDateMinimums);
setDateMinimums();
syncResponsiveDeliveryField();
mobileLayout.addEventListener?.("change", syncResponsiveDeliveryField);

if (formSteps.length === 2) {
  form.classList.add("is-stepped");
  setActiveFormStep(1, { focus: false });
  form.querySelector("[data-form-next]")?.addEventListener("click", () => {
    if (!validateFormStep(formSteps[0])) return;
    updateSelectionSummary();
    setActiveFormStep(2);
    track(`${marqueLower}_lead_step_complete`, { step: 1, vehicle: vehicleSelect.value });
  });
  form.querySelector("[data-form-back]")?.addEventListener("click", () => setActiveFormStep(1));
  form.addEventListener("input", updateSelectionSummary);
  form.addEventListener("change", updateSelectionSummary);
  vehicleSelect?.addEventListener("change", updateSelectedVehicle);
  updateSelectionSummary();
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const invalidStep = formSteps.find((step) => ![...step.querySelectorAll("input, select")].every((control) => control.checkValidity()));
  if (invalidStep) {
    setActiveFormStep(Number(invalidStep.dataset.formStep || 1), { focus: false });
    validateFormStep(invalidStep);
    return;
  }
  const data = new FormData(form);
  const attribution = campaignParams();
  const alternatives = Boolean(data.get("alternatives"));
  const message = [
    `${marque} Google Ads landing-page request.`,
    `Return date: ${data.get("returnDate")}`,
    `Delivery city or ZIP: ${data.get("deliveryLocation") || data.get("deliveryLocationDesktop")}`,
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
    submitButton.textContent = marque === "Lamborghini" ? "Request My Lamborghini" : "Get Availability & Exact Rate";
    track(`${marqueLower}_lead_error`, { error_message: error.message || "unknown" });
  }
});

document.querySelectorAll("[data-campaign-call]").forEach((link) => {
  link.addEventListener("click", () => track(`${marqueLower}_call_click`, { link_location: link.closest("header") ? "header" : "page" }));
});

document.querySelectorAll("[data-animate-headline]").forEach((headline) => {
  headline.classList.add("is-animated");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    headline.classList.add("is-visible");
    return;
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    headline.classList.add("is-visible");
    observer.disconnect();
  }, { threshold: 0.35, rootMargin: "0px 0px -8%" });

  observer.observe(headline);
});

const mobileCta = document.querySelector(".lambo-mobile-cta");
const availabilityCard = document.querySelector("#availability");

if (marque === "Lamborghini" && mobileCta && availabilityCard && "IntersectionObserver" in window) {
  const mobileCtaObserver = new IntersectionObserver(([entry]) => {
    mobileCta.classList.toggle("is-suppressed", entry.isIntersecting);
  }, { threshold: 0.08 });

  mobileCtaObserver.observe(availabilityCard);
}

hydrateInventory();
track(`${marqueLower}_landing_view`);
