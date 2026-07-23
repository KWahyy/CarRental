import {
  cacheSafeFleetImageUrl,
  isSupabaseFleetConfigured,
  loadVehicleFromSupabase,
} from "./supabase-fleet.js?v=campaign-cloud-fleet-20260718";
import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260720";

const form = document.querySelector("[data-campaign-form]");
const status = document.querySelector("[data-campaign-status]");
const submitButton = form?.querySelector("button[type='submit']");
const successPanel = document.querySelector("[data-campaign-success]");
const formSteps = form ? [...form.querySelectorAll("[data-form-step]")] : [];
const stepIndicators = form ? [...form.querySelectorAll("[data-step-indicator]")] : [];
const stepLabel = form?.querySelector("[data-step-label]");

function localDateValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function trackCampaignEvent(eventName, details = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...details });

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, details);
  }
}

function setStatus(message, tone = "") {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function showValidationError(field) {
  field.setAttribute("aria-invalid", String(!field.checkValidity()));
}

function showFormStep(stepNumber) {
  formSteps.forEach((step) => {
    step.hidden = Number(step.dataset.formStep) !== stepNumber;
  });
  stepIndicators.forEach((indicator) => {
    if (Number(indicator.dataset.stepIndicator) === stepNumber) indicator.setAttribute("aria-current", "step");
    else indicator.removeAttribute("aria-current");
  });
  if (stepLabel) stepLabel.textContent = stepNumber === 1 ? "Car and date" : "Your contact details";
  form.dataset.currentStep = String(stepNumber);
}

function brandFromVehicle(value) {
  const vehicle = String(value || "").toLowerCase();
  const brandAliases = [
    ["Rolls-Royce", ["rolls-royce", "rolls royce", "cullinan"]],
    ["Mercedes-Benz", ["mercedes", "maybach", "amg"]],
    ["Land Rover", ["land rover", "range rover"]],
    ["Chevrolet", ["chevrolet", "chevy", "corvette", "c8"]],
    ["Lamborghini", ["lamborghini", "huracan", "urus"]],
    ["McLaren", ["mclaren"]],
    ["Ferrari", ["ferrari"]],
    ["Porsche", ["porsche"]],
    ["Cadillac", ["cadillac", "escalade"]],
    ["Bentley", ["bentley", "continental"]],
    ["Audi", ["audi"]],
    ["BMW", ["bmw"]],
    ["Ford", ["ford"]],
    ["Lotus", ["lotus"]],
    ["Tesla", ["tesla"]],
  ];

  return brandAliases.find(([, aliases]) => aliases.some((alias) => vehicle.includes(alias)))?.[0] || "Help me choose";
}

function loadDecodedImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error("The current vehicle photo could not be loaded."));
    image.src = url;
  });
}

async function hydrateCampaignCar(card) {
  const slug = card.dataset.campaignCar;
  const image = card.querySelector("[data-campaign-car-image]");
  if (!slug || !image || !isSupabaseFleetConfigured) {
    card.dataset.cloudState = "unavailable";
    card.removeAttribute("aria-busy");
    return;
  }

  try {
    const car = await loadVehicleFromSupabase(slug);
    const primaryPhoto = car?.gallery?.[0] || car?.image;
    if (!car || !primaryPhoto) throw new Error("The current vehicle record has no primary photo.");

    const photoUrl = cacheSafeFleetImageUrl(primaryPhoto, car.updatedAt);
    await loadDecodedImage(photoUrl);

    image.src = photoUrl;
    image.alt = `${car.name} available from KD's Exotics`;
    card.querySelectorAll("[data-campaign-car-link]").forEach((link) => {
      link.setAttribute("href", `/cars/${car.slug}.html`);
      if (link.classList.contains("campaign-car-media")) link.setAttribute("aria-label", `View the ${car.name}`);
    });
    card.querySelector("[data-campaign-car-make]").textContent = car.make || "Lamborghini";
    card.querySelector("[data-campaign-car-name]").textContent = String(car.name || car.model || "Huracan").replace(/^\d{4}\s+/, "");
    card.querySelector("[data-campaign-car-price]").textContent = car.price
      ? `From $${Number(car.price).toLocaleString()}/day`
      : "Pricing by request";

    const requestButton = card.querySelector("[data-select-car]");
    if (requestButton) requestButton.dataset.selectCar = car.name;

    card.dataset.cloudState = "ready";
  } catch (error) {
    console.error("Unable to hydrate campaign vehicle from Supabase:", error);
    card.dataset.cloudState = "error";
    card.querySelector("[data-campaign-car-price]").textContent = "Call for live availability";
  } finally {
    card.removeAttribute("aria-busy");
  }
}

document.querySelectorAll("[data-campaign-car]").forEach((card) => {
  void hydrateCampaignCar(card);
});

if (form) {
  const rentalDate = form.elements.date;
  if (rentalDate) rentalDate.min = localDateValue();
  showFormStep(1);

  form.querySelector("[data-step-next]")?.addEventListener("click", () => {
    const firstStep = form.querySelector('[data-form-step="1"]');
    const invalidField = firstStep?.querySelector(":invalid");
    if (invalidField) {
      firstStep.querySelectorAll("input[required], select[required]").forEach(showValidationError);
      invalidField.focus();
      setStatus("Choose a brand and rental date to continue.", "error");
      return;
    }
    setStatus("Insurance and deposit are confirmed after availability.");
    showFormStep(2);
    form.elements.name?.focus();
    trackCampaignEvent("campaign_quote_step", { step: 2 });
  });

  form.querySelector("[data-step-back]")?.addEventListener("click", () => {
    showFormStep(1);
    form.elements.vehicle?.focus();
  });

  form.addEventListener("input", (event) => {
    const field = event.target.closest("input, select");
    if (field?.checkValidity()) field.removeAttribute("aria-invalid");
  });

  form.addEventListener("focusout", (event) => {
    const field = event.target.closest("input[required], select[required]");
    if (field) showValidationError(field);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const invalidField = form.querySelector(":invalid");
    if (invalidField) {
      [...form.querySelectorAll("input[required], select[required]")].forEach(showValidationError);
      if (invalidField.closest('[data-form-step="1"]')) showFormStep(1);
      invalidField.focus();
      setStatus("Complete the highlighted details so we can check availability.", "error");
      return;
    }

    const formData = new FormData(form);
    const payload = {
      source: "google-ads-landing-page",
      name: formData.get("name") || "",
      phone: formData.get("phone") || "",
      email: formData.get("email") || "",
      insuranceProvider: "To be confirmed after availability",
      date: formData.get("date") || "",
      vehicle: formData.get("vehicle") || "Help me choose",
      addons: ["Delivery"],
      message: "Google Ads landing page brand request.",
      company: formData.get("company") || "",
      pageUrl: window.location.href,
    };

    submitButton.disabled = true;
    submitButton.querySelector("span").textContent = "Sending request...";
    form.setAttribute("aria-busy", "true");
    setStatus("Securely saving your request...");

    try {
      const result = await submitQuoteRequest(payload);

      trackCampaignEvent("generate_lead", {
        lead_source: "google_ads_landing_page",
        vehicle: payload.vehicle,
        notification: result.notification || "unknown",
      });

      setStatus("Request received.", "success");
      form.reset();
      if (rentalDate) rentalDate.min = localDateValue();
      form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.focus({ preventScroll: true });
    } catch (error) {
      setStatus(`${error.message || "We could not save this request."} Call (213) 264-2967 for immediate help.`, "error");
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "Get my exact rate";
      form.removeAttribute("aria-busy");
    }
  });
}

document.querySelectorAll("[data-select-car]").forEach((button) => {
  button.addEventListener("click", () => {
    const selectedCar = button.dataset.selectCar;
    const selectedBrand = brandFromVehicle(selectedCar);
    const vehicleSelect = form?.elements.vehicle;
    if (vehicleSelect) vehicleSelect.value = selectedBrand;
    document.querySelector("#quote-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => vehicleSelect?.focus({ preventScroll: true }), 450);
    trackCampaignEvent("select_campaign_vehicle", { vehicle: selectedCar, brand: selectedBrand });
  });
});

document.querySelectorAll("[data-track]").forEach((link) => {
  link.addEventListener("click", () => trackCampaignEvent("campaign_phone_click", { placement: link.dataset.track }));
});
