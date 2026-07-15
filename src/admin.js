import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { deleteCarDraft, readDeletedCarSlugs, signalFleetRefresh, slugifyVehicle } from "./admin-store.js?v=cloud-delete-20260714";
import { fleet } from "./fleet-data.js?v=fleet-sync-20260714";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_STORAGE_BUCKET, SUPABASE_URL } from "./supabase-config.js?v=fleet-sync-20260714";

const unsafeParams = new URLSearchParams(window.location.search);
if (unsafeParams.has("email") || unsafeParams.has("password")) {
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
}

const loginView = document.querySelector("[data-login-view]");
const adminView = document.querySelector("[data-admin-view]");
const loginForm = document.querySelector("[data-login-form]");
const loginStatus = document.querySelector("[data-login-status]");
const adminStatus = document.querySelector("[data-admin-status]");
const configWarning = document.querySelector("[data-config-warning]");
const signOutButton = document.querySelector("[data-sign-out]");
const seedButton = document.querySelector("[data-seed-fleet]");
const newCarButton = document.querySelector("[data-new-car]");
const newDashboardCarButton = document.querySelector("[data-new-dashboard-car]");
const deleteCarButton = document.querySelector("[data-delete-car]");
const carList = document.querySelector("[data-car-list]");
const carCount = document.querySelector("[data-car-count]");
const carForm = document.querySelector("[data-car-form]");
const editorTitle = document.querySelector("[data-editor-title]");
const editorPreview = document.querySelector("[data-editor-preview]");
const editorPrice = document.querySelector("[data-editor-price]");
const editorMeta = document.querySelector("[data-editor-meta]");
const photoList = document.querySelector("[data-photo-list]");
const addPhotoButton = document.querySelector("[data-add-photo]");
const availabilityInput = document.querySelector("[data-availability-date]");
const availabilityList = document.querySelector("[data-availability-list]");
const sectionButtons = [...document.querySelectorAll("[data-crm-section]")];
const sectionPanels = [...document.querySelectorAll("[data-section-panel]")];
const jumpSectionButtons = [...document.querySelectorAll("[data-jump-section]")];
const carCountDisplays = [...document.querySelectorAll("[data-car-count-display]")];
const overviewStats = document.querySelector("[data-overview-stats]");
const overviewRequests = document.querySelector("[data-overview-requests]");
const overviewCalendar = document.querySelector("[data-overview-calendar]");
const overviewFleetCheck = document.querySelector("[data-admin-fleet-check]");
const overviewFleetReadiness = document.querySelector("[data-fleet-readiness]");
const overviewFleetHighlights = document.querySelector("[data-fleet-highlights]");
const overviewFleetInsights = document.querySelector("[data-fleet-insights]");
const overviewLeadKpis = document.querySelector("[data-lead-kpis]");
const overviewLeadQuality = document.querySelector("[data-lead-quality]");
const overviewBlockers = document.querySelector("[data-blocker-list]");
const overviewRevenueList = document.querySelector("[data-revenue-list]");
const overviewActionQueue = document.querySelector("[data-action-queue]");
const overviewVehicleHealth = document.querySelector("[data-vehicle-health]");
const overviewTrafficInsights = document.querySelector("[data-traffic-insights]");
const dashboardPipeline = document.querySelector("[data-dashboard-pipeline]");
const dashboardUpcoming = document.querySelector("[data-dashboard-upcoming]");
const dashboardPartnerQueue = document.querySelector("[data-dashboard-partner-queue]");
const dashboardPricingAlerts = document.querySelector("[data-dashboard-pricing-alerts]");
const salesYearSelect = document.querySelector("[data-sales-year]");
const salesSummary = document.querySelector("[data-sales-summary]");
const salesChart = document.querySelector("[data-sales-chart]");
const salesComparisonLabel = document.querySelector("[data-sales-comparison-label]");
const salesBreakdown = document.querySelector("[data-sales-breakdown]");
const salesLedger = document.querySelector("[data-sales-ledger]");
const salesLedgerCount = document.querySelector("[data-sales-ledger-count]");
const bookingDialog = document.querySelector("[data-booking-dialog]");
const bookingForm = document.querySelector("[data-booking-form]");
const bookingQuoteSelect = document.querySelector("[data-booking-quote-select]");
const bookingEditorTitle = document.querySelector("[data-booking-editor-title]");
const bookingTotalPreview = document.querySelector("[data-booking-total-preview]");
const bookingStatus = document.querySelector("[data-booking-status]");
const deleteBookingButton = document.querySelector("[data-delete-booking]");
const requestPipeline = document.querySelector("[data-request-pipeline]");
const addDemoRequestButtons = [...document.querySelectorAll("[data-add-demo-request]")];
const calendarGrid = document.querySelector("[data-calendar-grid]");
const contentForm = document.querySelector("[data-content-form]");
const settingsForm = document.querySelector("[data-settings-form]");
const saveContentButton = document.querySelector("[data-save-content]");
const saveSettingsButton = document.querySelector("[data-save-settings]");
const monthlySpecialForm = document.querySelector("[data-monthly-special-form]");
const specialMonthInput = document.querySelector("[data-special-month]");
const specialCarGrid = document.querySelector("[data-special-car-grid]");
const specialSelectionCount = document.querySelector("[data-special-selection-count]");
const specialsStatus = document.querySelector("[data-specials-status]");
const competitorRecommendation = document.querySelector("[data-competitor-recommendation]");
const applyCompetitivePriceButton = document.querySelector("[data-apply-competitive-price]");

const REQUESTS_KEY = "kds-crm-requests";
const CONTENT_KEY = "kds-crm-content";
const SETTINGS_KEY = "kds-crm-settings";

const requestStatuses = [
  { id: "new", label: "New request" },
  { id: "checking", label: "Checking partner" },
  { id: "available", label: "Available / quote ready" },
  { id: "alternative", label: "Alternative offered" },
  { id: "approved", label: "Deposit pending" },
  { id: "booked", label: "Booked" },
];

const defaultRequests = [];

const configured = Boolean(SUPABASE_URL && SUPABASE_URL.startsWith("https://"));
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
const MAX_LISTING_PHOTOS = 3;

let cars = [];
let selectedCarId = null;
let photos = [];
let availableDates = [];
let draggedPhotoIndex = null;
const storedRequestDraft = readJson(REQUESTS_KEY, defaultRequests);
let requests = sanitizeRequests(storedRequestDraft);
if (requests.length !== storedRequestDraft.length) writeJson(REQUESTS_KEY, requests);
let contentDraft = readJson(CONTENT_KEY, {
  heroHeadline: "Not Your Average Rental",
  specialHeadline: "Monthly Rental Specials",
  photographyText: "Book the car, add a shooter, and leave with campaign-ready content.",
  faqNote: "Valid license, insurance, and deposit may be required before approval.",
});
let businessSettings = readJson(SETTINGS_KEY, {
  phone: "",
  email: "",
  instagram: "",
  responseTarget: "Under 15 minutes",
  bookingNotes: "",
});
let selectedSpecialSlugs = [];
const MAX_MONTHLY_SPECIAL_CARS = 2;
let trafficEvents = [];
let trafficAnalyticsError = "";
let salesBookings = [];
let salesDataError = "";
let selectedSalesYear = new Date().getFullYear();

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function sanitizeRequests(value) {
  return (Array.isArray(value) ? value : [])
    .filter((request) => {
      const id = String(request?.id || "");
      const name = String(request?.name || "");
      const message = String(request?.message || "");
      return !(
        id.startsWith("demo-") ||
        (name === "VIP client" && message.includes("Evening content package")) ||
        (name === "Weekend booking" && message.includes("Needs final date"))
      );
    })
    .map((request) => (request.status === "contacted" ? { ...request, status: "checking" } : request));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Date TBD";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function dashboardCars() {
  return (cars.length ? cars : localFleetCars()).filter((car) => car.is_active !== false);
}

function galleryCount(car) {
  return Array.isArray(car.gallery) ? car.gallery.filter(Boolean).length : 0;
}

function hasStrongGallery(car) {
  return galleryCount(car) >= 3;
}

function carDailyRate(car) {
  return Number(car?.price || 0);
}

function carDisplayMake(car) {
  return car?.make || car?.category_label || "Vehicle";
}

function carLabel(car) {
  return [carDisplayMake(car), car?.model].filter(Boolean).join(" · ");
}

function requestMatchesCar(request, car) {
  const requested = String(request?.vehicle || "").toLowerCase();
  return Boolean(requested && car?.name && requested.includes(String(car.name).toLowerCase()));
}

function matchedRequestCar(request, fleetCars = dashboardCars()) {
  return fleetCars.find((car) => requestMatchesCar(request, car)) || null;
}

function requestValue(request, fleetCars = dashboardCars()) {
  const car = matchedRequestCar(request, fleetCars);
  return carDailyRate(car);
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function switchSection(section, activeButton = null) {
  const selectedButton = activeButton || sectionButtons.find((button) => button.dataset.crmSection === section);
  sectionButtons.forEach((button) => {
    button.classList.toggle("active", button === selectedButton);
  });
  sectionPanels.forEach((panel) => {
    const active = panel.dataset.sectionPanel === section;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function fillStoredForms() {
  if (contentForm) {
    Object.entries(contentDraft).forEach(([key, value]) => {
      if (contentForm.elements[key]) contentForm.elements[key].value = value;
    });
  }

  if (settingsForm) {
    Object.entries(businessSettings).forEach(([key, value]) => {
      if (settingsForm.elements[key]) settingsForm.elements[key].value = value;
    });
  }
}

function requestStatusLabel(status) {
  return requestStatuses.find((item) => item.id === status)?.label || "New lead";
}

function isLocalCarId(id) {
  return String(id || "").startsWith("local:");
}

function setStatus(node, message, tone = "") {
  node.textContent = message;
  node.dataset.tone = tone;
}

function friendlyError(error) {
  const message = error?.message || String(error);
  if (message.includes("monthly_specials")) {
    return "Monthly specials setup is required. Run supabase/monthly-specials.sql once in the Supabase SQL Editor, then reload this page.";
  }
  if (message.includes("schema cache") || message.includes("public.cars") || message.includes("relation")) {
    return "Cloud database setup needed. Run supabase/schema.sql in Supabase SQL Editor, then click Sync website fleet.";
  }
  if (message.includes("row-level security")) {
    return "Supabase permission setup needs attention. Re-run supabase/schema.sql, then try again.";
  }
  return message;
}

const optionalCarColumns = ["competitor_price", "competitor_name", "competitor_url", "competitor_checked_at"];
let supportsCompetitorColumns = true;
let supportsPartnerTable = true;

function isMissingSchemaItem(error, names = []) {
  const message = String(error?.message || error || "").toLowerCase();
  const missingCode = ["PGRST204", "PGRST205", "42P01", "42703"].includes(String(error?.code || ""));
  return missingCode || names.some((name) => message.includes(String(name).toLowerCase()));
}

function carPayloadForCurrentSchema(payload) {
  const nextPayload = { ...payload };
  delete nextPayload.partner_name;
  delete nextPayload.partner_phone;
  if (!supportsCompetitorColumns) optionalCarColumns.forEach((column) => delete nextPayload[column]);
  return nextPayload;
}

async function saveCarRecord(payload, id = "") {
  const execute = (nextPayload) =>
    id
      ? supabase.from("cars").update(nextPayload).eq("id", id).select().single()
      : supabase.from("cars").upsert(nextPayload, { onConflict: "slug" }).select().single();

  let { data, error } = await execute(carPayloadForCurrentSchema(payload));
  if (error && supportsCompetitorColumns && isMissingSchemaItem(error, optionalCarColumns)) {
    supportsCompetitorColumns = false;
    ({ data, error } = await execute(carPayloadForCurrentSchema(payload)));
  }
  if (error) throw error;
  return data;
}

async function savePartnerRecord(carId, partnerName = "", partnerPhone = "") {
  if (!supportsPartnerTable) return false;
  const { error } = await supabase.from("car_partners").upsert(
    {
      car_id: carId,
      partner_name: partnerName,
      partner_phone: partnerPhone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "car_id" },
  );
  if (error && isMissingSchemaItem(error, ["car_partners"])) {
    supportsPartnerTable = false;
    return false;
  }
  if (error) throw error;
  return true;
}

function slugify(value) {
  return slugifyVehicle(value);
}

function linesToArray(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function seatsFor(vehicle) {
  if (vehicle.seats) return vehicle.seats;
  if (vehicle.category?.includes("suv")) return 5;
  if (vehicle.name?.includes("M3")) return 5;
  if (vehicle.name?.includes("M4")) return 4;
  return 2;
}

function normalizeLocalCar(car) {
  return {
    id: `local:${car.slug}`,
    slug: car.slug,
    name: car.name,
    make: car.make,
    model: car.model,
    category: car.category,
    category_label: car.categoryLabel,
    price: car.price,
    mileage: car.mileage,
    color: car.color,
    summary: car.summary,
    seats: seatsFor(car),
    image_url: car.image,
    gallery: car.gallery,
    tags: car.tags,
    details: car.details,
    is_active: true,
    is_featured: true,
    competitor_price: car.competitorPrice || car.competitor_price || null,
    competitor_name: car.competitorName || car.competitor_name || "",
    competitor_url: car.competitorUrl || car.competitor_url || "",
    competitor_checked_at: car.competitorCheckedAt || car.competitor_checked_at || null,
    partner_name: car.partnerName || car.partner_name || "",
    partner_phone: car.partnerPhone || car.partner_phone || "",
    source: "website",
  };
}

function localFleetCars() {
  const deletedSlugs = new Set(readDeletedCarSlugs());
  return fleet
    .filter((car) => !deletedSlugs.has(car.slug))
    .map((car) =>
      normalizeLocalCar({
        ...car,
        categoryLabel: car.categoryLabel || car.category_label,
      }),
    );
}

function emptyCar() {
  return {
    id: "",
    slug: "",
    name: "",
    make: "",
    model: "",
    category: "supercar",
    category_label: "Supercar",
    price: 0,
    mileage: "100 miles/day",
    seats: 2,
    color: "",
    summary: "",
    tags: [],
    details: [],
    is_active: true,
    is_featured: true,
    competitor_price: null,
    competitor_name: "",
    competitor_url: "",
    competitor_checked_at: "",
    partner_name: "",
    partner_phone: "",
  };
}

function updateCompetitorRecommendation() {
  if (!competitorRecommendation || !carForm) return;
  const competitorPrice = Number(carForm.elements.competitor_price?.value || 0);
  if (!competitorPrice) {
    competitorRecommendation.textContent = "Add a competitor rate to calculate the target.";
    if (applyCompetitivePriceButton) applyCompetitivePriceButton.disabled = true;
    return;
  }
  const target = Math.max(0, competitorPrice - 50);
  competitorRecommendation.textContent = `Recommended starting rate: ${formatMoney(target)}/day — $50 below the comparable listing.`;
  if (applyCompetitivePriceButton) applyCompetitivePriceButton.disabled = false;
}

function selectedCar() {
  return cars.find((car) => String(car.id) === String(selectedCarId)) || null;
}

function carImage(car) {
  return car?.image_url || car?.gallery?.[0] || "/assets/kds-hero.png";
}

function previewUrl(photo) {
  return photo?.previewUrl || photo?.url || "/assets/kds-hero.png";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function normalizePhotoOrder() {
  photos = photos.slice(0, MAX_LISTING_PHOTOS).map((photo, index) => ({ ...photo, position: index + 1 }));
}

function updatePhotoPreview() {
  editorPreview.src = previewUrl(photos[0]);
}

function reorderPhotos(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || !photos[fromIndex] || !photos[toIndex]) return;
  const [movedPhoto] = photos.splice(fromIndex, 1);
  photos.splice(toIndex, 0, movedPhoto);
  normalizePhotoOrder();
  renderPhotos();
  updatePhotoPreview();
}

function requireConfig() {
  if (configured) return true;
  configWarning.hidden = false;
  setStatus(adminStatus, "Missing Supabase Project URL. Add it to src/supabase-config.js.", "error");
  return false;
}

async function runQuery(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function showAdmin(isAdmin) {
  loginView.hidden = isAdmin;
  adminView.hidden = !isAdmin;
}

function renderCrmStats() {
  const fleetCars = dashboardCars();
  const newInquiries = requests.filter((request) => request.status === "new").length;
  const partnerChecks = requests.filter((request) => request.status === "checking").length;
  const quotesReady = requests.filter((request) => ["available", "alternative"].includes(request.status)).length;
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthlySales = salesBookings.filter((booking) => String(booking.booked_on || "").startsWith(monthKey));
  const monthlyBookings = monthlySales.length
    ? monthlySales
    : requests.filter((request) => request.status === "booked" && String(request.date || request.createdAt || "").startsWith(monthKey));
  const bookedRevenue = monthlySales.length
    ? monthlySales.reduce((total, booking) => total + bookingTotal(booking), 0)
    : monthlyBookings.reduce((total, request) => total + requestValue(request, fleetCars), 0);

  overviewStats.innerHTML = [
    ["New inquiries", `${newInquiries}`, "Need first response"],
    ["Partner checks", `${partnerChecks}`, "Waiting for availability"],
    ["Quotes ready", `${quotesReady}`, "Customer follow-up"],
    ["Bookings", `${monthlyBookings.length}`, "This month"],
    ["Booked revenue", formatMoney(bookedRevenue), monthlySales.length ? "Recorded sales this month" : "Starting daily value"],
  ]
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(note)}</small>
        </article>
      `,
    )
    .join("");
}

function safePhoneHref(value) {
  const phone = String(value || "").replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : "";
}

function renderOperationsDashboard() {
  const fleetCars = dashboardCars();

  if (dashboardPipeline) {
    dashboardPipeline.innerHTML = requestStatuses
      .map((status) => {
        const count = requests.filter((request) => request.status === status.id).length;
        return `
          <button type="button" class="dashboard-pipeline-step status-${escapeHtml(status.id)}" data-jump-section="requests">
            <span>${escapeHtml(status.label)}</span>
            <strong>${count}</strong>
          </button>
        `;
      })
      .join("");
  }

  if (dashboardUpcoming) {
    const upcoming = requests
      .filter((request) => ["approved", "booked"].includes(request.status) && request.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 5);
    dashboardUpcoming.innerHTML = upcoming.length
      ? upcoming
          .map((request) => `
            <article class="dashboard-operation-row">
              <div class="dashboard-operation-date">
                <span>${escapeHtml(new Date(`${request.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" }))}</span>
                <strong>${escapeHtml(new Date(`${request.date}T12:00:00`).toLocaleDateString("en-US", { day: "numeric" }))}</strong>
              </div>
              <div class="dashboard-operation-copy">
                <strong>${escapeHtml(request.vehicle || "Vehicle TBD")}</strong>
                <span>${escapeHtml(request.name || "Customer")} · ${escapeHtml(request.location || "Delivery location TBD")}</span>
              </div>
              <span class="quote-badge ${escapeHtml(request.status)}">${escapeHtml(requestStatusLabel(request.status))}</span>
            </article>
          `)
          .join("")
      : `<p class="admin-empty">Approved bookings with delivery dates will appear here.</p>`;
  }

  if (dashboardPartnerQueue) {
    const partnerRequests = requests
      .filter((request) =>
        ["new", "checking"].includes(request.status) &&
        (request.requestType === "availability" || request.message?.includes("Manual partner availability check")),
      )
      .slice(0, 6);
    dashboardPartnerQueue.innerHTML = partnerRequests.length
      ? partnerRequests
          .map((request) => {
            const car = matchedRequestCar(request, fleetCars);
            const partnerName = car?.partner_name || car?.partnerName || "Partner not assigned";
            const partnerPhone = car?.partner_phone || car?.partnerPhone || "";
            const customerPhone = safePhoneHref(request.phone);
            return `
              <article class="dashboard-call-row">
                <div>
                  <span>${escapeHtml(requestStatusLabel(request.status))}</span>
                  <strong>${escapeHtml(request.vehicle || "Vehicle TBD")}</strong>
                  <small>${escapeHtml(request.name || "Customer")} · ${escapeHtml(formatDate(request.date))}</small>
                </div>
                <div class="dashboard-call-actions">
                  ${partnerPhone ? `<a href="${escapeHtml(safePhoneHref(partnerPhone))}">Call ${escapeHtml(partnerName)}</a>` : `<button type="button" data-edit-dashboard-car="${escapeHtml(car?.id || "")}" ${car ? "" : "disabled"}>Add partner</button>`}
                  ${customerPhone ? `<a class="secondary" href="${escapeHtml(customerPhone)}">Call customer</a>` : ""}
                </div>
              </article>
            `;
          })
          .join("")
      : `<p class="admin-empty">No shared-fleet availability calls are waiting right now.</p>`;
  }

  if (dashboardPricingAlerts) {
    const pricedCars = fleetCars
      .filter((car) => Number(car.competitor_price || car.competitorPrice || 0) > 0)
      .map((car) => {
        const checkedAt = car.competitor_checked_at || car.competitorCheckedAt || "";
        const age = checkedAt ? Math.floor((Date.now() - new Date(`${checkedAt}T12:00:00`).valueOf()) / 86400000) : Infinity;
        return { car, checkedAt, age };
      })
      .sort((a, b) => b.age - a.age)
      .slice(0, 6);
    dashboardPricingAlerts.innerHTML = pricedCars.length
      ? pricedCars
          .map(({ car, checkedAt, age }) => {
            const competitorPrice = Number(car.competitor_price || car.competitorPrice);
            const target = Math.max(0, competitorPrice - 50);
            const needsCheck = age > 14;
            return `
              <article class="dashboard-price-row">
                <div>
                  <strong>${escapeHtml(car.name)}</strong>
                  <span>${formatMoney(car.price)}/day now · ${formatMoney(competitorPrice)} competitor</span>
                  <small>${checkedAt ? `Checked ${escapeHtml(formatDate(checkedAt))}` : "No check date saved"}</small>
                </div>
                <div>
                  <span class="pricing-health ${needsCheck ? "stale" : "current"}">${needsCheck ? "Recheck" : "Current"}</span>
                  <strong>${formatMoney(target)} target</strong>
                  <button type="button" data-edit-dashboard-car="${escapeHtml(car.id)}">Edit</button>
                </div>
              </article>
            `;
          })
          .join("")
      : `<p class="admin-empty">Add a comparable listing to a vehicle to start pricing monitoring.</p>`;
  }
}

function bookingTotal(booking) {
  if (booking.total_amount !== undefined && booking.total_amount !== null) return Number(booking.total_amount || 0);
  return Math.max(
    0,
    Number(booking.rental_days || 1) * Number(booking.daily_rate || 0) +
      Number(booking.delivery_fee || 0) +
      Number(booking.addons_total || 0) -
      Number(booking.discount || 0),
  );
}

function bookingProfit(booking) {
  return bookingTotal(booking) - Number(booking.partner_cost || 0);
}

function bookingYear(booking) {
  return Number(String(booking.booked_on || booking.created_at || "").slice(0, 4)) || new Date().getFullYear();
}

function renderSalesSystem() {
  if (!salesSummary || !salesChart || !salesLedger) return;

  const currentYear = new Date().getFullYear();
  const availableYears = [...new Set([currentYear, currentYear - 1, ...salesBookings.map(bookingYear)])].sort((a, b) => b - a);
  if (!availableYears.includes(selectedSalesYear)) selectedSalesYear = availableYears[0];
  salesYearSelect.innerHTML = availableYears.map((year) => `<option value="${year}" ${year === selectedSalesYear ? "selected" : ""}>${year}</option>`).join("");

  if (salesDataError) {
    salesSummary.innerHTML = `<p class="admin-empty sales-system-error">${escapeHtml(salesDataError)}</p>`;
  }

  const yearBookings = salesBookings.filter((booking) => bookingYear(booking) === selectedSalesYear);
  const previousBookings = salesBookings.filter((booking) => bookingYear(booking) === selectedSalesYear - 1);
  const gross = yearBookings.reduce((sum, booking) => sum + bookingTotal(booking), 0);
  const collected = yearBookings.reduce((sum, booking) => sum + Number(booking.amount_paid || 0), 0);
  const outstanding = Math.max(0, gross - collected);
  const profit = yearBookings.reduce((sum, booking) => sum + bookingProfit(booking), 0);
  const previousGross = previousBookings.reduce((sum, booking) => sum + bookingTotal(booking), 0);
  const yearChange = previousGross ? Math.round(((gross - previousGross) / previousGross) * 100) : null;
  const average = yearBookings.length ? Math.round(gross / yearBookings.length) : 0;

  if (!salesDataError) {
    salesSummary.innerHTML = [
      ["Gross sales", formatMoney(gross), yearChange === null ? "No prior-year baseline" : `${yearChange >= 0 ? "+" : ""}${yearChange}% vs ${selectedSalesYear - 1}`],
      ["Cash collected", formatMoney(collected), gross ? `${percent(collected, gross)}% of sales` : "No recorded sales"],
      ["Outstanding", formatMoney(outstanding), "Customer balances"],
      ["Gross profit", formatMoney(profit), "After partner costs"],
      ["Bookings", yearBookings.length.toLocaleString(), `${formatMoney(average)} average sale`],
    ]
      .map(([label, value, note]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`)
      .join("");
  }

  const monthNames = Array.from({ length: 12 }, (_, month) => new Date(2026, month, 1).toLocaleDateString("en-US", { month: "short" }));
  const monthlyRevenue = (year) => monthNames.map((_, month) =>
    salesBookings
      .filter((booking) => bookingYear(booking) === year && Number(String(booking.booked_on).slice(5, 7)) === month + 1)
      .reduce((sum, booking) => sum + bookingTotal(booking), 0),
  );
  const selectedMonths = monthlyRevenue(selectedSalesYear);
  const previousMonths = monthlyRevenue(selectedSalesYear - 1);
  const chartMax = Math.max(1, ...selectedMonths, ...previousMonths);
  salesComparisonLabel.textContent = `${selectedSalesYear} compared with ${selectedSalesYear - 1}`;
  salesChart.innerHTML = `
    <div class="sales-chart-grid" aria-label="Monthly sales comparison for ${selectedSalesYear} and ${selectedSalesYear - 1}">
      ${monthNames.map((month, index) => `
        <div class="sales-month" title="${month}: ${formatMoney(selectedMonths[index])} vs ${formatMoney(previousMonths[index])}">
          <div class="sales-bars">
            <i class="previous" style="height:${Math.max(previousMonths[index] ? 4 : 0, (previousMonths[index] / chartMax) * 100)}%"></i>
            <i class="current" style="height:${Math.max(selectedMonths[index] ? 4 : 0, (selectedMonths[index] / chartMax) * 100)}%"></i>
          </div>
          <strong>${escapeHtml(month)}</strong>
          <span>${selectedMonths[index] ? formatMoney(selectedMonths[index]) : "—"}</span>
        </div>
      `).join("")}
    </div>
  `;

  const paymentCounts = ["paid", "partial", "pending", "refunded"].map((status) => ({
    status,
    count: yearBookings.filter((booking) => booking.payment_status === status).length,
  }));
  const vehicleSales = [...yearBookings.reduce((map, booking) => {
    const name = booking.vehicle || "Vehicle TBD";
    map.set(name, (map.get(name) || 0) + bookingTotal(booking));
    return map;
  }, new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  salesBreakdown.innerHTML = `
    <div><span>Payment position</span><strong>${yearBookings.filter((booking) => booking.payment_status === "paid").length} paid in full</strong></div>
    <div class="sales-payment-mix">${paymentCounts.map((item) => `<p><span class="payment-dot ${item.status}"></span>${escapeHtml(item.status)}<strong>${item.count}</strong></p>`).join("")}</div>
    <div class="sales-top-vehicles"><span>Top vehicles</span>${vehicleSales.length ? vehicleSales.map(([vehicle, amount]) => `<p><span>${escapeHtml(vehicle)}</span><strong>${formatMoney(amount)}</strong></p>`).join("") : `<p class="admin-empty">No sales recorded for this year.</p>`}</div>
  `;

  const ledgerRows = [...salesBookings].sort((a, b) => String(b.booked_on).localeCompare(String(a.booked_on)));
  salesLedgerCount.textContent = `${ledgerRows.length} booking${ledgerRows.length === 1 ? "" : "s"}`;
  salesLedger.innerHTML = ledgerRows.length
    ? ledgerRows.map((booking) => {
        const total = bookingTotal(booking);
        const paid = Number(booking.amount_paid || 0);
        return `<tr>
          <td>${escapeHtml(formatDate(booking.booked_on))}</td>
          <td><strong>${escapeHtml(booking.customer_name)}</strong><small>${escapeHtml(booking.customer_phone || "No phone")}</small></td>
          <td>${escapeHtml(booking.vehicle)}</td>
          <td>${formatMoney(total)}</td>
          <td>${formatMoney(paid)}</td>
          <td>${formatMoney(Math.max(0, total - paid))}</td>
          <td>${formatMoney(bookingProfit(booking))}</td>
          <td><span class="sales-payment-badge ${escapeHtml(booking.payment_status)}">${escapeHtml(booking.payment_status)}</span></td>
          <td><button type="button" data-edit-booking="${escapeHtml(booking.id)}">Edit</button></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="9"><p class="admin-empty">No bookings recorded yet. Use “Record booking” to start the sales ledger.</p></td></tr>`;
}

function bookingFormNumbers() {
  const data = new FormData(bookingForm);
  return {
    rental_days: Math.max(1, Number(data.get("rental_days") || 1)),
    daily_rate: Math.max(0, Number(data.get("daily_rate") || 0)),
    delivery_fee: Math.max(0, Number(data.get("delivery_fee") || 0)),
    addons_total: Math.max(0, Number(data.get("addons_total") || 0)),
    discount: Math.max(0, Number(data.get("discount") || 0)),
    partner_cost: Math.max(0, Number(data.get("partner_cost") || 0)),
    amount_paid: Math.max(0, Number(data.get("amount_paid") || 0)),
  };
}

function updateBookingTotalPreview() {
  if (!bookingTotalPreview) return;
  const values = bookingFormNumbers();
  const total = bookingTotal(values);
  bookingTotalPreview.innerHTML = `
    <div><span>Booking total</span><strong>${formatMoney(total)}</strong></div>
    <div><span>Balance due</span><strong>${formatMoney(Math.max(0, total - values.amount_paid))}</strong></div>
    <div><span>Gross profit</span><strong>${formatMoney(total - values.partner_cost)}</strong></div>
  `;
}

function populateBookingQuoteSelect(selectedId = "") {
  bookingQuoteSelect.innerHTML = `<option value="">Manual booking</option>${requests
    .map((request) => `<option value="${escapeHtml(request.id)}" ${String(request.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(request.name || "Lead")} — ${escapeHtml(request.vehicle || "Vehicle TBD")}</option>`)
    .join("")}`;
}

function openBookingEditor(bookingId = "", linkedQuoteId = "") {
  const booking = salesBookings.find((item) => String(item.id) === String(bookingId));
  const linkedRequest = requests.find((item) => String(item.id) === String(booking?.quote_request_id || linkedQuoteId));
  const linkedCar = matchedRequestCar(linkedRequest);
  bookingForm.reset();
  bookingForm.elements.id.value = booking?.id || "";
  populateBookingQuoteSelect(booking?.quote_request_id || linkedQuoteId);
  bookingEditorTitle.textContent = booking ? "Edit booking" : "Record booking";
  deleteBookingButton.hidden = !booking;
  const defaults = booking || {
    customer_name: linkedRequest?.name || "",
    customer_phone: linkedRequest?.phone || "",
    vehicle: linkedRequest?.vehicle || "",
    booked_on: new Date().toISOString().slice(0, 10),
    start_date: linkedRequest?.date || "",
    rental_days: 1,
    daily_rate: carDailyRate(linkedCar),
    delivery_fee: 0,
    addons_total: 0,
    discount: 0,
    partner_cost: 0,
    amount_paid: 0,
    payment_status: "pending",
  };
  ["customer_name", "customer_phone", "vehicle", "booked_on", "start_date", "end_date", "rental_days", "daily_rate", "delivery_fee", "addons_total", "discount", "partner_cost", "amount_paid", "payment_status", "notes"].forEach((key) => {
    if (bookingForm.elements[key]) bookingForm.elements[key].value = defaults[key] ?? "";
  });
  setStatus(bookingStatus, "");
  updateBookingTotalPreview();
  bookingDialog.showModal();
}

function renderTrafficInsights() {
  if (!overviewTrafficInsights) return;
  if (trafficAnalyticsError) {
    overviewTrafficInsights.innerHTML = `<p class="admin-empty">${escapeHtml(trafficAnalyticsError)}</p>`;
    return;
  }

  const fleetBySlug = new Map(dashboardCars().map((car) => [car.slug, car]));
  const pageViews = trafficEvents.filter((event) => event.event_type === "fleet_page_view").length;
  const totals = {
    impressions: trafficEvents.filter((event) => event.event_type === "card_impression").length,
    clicks: trafficEvents.filter((event) => event.event_type === "vehicle_detail_click").length,
    checks: trafficEvents.filter((event) => event.event_type === "availability_open").length,
    leads: trafficEvents.filter((event) => event.event_type === "availability_success").length,
  };

  const byVehicle = trafficEvents.reduce((map, event) => {
    if (!event.car_slug) return map;
    const current = map.get(event.car_slug) || { slug: event.car_slug, impressions: 0, clicks: 0, checks: 0, leads: 0, detailViews: 0 };
    if (event.event_type === "card_impression") current.impressions += 1;
    if (event.event_type === "vehicle_detail_click") current.clicks += 1;
    if (event.event_type === "vehicle_detail_view") current.detailViews += 1;
    if (event.event_type === "availability_open") current.checks += 1;
    if (event.event_type === "availability_success") current.leads += 1;
    map.set(event.car_slug, current);
    return map;
  }, new Map());

  const ranked = [...byVehicle.values()]
    .map((item) => ({
      ...item,
      name: fleetBySlug.get(item.slug)?.name || item.slug.replaceAll("-", " "),
      engagement: item.clicks + item.checks + item.leads * 2,
      ctr: item.impressions ? Math.round(((item.clicks + item.checks) / item.impressions) * 100) : 0,
    }))
    .sort((a, b) => b.engagement - a.engagement || b.impressions - a.impressions)
    .slice(0, 10);

  overviewTrafficInsights.innerHTML = `
    <div class="traffic-kpis">
      <article><span>Fleet visits</span><strong>${pageViews.toLocaleString()}</strong><small>Page loads</small></article>
      <article><span>Card views</span><strong>${totals.impressions.toLocaleString()}</strong><small>Vehicles seen on screen</small></article>
      <article><span>Vehicle clicks</span><strong>${totals.clicks.toLocaleString()}</strong><small>Detail-page interest</small></article>
      <article><span>Availability interest</span><strong>${totals.checks.toLocaleString()}</strong><small>${totals.leads} completed request${totals.leads === 1 ? "" : "s"}</small></article>
    </div>
    ${ranked.length ? `
      <div class="traffic-table-wrap">
        <table class="traffic-table">
          <thead><tr><th>Vehicle</th><th>Seen</th><th>Details</th><th>Checks</th><th>Requests</th><th>Engagement</th></tr></thead>
          <tbody>${ranked.map((item) => `
            <tr>
              <td><strong>${escapeHtml(item.name)}</strong></td>
              <td>${item.impressions}</td>
              <td>${item.clicks}</td>
              <td>${item.checks}</td>
              <td>${item.leads}</td>
              <td><span class="traffic-rate">${item.ctr}%</span></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>` : `<p class="admin-empty">No fleet traffic recorded yet. The rankings will populate automatically after deployment.</p>`}
  `;
}

async function loadTrafficAnalytics() {
  if (!supabase) return;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("fleet_events")
    .select("event_type, car_slug, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    trafficEvents = [];
    trafficAnalyticsError = "Traffic reporting needs the latest Supabase schema. Run supabase/schema.sql, then refresh this page.";
  } else {
    trafficEvents = data || [];
    trafficAnalyticsError = "";
  }
  renderTrafficInsights();
}

function isDatabaseId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function loadCloudCrmData() {
  if (!supabase) return;
  const [quoteResult, salesResult] = await Promise.all([
    supabase.from("quote_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("booking_sales").select("*").order("booked_on", { ascending: false }),
  ]);

  const errors = [];
  if (quoteResult.error) {
    errors.push("quote requests");
  } else {
    const localById = new Map(requests.map((request) => [String(request.id), request]));
    const cloudRequests = (quoteResult.data || []).map((row) => ({
      ...(localById.get(String(row.id)) || {}),
      id: row.id,
      requestType: row.source === "fleet-availability" ? "availability" : "quote",
      name: row.name,
      phone: row.phone,
      email: row.email || "",
      vehicle: row.vehicle,
      date: row.rental_date || "",
      addons: Array.isArray(row.addons) ? row.addons : [],
      message: row.message || "",
      status: row.status || "new",
      createdAt: row.created_at,
    }));
    const cloudIds = new Set(cloudRequests.map((request) => String(request.id)));
    requests = sanitizeRequests([...cloudRequests, ...requests.filter((request) => !cloudIds.has(String(request.id)))]);
    writeJson(REQUESTS_KEY, requests);
  }

  if (salesResult.error) {
    salesBookings = [];
    errors.push("booking sales");
  } else {
    salesBookings = salesResult.data || [];
  }

  salesDataError = errors.length
    ? `Sales cloud setup is incomplete (${errors.join(" and ")}). Run the latest supabase/schema.sql, then refresh.`
    : "";
  renderCrm();
}

function renderOverviewDetails() {
  const activeCars = dashboardCars();
  const strongGalleryCount = activeCars.filter(hasStrongGallery).length;
  const photoGapCars = activeCars.filter((car) => !hasStrongGallery(car));
  const openRequests = requests.filter((request) => request.status !== "booked");
  const newLeads = requests.filter((request) => request.status === "new");
  const followUps = requests.filter((request) => ["checking", "available", "alternative", "approved"].includes(request.status));
  const datedRequests = requests.filter((request) => request.date);
  const missingPhone = requests.filter((request) => !request.phone).length;
  const missingDate = requests.filter((request) => !request.date).length;
  const addonRequests = requests.filter((request) => request.addons?.length).length;

  renderTrafficInsights();
  renderOperationsDashboard();

  if (overviewFleetCheck) {
    const parts = [
      `${activeCars.length} active ${activeCars.length === 1 ? "vehicle" : "vehicles"}`,
      `${openRequests.length} open ${openRequests.length === 1 ? "quote" : "quotes"}`,
      `${photoGapCars.length} photo ${photoGapCars.length === 1 ? "gap" : "gaps"}`,
    ];
    overviewFleetCheck.textContent = parts.join(" · ");
  }

  if (overviewFleetReadiness) {
    const grouped = activeCars.reduce((acc, car) => {
      const make = carDisplayMake(car);
      acc.set(make, [...(acc.get(make) || []), car]);
      return acc;
    }, new Map());
    const rows = [...grouped.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .slice(0, 6);

    overviewFleetReadiness.innerHTML = rows.length
      ? `${rows
          .map(([make, makeCars]) => {
            const ready = makeCars.filter(hasStrongGallery).length;
            const blocked = makeCars.length - ready;
            const booked = makeCars.filter((car) =>
              requests.some((request) => ["approved", "booked"].includes(request.status) && requestMatchesCar(request, car)),
            ).length;
            const readyWidth = clampPercent((ready / makeCars.length) * 100);
            const bookedWidth = clampPercent((booked / makeCars.length) * 100);
            const blockedWidth = clampPercent((blocked / makeCars.length) * 100);
            return `
              <div class="chart-row">
                <span>${escapeHtml(make)}</span>
                <div><b style="width: ${readyWidth}%"></b><i style="width: ${bookedWidth}%"></i><em style="width: ${blockedWidth}%"></em></div>
                <small>${makeCars.length} ${makeCars.length === 1 ? "car" : "cars"}</small>
              </div>
            `;
          })
          .join("")}
          <div class="chart-legend">
            <span><b></b> Gallery ready</span>
            <span><i></i> Booked/approved</span>
            <span><em></em> Photo gap</span>
          </div>`
      : `<p class="admin-empty">No active fleet records loaded.</p>`;
  }

  if (overviewFleetHighlights) {
    overviewFleetHighlights.innerHTML = activeCars.length
      ? activeCars
          .slice()
          .sort((a, b) => carDailyRate(b) - carDailyRate(a))
          .slice(0, 4)
          .map((car) => {
            const photos = galleryCount(car);
            const status = hasStrongGallery(car) ? "Gallery ready" : "Needs more photos";
            return `
              <article>
                <strong>${escapeHtml(car.name)}</strong>
                <span>${escapeHtml(carLabel(car))} · ${formatMoney(car.price)}/day</span>
                <p>${photos} ${photos === 1 ? "photo" : "photos"} · ${escapeHtml(status)}</p>
                <div><button type="button" data-jump-section="vehicles">Edit car</button><button type="button" data-jump-section="vehicles">Manage photos</button></div>
              </article>
            `;
          })
          .join("")
      : `<p class="admin-empty">Sync or add fleet vehicles to populate this section.</p>`;
  }

  if (overviewFleetInsights) {
    const topMakes = [...new Set(activeCars.map(carDisplayMake))].slice(0, 3);
    overviewFleetInsights.innerHTML = `
      <div>
        <h4>Fleet read</h4>
        <ul>
          <li>${activeCars.length} active ${activeCars.length === 1 ? "vehicle" : "vehicles"} loaded from the website/admin fleet.</li>
          <li>${strongGalleryCount} ${strongGalleryCount === 1 ? "vehicle has" : "vehicles have"} at least 3 gallery photos.</li>
          <li>${topMakes.length ? `Current strongest brand coverage: ${escapeHtml(topMakes.join(", "))}.` : "Add vehicles to build brand coverage."}</li>
        </ul>
      </div>
      <div>
        <h4>Pressure points</h4>
        <ul>
          <li>${photoGapCars.length} ${photoGapCars.length === 1 ? "vehicle needs" : "vehicles need"} stronger galleries.</li>
          <li>${followUps.length} quote ${followUps.length === 1 ? "request needs" : "requests need"} follow-up.</li>
          <li>${missingDate} ${missingDate === 1 ? "request is" : "requests are"} missing a rental date.</li>
        </ul>
      </div>
    `;
  }

  if (overviewLeadKpis) {
    const expectedRevenue = openRequests.reduce((sum, request) => sum + requestValue(request, activeCars), 0);
    overviewLeadKpis.innerHTML = `
      <article><span>Open quotes</span><strong>${openRequests.length}</strong><small>${newLeads.length} new lead${newLeads.length === 1 ? "" : "s"}</small></article>
      <article><span>Matched value</span><strong>${formatMoney(expectedRevenue)}</strong><small>Based on selected vehicles</small></article>
    `;
  }

  if (overviewLeadQuality) {
    const total = requests.length;
    overviewLeadQuality.innerHTML = `
      <h4>Lead quality</h4>
      <p><span>Quotes with phone number</span><strong>${percent(total - missingPhone, total)}%</strong></p>
      <p><span>Quotes with date selected</span><strong>${percent(datedRequests.length, total)}%</strong></p>
      <p><span>Quotes with add-ons</span><strong>${percent(addonRequests, total)}%</strong></p>
    `;
  }

  if (overviewBlockers) {
    overviewBlockers.innerHTML = `
      <h4>Blockers</h4>
      <p><span>No phone number</span><strong>${missingPhone}</strong></p>
      <p><span>No rental date</span><strong>${missingDate}</strong></p>
      <p><span>Needs follow-up</span><strong>${followUps.length}</strong></p>
    `;
  }

  if (overviewRevenueList) {
    const actionableRequests = openRequests.slice(0, 3);
    overviewRevenueList.innerHTML = actionableRequests.length
      ? `<h4>Quote opportunities</h4>${actionableRequests
          .map((request) => {
            const value = requestValue(request, activeCars);
            const nextStep = !request.phone ? "Collect phone number." : !request.date ? "Confirm rental date." : "Follow up to confirm the booking.";
            return `<article><strong>${escapeHtml(request.vehicle || "Vehicle TBD")} · ${formatMoney(value)}</strong><span>${escapeHtml(nextStep)}</span></article>`;
          })
          .join("")}`
      : `<h4>Quote opportunities</h4><p class="admin-empty">No open quote requests yet.</p>`;
  }

  if (overviewActionQueue) {
    overviewActionQueue.innerHTML = openRequests.length
      ? openRequests
          .slice(0, 6)
          .map((request) => {
            const value = requestValue(request, activeCars);
            const issue = !request.phone ? "Missing phone" : !request.date ? "Missing date" : request.status === "new" ? "Needs first reply" : "Needs follow-up";
            const nextStep = !request.phone ? "Ask for phone" : !request.date ? "Confirm date" : request.status === "new" ? "Contact lead" : "Close next step";
            const risk = request.status === "new" || !request.phone || !request.date ? "High" : "Medium";
            return `
              <tr>
                <td>${escapeHtml(request.name || "Website lead")}</td>
                <td>${escapeHtml(request.vehicle || "Vehicle TBD")}</td>
                <td>${escapeHtml(formatDate(request.date))}</td>
                <td>${formatMoney(value)}</td>
                <td><span class="quote-badge ${escapeHtml(request.status || "new")}">${escapeHtml(requestStatusLabel(request.status))}</span></td>
                <td>${escapeHtml(issue)}</td>
                <td>${escapeHtml(nextStep)}</td>
                <td><span class="risk-badge ${risk === "High" ? "high" : "medium"}">${risk}</span></td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="8">No quote requests yet. Website quote submissions and manual leads will appear here.</td></tr>`;
  }

  if (overviewVehicleHealth) {
    overviewVehicleHealth.innerHTML = activeCars.length
      ? activeCars
          .slice(0, 6)
          .map((car) => {
            const photos = galleryCount(car);
            const statusClass = hasStrongGallery(car) ? "available" : "photos";
            const status = hasStrongGallery(car) ? "Gallery ready" : "Needs photos";
            return `
              <article>
                <strong>${escapeHtml(car.name)}</strong>
                <span>${escapeHtml(carLabel(car))} · ${formatMoney(car.price)}/day</span>
                <small>${photos} ${photos === 1 ? "photo" : "photos"} · <b class="status-badge ${statusClass}">${escapeHtml(status)}</b> · ${escapeHtml(car.mileage || "Mileage not set")}</small>
              </article>
            `;
          })
          .join("")
      : `<p class="admin-empty">No vehicles found. Add a car or sync the current website fleet.</p>`;
  }
}

function renderMiniLists() {
  if (!overviewRequests || !overviewCalendar) return;

  const latest = [...requests]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 4);

  overviewRequests.innerHTML = latest.length
    ? latest
        .map(
          (request) => `
            <article class="crm-mini-item">
              <div>
                <strong>${escapeHtml(request.name || "Lead")}</strong>
                <span>${escapeHtml(request.vehicle || "Vehicle TBD")}</span>
              </div>
              <small>${escapeHtml(requestStatusLabel(request.status))}</small>
            </article>
          `,
        )
        .join("")
    : `<p class="admin-empty">No quote requests yet.</p>`;

  const datedRequests = requests.filter((request) => request.date).slice(0, 4);
  overviewCalendar.innerHTML = datedRequests.length
    ? datedRequests
        .map(
          (request) => `
            <article class="crm-mini-item">
              <div>
                <strong>${escapeHtml(formatDate(request.date))}</strong>
                <span>${escapeHtml(request.vehicle || request.name || "Booking")}</span>
              </div>
              <small>${escapeHtml(request.status || "new")}</small>
            </article>
          `,
        )
        .join("")
    : `<p class="admin-empty">Dated quote requests will show here.</p>`;
}

function renderRequests() {
  requestPipeline.innerHTML = requestStatuses
    .map((status) => {
      const statusRequests = requests.filter((request) => request.status === status.id);
      return `
        <section class="crm-pipeline-column">
          <div class="crm-pipeline-head">
            <h3>${escapeHtml(status.label)}</h3>
            <span>${statusRequests.length}</span>
          </div>
          <div class="crm-request-stack">
            ${
              statusRequests.length
                ? statusRequests
                    .map(
                      (request) => `
                        <article class="crm-request-card">
                          <div class="crm-request-top">
                            <strong>${escapeHtml(request.name || "Lead")}</strong>
                            <small>${escapeHtml(formatDate(request.date))}</small>
                          </div>
                          <p>${escapeHtml(request.vehicle || "Vehicle TBD")}</p>
                          <span>${escapeHtml(request.phone || "No phone")}</span>
                          ${request.requestType === "availability" || request.message?.includes("Manual partner availability check") ? `<strong class="crm-request-alert">Call rental partner to confirm</strong>` : ""}
                          ${request.insuranceProvider ? `<span>Insurance: ${escapeHtml(request.insuranceProvider)}</span>` : ""}
                          ${
                            request.addons?.length
                              ? `<div class="crm-request-tags">${request.addons.map((addon) => `<em>${escapeHtml(addon)}</em>`).join("")}</div>`
                              : ""
                          }
                          ${request.message ? `<small class="crm-request-note">${escapeHtml(request.message)}</small>` : ""}
                          <label>
                            Move status
                            <select data-request-status="${escapeHtml(request.id)}">
                              ${requestStatuses
                                .map(
                                  (option) =>
                                    `<option value="${option.id}" ${option.id === request.status ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
                                )
                                .join("")}
                            </select>
                          </label>
                        </article>
                      `,
                    )
                    .join("")
                : `<p class="admin-empty">No requests here.</p>`
            }
          </div>
        </section>
      `;
    })
    .join("");
}

function renderCalendar() {
  const today = new Date();
  const dayCards = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const dayRequests = requests.filter((request) => request.date === iso);
    return `
      <article class="crm-calendar-card ${dayRequests.length ? "has-booking" : ""}">
        <span>${date.toLocaleDateString("en-US", { weekday: "short" })}</span>
        <strong>${date.getDate()}</strong>
        <small>${date.toLocaleDateString("en-US", { month: "short" })}</small>
        ${
          dayRequests.length
            ? `<p>${dayRequests.length} request${dayRequests.length === 1 ? "" : "s"}</p>`
            : `<p>Open</p>`
        }
      </article>
    `;
  }).join("");

  calendarGrid.innerHTML = dayCards;
}

function renderCrm() {
  if (!overviewStats) return;
  renderCrmStats();
  renderOverviewDetails();
  renderMiniLists();
  renderRequests();
  renderCalendar();
  renderSalesSystem();
}

function renderCarList() {
  const localCount = cars.filter((car) => isLocalCarId(car.id)).length;
  const countText = localCount
    ? `${cars.length} website ${cars.length === 1 ? "car" : "cars"}`
    : `${cars.length} ${cars.length === 1 ? "car" : "cars"}`;
  carCount.textContent = countText;
  carCountDisplays.forEach((node) => {
    node.textContent = countText;
  });
  carList.innerHTML = cars
    .map(
      (car) => `
        <button class="admin-car-button ${String(car.id) === String(selectedCarId) ? "active" : ""}" type="button" data-car-id="${car.id}">
          <img class="admin-car-thumb" src="${carImage(car)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/assets/kds-hero.png';" />
          <span>${isLocalCarId(car.id) ? "Website fleet" : car.make || "Vehicle"}</span>
          <strong>${car.name}</strong>
          <small>$${Number(car.price || 0).toLocaleString()}/day</small>
        </button>
      `,
    )
    .join("");
  renderCrm();
}

function renderMonthlySpecialPicker() {
  if (!specialCarGrid) return;
  const activeCars = cars.filter((car) => car.is_active !== false);
  const activeSlugs = new Set(activeCars.map((car) => car.slug));
  selectedSpecialSlugs = selectedSpecialSlugs.filter((slug) => activeSlugs.has(slug)).slice(0, MAX_MONTHLY_SPECIAL_CARS);
  specialSelectionCount.textContent = `${selectedSpecialSlugs.length} of ${MAX_MONTHLY_SPECIAL_CARS} selected`;

  specialCarGrid.innerHTML = activeCars.length
    ? activeCars
        .map((car) => {
          const selected = selectedSpecialSlugs.includes(car.slug);
          return `
            <label class="monthly-special-car ${selected ? "selected" : ""}">
              <input type="checkbox" value="${escapeHtml(car.slug)}" ${selected ? "checked" : ""} />
              <img src="${escapeHtml(carImage(car))}" alt="" width="180" height="120" loading="lazy" />
              <span><strong>${escapeHtml(car.name)}</strong><small>$${Number(car.price || 0).toLocaleString()}/day</small></span>
            </label>
          `;
        })
        .join("")
    : `<p class="admin-empty">Add active inventory cars before choosing a monthly special.</p>`;
}

async function loadMonthlySpecialAdmin() {
  if (!monthlySpecialForm || !requireConfig()) return;
  const month = specialMonthInput.value || currentMonthValue();
  specialMonthInput.value = month;
  setStatus(specialsStatus, "Loading monthly selection...");

  try {
    const record = await runQuery(
      supabase.from("monthly_specials").select("month, headline, description, car_slugs").eq("month", month).maybeSingle(),
    );
    monthlySpecialForm.elements.headline.value = record?.headline || "";
    monthlySpecialForm.elements.description.value = record?.description || "";
    selectedSpecialSlugs = Array.isArray(record?.car_slugs) ? record.car_slugs.slice(0, MAX_MONTHLY_SPECIAL_CARS) : [];
    renderMonthlySpecialPicker();
    setStatus(specialsStatus, record ? "Saved selection loaded." : "No saved selection. The website will rotate active cars automatically.");
  } catch (error) {
    selectedSpecialSlugs = [];
    renderMonthlySpecialPicker();
    setStatus(specialsStatus, friendlyError(error), "error");
  }
}

async function saveMonthlySpecial(event) {
  event.preventDefault();
  if (!requireConfig()) return;

  const formData = new FormData(monthlySpecialForm);
  const payload = {
    month: formData.get("month"),
    headline: String(formData.get("headline") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    car_slugs: selectedSpecialSlugs.slice(0, MAX_MONTHLY_SPECIAL_CARS),
    updated_at: new Date().toISOString(),
  };

  try {
    setStatus(specialsStatus, "Publishing monthly special...");
    await runQuery(supabase.from("monthly_specials").upsert(payload, { onConflict: "month" }));
    signalFleetRefresh();
    setStatus(specialsStatus, "Monthly special published to the website.", "success");
  } catch (error) {
    setStatus(specialsStatus, friendlyError(error), "error");
  }
}

function renderPhotos() {
  normalizePhotoOrder();
  if (addPhotoButton) addPhotoButton.disabled = photos.length >= MAX_LISTING_PHOTOS;
  photoList.innerHTML = photos
    .map(
      (photo, index) => `
        <article class="photo-editor-row" data-photo-index="${index}" draggable="true">
          <div class="photo-card-preview">
            <img src="${previewUrl(photo)}" alt="" onerror="this.onerror=null;this.src='/assets/kds-hero.png';" />
            <div class="photo-card-badge">${index === 0 ? "Main" : `Photo ${index + 1}`}</div>
            <button class="photo-drag-handle" type="button" aria-label="Drag photo ${index + 1} to reorder">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 6h8M8 12h8M8 18h8" /></svg>
            </button>
          </div>
          <div class="photo-card-body">
            <input data-photo-url type="hidden" value="${escapeHtml(photo.url || "")}" />
            <label class="photo-upload-trigger">
              <input data-photo-upload type="file" accept="image/*" />
              <span>${photo.file ? "Photo selected" : "Replace photo"}</span>
              <small>${photo.file ? escapeHtml(photo.file.name) : "Drop in a new image"}</small>
            </label>
            <div class="photo-card-actions">
              <button class="ghost-button compact" type="button" data-remove-photo>Remove</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
  updatePhotoPreview();
}

function renderAvailability() {
  if (!availabilityList) return;

  availabilityList.innerHTML = availableDates.length
    ? availableDates
        .sort()
        .map(
          (date) => `
            <button class="availability-chip" type="button" data-remove-date="${date}" aria-label="Remove ${date}">
              ${date}
            </button>
          `,
        )
        .join("")
    : `<p class="admin-empty">No available dates selected yet.</p>`;
}

function fillForm(car) {
  carForm.elements.id.value = car.id || "";
  carForm.elements.name.value = car.name || "";
  carForm.elements.slug.value = car.slug || slugify(car.name || "");
  carForm.elements.make.value = car.make || "";
  carForm.elements.model.value = car.model || "";
  carForm.elements.category.value = car.category || "supercar";
  carForm.elements.category_label.value = car.category_label || car.categoryLabel || "Supercar";
  carForm.elements.price.value = car.price || 0;
  carForm.elements.mileage.value = car.mileage || "";
  carForm.elements.seats.value = car.seats || seatsFor(car);
  carForm.elements.color.value = car.color || "";
  carForm.elements.summary.value = car.summary || "";
  carForm.elements.competitor_price.value = car.competitor_price || car.competitorPrice || "";
  carForm.elements.competitor_name.value = car.competitor_name || car.competitorName || "";
  carForm.elements.competitor_url.value = car.competitor_url || car.competitorUrl || "";
  carForm.elements.competitor_checked_at.value = car.competitor_checked_at || car.competitorCheckedAt || "";
  carForm.elements.partner_name.value = car.partner_name || car.partnerName || "";
  carForm.elements.partner_phone.value = car.partner_phone || car.partnerPhone || "";
  carForm.elements.tags.value = arrayToLines(car.tags);
  carForm.elements.details.value = arrayToLines(car.details);
  editorTitle.textContent = car.name || "New car";
  editorPreview.src = carImage(car);
  editorPreview.alt = car.name ? `${car.name} preview` : "";
  editorPrice.textContent = `$${Number(car.price || 0).toLocaleString()}/day`;
  editorMeta.textContent = [car.category_label, `${car.seats || seatsFor(car)} seats`, car.mileage].filter(Boolean).join(" / ");
  updateCompetitorRecommendation();
}

async function selectCar(carId) {
  selectedCarId = carId;
  const car = selectedCar() || emptyCar();
  fillForm(car);
  renderCarList();

  if (!car.id) {
    photos = [{ position: 1, url: "" }];
    availableDates = [];
    renderPhotos();
    renderAvailability();
    return;
  }

  if (isLocalCarId(car.id) || !requireConfig()) {
    const gallery = (car.gallery?.length ? car.gallery : [car.image_url || car.image].filter(Boolean)).slice(0, MAX_LISTING_PHOTOS);
    photos = gallery.map((url, index) => ({ position: index + 1, url }));
    availableDates = [];
    renderPhotos();
    renderAvailability();
    setStatus(adminStatus, "This car is loaded from the website fleet. Save it or sync the fleet to publish it into Supabase.", "");
    return;
  }

  const [photoRows, dateRows] = await Promise.all([
    runQuery(supabase.from("car_photos").select("*").eq("car_id", car.id).order("position")),
    runQuery(supabase.from("car_available_dates").select("date").eq("car_id", car.id).order("date")),
  ]);

  photos = photoRows.length
    ? photoRows.slice(0, MAX_LISTING_PHOTOS).map((row) => ({ id: row.id, position: row.position, url: row.url }))
    : [{ position: 1, url: car.image_url || "" }];
  availableDates = dateRows.map((row) => row.date);
  renderPhotos();
  renderAvailability();
}

async function loadCars() {
  if (!requireConfig()) return;

  try {
    cars = await runQuery(supabase.from("cars").select("*").order("name"));
    const { data: partnerRows, error: partnerError } = await supabase.from("car_partners").select("car_id, partner_name, partner_phone");
    if (partnerError && isMissingSchemaItem(partnerError, ["car_partners"])) supportsPartnerTable = false;
    else if (partnerError) throw partnerError;
    const partnersByCar = new Map((partnerRows || []).map((row) => [row.car_id, row]));
    cars = cars.map((car) => ({ ...car, ...(partnersByCar.get(car.id) || {}) }));
  } catch (error) {
    cars = localFleetCars();
    selectedCarId = cars[0]?.id || null;
    renderCarList();
    if (selectedCarId) await selectCar(selectedCarId);
    setStatus(adminStatus, friendlyError(error), "error");
    return;
  }

  if (!cars.length) {
    cars = localFleetCars();
    selectedCarId = cars[0]?.id || null;
    renderCarList();
    if (selectedCarId) await selectCar(selectedCarId);
    setStatus(adminStatus, "Showing the current website fleet. Click Sync current fleet to save these cars into Supabase.", "");
    return;
  }

  if (cars.length && !selectedCarId) selectedCarId = cars[0].id;
  renderCarList();
  if (selectedCarId) await selectCar(selectedCarId);

  const cloudSlugs = new Set(cars.map((car) => car.slug));
  const deletedSlugs = new Set(readDeletedCarSlugs());
  const pendingWebsiteCars = fleet.filter((car) => !cloudSlugs.has(car.slug) && !deletedSlugs.has(car.slug));
  if (pendingWebsiteCars.length) {
    setStatus(
      adminStatus,
      `${pendingWebsiteCars.length} website ${pendingWebsiteCars.length === 1 ? "car is" : "cars are"} waiting to publish. Click Sync all website cars.`,
      "",
    );
  }
}

async function uploadPhoto(file, slug, position) {
  const safeName = `${slug || "vehicle"}/${String(position).padStart(2, "0")}-${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-")}`;
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(safeName, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(safeName).data.publicUrl;
}

async function savePhotos(carId, slug) {
  const nextPhotos = [];

  normalizePhotoOrder();
  for (const [index, photo] of photos.slice(0, MAX_LISTING_PHOTOS).entries()) {
    const position = index + 1;
    const url = photo.file ? await uploadPhoto(photo.file, slug, position) : photo.url?.trim();
    if (url) {
      photos[index] = { ...photo, url, previewUrl: url, file: null };
      nextPhotos.push({ car_id: carId, position, url });
    }
  }

  await runQuery(supabase.from("car_photos").delete().eq("car_id", carId));
  if (nextPhotos.length) await runQuery(supabase.from("car_photos").insert(nextPhotos));
  return nextPhotos;
}

async function syncWebsiteCar(localCar) {
  const {
    gallery,
    id,
    source,
    partner_name: partnerName,
    partner_phone: partnerPhone,
    ...carPayload
  } = normalizeLocalCar(localCar);
  const saved = await saveCarRecord(carPayload);
  const photoRows = (localCar.gallery || []).slice(0, MAX_LISTING_PHOTOS).map((url, index) => ({
    car_id: saved.id,
    position: index + 1,
    url,
  }));
  await runQuery(supabase.from("car_photos").delete().eq("car_id", saved.id));
  if (photoRows.length) await runQuery(supabase.from("car_photos").insert(photoRows));
  if (photoRows[0]?.url) await runQuery(supabase.from("cars").update({ image_url: photoRows[0].url }).eq("id", saved.id));
  await savePartnerRecord(saved.id, partnerName, partnerPhone);
  return saved;
}

async function syncMissingWebsiteCars() {
  const cloudCars = await runQuery(supabase.from("cars").select("slug"));
  const cloudSlugs = new Set(cloudCars.map((car) => car.slug));
  const deletedSlugs = new Set(readDeletedCarSlugs());
  const missingCars = fleet.filter((car) => !cloudSlugs.has(car.slug) && !deletedSlugs.has(car.slug));

  for (const localCar of missingCars) await syncWebsiteCar(localCar);
  return missingCars.length;
}

function currentPhotoUrls() {
  normalizePhotoOrder();
  return photos
    .slice(0, MAX_LISTING_PHOTOS)
    .map((photo) => photo.url || photo.previewUrl)
    .filter(Boolean);
}

function buildCarPayloadFromForm() {
  const formData = new FormData(carForm);
  const slug = formData.get("slug").trim() || slugify(formData.get("name"));

  return {
    slug,
    name: formData.get("name").trim(),
    make: formData.get("make").trim(),
    model: formData.get("model").trim(),
    category: formData.get("category").trim(),
    category_label: formData.get("category_label").trim(),
    categoryLabel: formData.get("category_label").trim(),
    price: Number(formData.get("price")),
    mileage: formData.get("mileage").trim(),
    seats: Number(formData.get("seats")),
    color: formData.get("color").trim(),
    summary: formData.get("summary").trim(),
    tags: linesToArray(formData.get("tags")),
    details: linesToArray(formData.get("details")),
    gallery: currentPhotoUrls(),
    image: currentPhotoUrls()[0] || "/assets/kds-hero.png",
    image_url: currentPhotoUrls()[0] || "/assets/kds-hero.png",
    is_active: true,
    is_featured: true,
    competitor_price: Number(formData.get("competitor_price")) || null,
    competitor_name: formData.get("competitor_name").trim(),
    competitor_url: formData.get("competitor_url").trim(),
    competitor_checked_at: formData.get("competitor_checked_at") || null,
    partner_name: formData.get("partner_name").trim(),
    partner_phone: formData.get("partner_phone").trim(),
  };
}

async function saveAvailability(carId) {
  await runQuery(supabase.from("car_available_dates").delete().eq("car_id", carId));
  if (availableDates.length) {
    await runQuery(
      supabase.from("car_available_dates").insert(availableDates.map((date) => ({ car_id: carId, date }))),
    );
  }
}

async function saveCar(event) {
  event.preventDefault();
  if (!requireConfig()) {
    return;
  }

  try {
    const formData = new FormData(carForm);
    const id = formData.get("id");
    const savedId = id && !isLocalCarId(id) ? id : "";
    const localPayload = buildCarPayloadFromForm();
    const {
      categoryLabel,
      gallery,
      image,
      image_url: localImageUrl,
      partner_name: partnerName,
      partner_phone: partnerPhone,
      ...carPayload
    } = localPayload;
    carPayload.image_url = photos[0]?.file ? selectedCar()?.image_url || "" : localImageUrl;

    setStatus(adminStatus, "Saving car...");
    const saved = await saveCarRecord(carPayload, savedId);

    const savedPhotos = await savePhotos(saved.id, carPayload.slug);
    await saveAvailability(saved.id);
    await savePartnerRecord(saved.id, partnerName, partnerPhone);
    if (savedPhotos[0]?.url) {
      await runQuery(supabase.from("cars").update({ image_url: savedPhotos[0].url }).eq("id", saved.id));
    }
    setStatus(adminStatus, "Car saved. Syncing any missing website vehicles...");
    const syncedMissingCount = await syncMissingWebsiteCars();
    selectedCarId = saved.id;
    await loadCars();
    signalFleetRefresh();
    setStatus(
      adminStatus,
      syncedMissingCount
        ? `Saved to Supabase and published ${syncedMissingCount} missing website ${syncedMissingCount === 1 ? "car" : "cars"}.`
        : "Saved to Supabase. The Fleet page has been refreshed.",
      "success",
    );
  } catch (error) {
    setStatus(adminStatus, friendlyError(error), "error");
  }
}

async function deleteSelectedCar() {
  const car = selectedCar();
  if (!car?.id) {
    setStatus(adminStatus, "Select a vehicle before deleting.", "error");
    return;
  }

  const confirmed = window.confirm(`Delete ${car.name}? This permanently removes it from Supabase and the public fleet.`);
  if (!confirmed) return;

  try {
    setStatus(adminStatus, `Deleting ${car.name}...`);

    if (!requireConfig()) return;
    const deleteQuery = isLocalCarId(car.id)
      ? supabase.from("cars").delete().eq("slug", car.slug).select("id, slug")
      : supabase.from("cars").delete().eq("id", car.id).select("id, slug");
    const deletedRows = await runQuery(deleteQuery);
    if (!deletedRows.length && !isLocalCarId(car.id)) {
      throw new Error(`${car.name} was not found in Supabase. Reload the inventory and try again.`);
    }

    deleteCarDraft(car.slug || car.name);

    selectedCarId = null;
    await loadCars();
    signalFleetRefresh();
    setStatus(adminStatus, `${car.name} deleted from Supabase and removed from the public fleet.`, "success");
  } catch (error) {
    setStatus(adminStatus, friendlyError(error), "error");
  }
}

async function seedFleet() {
  if (!requireConfig()) return;
  try {
    setStatus(adminStatus, "Syncing current website fleet...");

    const deletedSlugs = new Set(readDeletedCarSlugs());
    const syncableFleet = fleet.filter((car) => !deletedSlugs.has(car.slug));
    let syncedCount = 0;
    for (const localCar of syncableFleet) {
      await syncWebsiteCar(localCar);
      syncedCount += 1;
      setStatus(adminStatus, `Syncing current website fleet... ${syncedCount}/${syncableFleet.length}`);
    }

    selectedCarId = null;
    await loadCars();
    signalFleetRefresh();
    const compatibilityNote = !supportsCompetitorColumns || !supportsPartnerTable ? " Core vehicle data and photos are live." : "";
    setStatus(adminStatus, `${syncedCount} website vehicles synced into Supabase.${compatibilityNote}`, "success");
  } catch (error) {
    setStatus(adminStatus, friendlyError(error), "error");
  }
}

async function init() {
  configWarning.hidden = configured;
  fillStoredForms();

  if (!configured) {
    showAdmin(false);
    loginStatus.textContent = "Supabase Project URL is missing. Add it before logging in.";
    return;
  }

  const { data } = await supabase.auth.getSession();
  showAdmin(Boolean(data.session));
  if (data.session) {
    await loadCars();
    await loadCloudCrmData();
    await loadTrafficAnalytics();
    specialMonthInput.value = currentMonthValue();
    await loadMonthlySpecialAdmin();
  }
  renderCrm();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configured) {
    setStatus(loginStatus, "Add your Supabase Project URL first.", "error");
    return;
  }

  const formData = new FormData(loginForm);
  setStatus(loginStatus, "Signing in...");
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) {
    setStatus(loginStatus, error.message, "error");
    return;
  }

  setStatus(loginStatus, "");
  showAdmin(true);
  await loadCars();
  await loadCloudCrmData();
  await loadTrafficAnalytics();
  specialMonthInput.value = currentMonthValue();
  await loadMonthlySpecialAdmin();
});

specialMonthInput?.addEventListener("change", loadMonthlySpecialAdmin);

specialCarGrid?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[type='checkbox']");
  if (!checkbox) return;
  if (checkbox.checked && selectedSpecialSlugs.length >= MAX_MONTHLY_SPECIAL_CARS) {
    checkbox.checked = false;
    setStatus(specialsStatus, "Choose up to two cars for each month.", "error");
    return;
  }
  selectedSpecialSlugs = checkbox.checked
    ? [...selectedSpecialSlugs, checkbox.value]
    : selectedSpecialSlugs.filter((slug) => slug !== checkbox.value);
  renderMonthlySpecialPicker();
});

monthlySpecialForm?.addEventListener("submit", saveMonthlySpecial);

signOutButton.addEventListener("click", async () => {
  await supabase?.auth.signOut();
  showAdmin(false);
});

sectionButtons.forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.crmSection, button));
});

jumpSectionButtons.forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.jumpSection));
});

document.addEventListener("click", (event) => {
  const jumpButton = event.target.closest("[data-jump-section]");
  if (!jumpButton || jumpSectionButtons.includes(jumpButton)) return;
  switchSection(jumpButton.dataset.jumpSection);
});

addDemoRequestButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    let lead = {
      id: `manual-${Date.now()}`,
      name: "New client",
      phone: "",
      vehicle: selectedCar()?.name || cars[0]?.name || "Vehicle TBD",
      date: "",
      addons: ["Delivery"],
      message: "Manual lead. Add notes after the first call.",
      status: "new",
      createdAt: new Date().toISOString(),
    };
    if (supabase) {
      const { data } = await supabase
        .from("quote_requests")
        .insert({ name: lead.name, phone: lead.phone, vehicle: lead.vehicle, rental_date: null, addons: lead.addons, message: lead.message, source: "manual", status: "new" })
        .select()
        .single();
      if (data) lead = { ...lead, id: data.id, createdAt: data.created_at };
    }
    requests.unshift(lead);
    writeJson(REQUESTS_KEY, requests);
    renderCrm();
    switchSection("requests");
  });
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-dashboard-car]");
  if (!editButton || !editButton.dataset.editDashboardCar) return;
  switchSection("vehicles");
  await selectCar(editButton.dataset.editDashboardCar);
});

requestPipeline.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-request-status]");
  if (!select) return;

  requests = requests.map((request) =>
    String(request.id) === String(select.dataset.requestStatus) ? { ...request, status: select.value } : request,
  );
  writeJson(REQUESTS_KEY, requests);
  renderCrm();
  if (isDatabaseId(select.dataset.requestStatus) && supabase) {
    const { error } = await supabase.from("quote_requests").update({ status: select.value, updated_at: new Date().toISOString() }).eq("id", select.dataset.requestStatus);
    if (error) setStatus(adminStatus, friendlyError(error), "error");
  }
  if (select.value === "booked") {
    const existingBooking = salesBookings.find((booking) => String(booking.quote_request_id) === String(select.dataset.requestStatus));
    openBookingEditor(existingBooking?.id || "", select.dataset.requestStatus);
  }
});

salesYearSelect?.addEventListener("change", () => {
  selectedSalesYear = Number(salesYearSelect.value);
  renderSalesSystem();
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-booking-editor]")) openBookingEditor();
  const editBooking = event.target.closest("[data-edit-booking]");
  if (editBooking) openBookingEditor(editBooking.dataset.editBooking);
  if (event.target.closest("[data-close-booking-editor]")) bookingDialog.close();
});

bookingQuoteSelect?.addEventListener("change", () => {
  const request = requests.find((item) => String(item.id) === String(bookingQuoteSelect.value));
  if (!request) return;
  const car = matchedRequestCar(request);
  bookingForm.elements.customer_name.value = request.name || "";
  bookingForm.elements.customer_phone.value = request.phone || "";
  bookingForm.elements.vehicle.value = request.vehicle || "";
  bookingForm.elements.start_date.value = request.date || "";
  bookingForm.elements.daily_rate.value = carDailyRate(car);
  updateBookingTotalPreview();
});

bookingForm?.addEventListener("input", (event) => {
  if (["start_date", "end_date"].includes(event.target.name)) {
    const start = bookingForm.elements.start_date.value;
    const end = bookingForm.elements.end_date.value;
    if (start && end) {
      const days = Math.max(1, Math.ceil((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000));
      bookingForm.elements.rental_days.value = days;
    }
  }
  updateBookingTotalPreview();
});

bookingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireConfig()) return;
  const data = new FormData(bookingForm);
  const numbers = bookingFormNumbers();
  const total = bookingTotal(numbers);
  const selectedPaymentStatus = String(data.get("payment_status"));
  const paymentStatus = selectedPaymentStatus === "refunded"
    ? "refunded"
    : numbers.amount_paid >= total && total > 0
      ? "paid"
      : numbers.amount_paid > 0
        ? "partial"
        : "pending";
  const quoteId = isDatabaseId(data.get("quote_request_id")) ? data.get("quote_request_id") : null;
  const payload = {
    quote_request_id: quoteId,
    customer_name: String(data.get("customer_name") || "").trim(),
    customer_phone: String(data.get("customer_phone") || "").trim(),
    vehicle: String(data.get("vehicle") || "").trim(),
    booked_on: data.get("booked_on"),
    start_date: data.get("start_date") || null,
    end_date: data.get("end_date") || null,
    ...numbers,
    total_amount: total,
    payment_status: paymentStatus,
    notes: String(data.get("notes") || "").trim(),
    updated_at: new Date().toISOString(),
  };
  try {
    setStatus(bookingStatus, "Saving booking...");
    const id = data.get("id");
    const saved = id
      ? await runQuery(supabase.from("booking_sales").update(payload).eq("id", id).select().single())
      : await runQuery(supabase.from("booking_sales").insert(payload).select().single());
    if (quoteId) {
      await runQuery(supabase.from("quote_requests").update({ status: "booked", updated_at: new Date().toISOString() }).eq("id", quoteId));
      requests = requests.map((request) => String(request.id) === String(quoteId) ? { ...request, status: "booked" } : request);
      writeJson(REQUESTS_KEY, requests);
    }
    const existingIndex = salesBookings.findIndex((booking) => String(booking.id) === String(saved.id));
    if (existingIndex >= 0) salesBookings.splice(existingIndex, 1, saved);
    else salesBookings.unshift(saved);
    bookingDialog.close();
    renderCrm();
    setStatus(adminStatus, "Booking saved to the sales ledger.", "success");
  } catch (error) {
    setStatus(bookingStatus, friendlyError(error), "error");
  }
});

deleteBookingButton?.addEventListener("click", async () => {
  const id = bookingForm.elements.id.value;
  if (!id || !window.confirm("Delete this booking from the sales ledger?")) return;
  try {
    await runQuery(supabase.from("booking_sales").delete().eq("id", id));
    salesBookings = salesBookings.filter((booking) => String(booking.id) !== String(id));
    bookingDialog.close();
    renderCrm();
    setStatus(adminStatus, "Booking deleted.", "success");
  } catch (error) {
    setStatus(bookingStatus, friendlyError(error), "error");
  }
});

saveContentButton?.addEventListener("click", () => {
  contentDraft = Object.fromEntries(new FormData(contentForm).entries());
  writeJson(CONTENT_KEY, contentDraft);
  setStatus(adminStatus, "Content controls saved in this browser.", "success");
  switchSection("content");
});

saveSettingsButton?.addEventListener("click", () => {
  businessSettings = Object.fromEntries(new FormData(settingsForm).entries());
  writeJson(SETTINGS_KEY, businessSettings);
  setStatus(adminStatus, "Business settings saved in this browser.", "success");
  switchSection("settings");
});

newCarButton.addEventListener("click", () => {
  switchSection("vehicles");
  selectedCarId = null;
  photos = [{ position: 1, url: "" }];
  availableDates = [];
  fillForm(emptyCar());
  renderCarList();
  renderPhotos();
  renderAvailability();
});

newDashboardCarButton?.addEventListener("click", () => newCarButton.click());

carList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-car-id]");
  if (button) selectCar(button.dataset.carId);
});

carForm.elements.name.addEventListener("input", () => {
  if (!carForm.elements.id.value) carForm.elements.slug.value = slugify(carForm.elements.name.value);
});

addPhotoButton.addEventListener("click", () => {
  if (photos.length >= MAX_LISTING_PHOTOS) return;
  photos.push({ position: photos.length + 1, url: "" });
  renderPhotos();
});

photoList.addEventListener("click", (event) => {
  const moveButton = event.target.closest("[data-move-photo]");
  if (moveButton) {
    const row = moveButton.closest("[data-photo-index]");
    const fromIndex = Number(row.dataset.photoIndex);
    reorderPhotos(fromIndex, fromIndex + Number(moveButton.dataset.movePhoto));
    return;
  }

  if (!event.target.matches("[data-remove-photo]")) return;
  const row = event.target.closest("[data-photo-index]");
  photos.splice(Number(row.dataset.photoIndex), 1);
  normalizePhotoOrder();
  renderPhotos();
});

photoList.addEventListener("input", (event) => {
  if (!event.target.matches("[data-photo-url]")) return;
  const row = event.target.closest("[data-photo-index]");
  photos[Number(row.dataset.photoIndex)].url = event.target.value;
  if (Number(row.dataset.photoIndex) === 0) updatePhotoPreview();
});

photoList.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-photo-upload]")) return;
  const row = event.target.closest("[data-photo-index]");
  const index = Number(row.dataset.photoIndex);
  const file = event.target.files[0];
  if (!file) return;

  photos[index].file = file;
  photos[index].previewUrl = await readFileAsDataUrl(file);
  renderPhotos();
});

photoList.addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (!row) return;

  draggedPhotoIndex = Number(row.dataset.photoIndex);
  row.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(draggedPhotoIndex));
});

photoList.addEventListener("dragover", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (!row || draggedPhotoIndex === null) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  photoList.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target"));
  row.classList.add("drop-target");
});

photoList.addEventListener("dragleave", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (row && !row.contains(event.relatedTarget)) row.classList.remove("drop-target");
});

photoList.addEventListener("drop", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (!row || draggedPhotoIndex === null) return;

  event.preventDefault();
  reorderPhotos(draggedPhotoIndex, Number(row.dataset.photoIndex));
  draggedPhotoIndex = null;
});

photoList.addEventListener("dragend", () => {
  draggedPhotoIndex = null;
  photoList.querySelectorAll(".dragging, .drop-target").forEach((item) => item.classList.remove("dragging", "drop-target"));
});

availabilityInput?.addEventListener("change", () => {
  if (!availabilityInput.value || availableDates.includes(availabilityInput.value)) return;
  availableDates.push(availabilityInput.value);
  availabilityInput.value = "";
  renderAvailability();
});

availabilityList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-date]");
  if (!button) return;
  availableDates = availableDates.filter((date) => date !== button.dataset.removeDate);
  renderAvailability();
});

carForm.addEventListener("submit", saveCar);
carForm.elements.competitor_price?.addEventListener("input", updateCompetitorRecommendation);
applyCompetitivePriceButton?.addEventListener("click", () => {
  const competitorPrice = Number(carForm.elements.competitor_price?.value || 0);
  if (!competitorPrice) return;
  const target = Math.max(0, competitorPrice - 50);
  carForm.elements.price.value = String(target);
  editorPrice.textContent = `${formatMoney(target)}/day`;
  updateCompetitorRecommendation();
});
deleteCarButton?.addEventListener("click", deleteSelectedCar);
seedButton.addEventListener("click", seedFleet);

init();
