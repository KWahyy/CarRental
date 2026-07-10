import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { signalFleetRefresh, slugifyVehicle } from "./admin-store.js?v=shared-fleet-20260710";
import { fleet } from "./fleet-data.js?v=shared-fleet-20260710";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_STORAGE_BUCKET, SUPABASE_URL } from "./supabase-config.js?v=shared-fleet-20260710";

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
const requestPipeline = document.querySelector("[data-request-pipeline]");
const addDemoRequestButton = document.querySelector("[data-add-demo-request]");
const calendarGrid = document.querySelector("[data-calendar-grid]");
const contentForm = document.querySelector("[data-content-form]");
const settingsForm = document.querySelector("[data-settings-form]");
const saveContentButton = document.querySelector("[data-save-content]");
const saveSettingsButton = document.querySelector("[data-save-settings]");

const REQUESTS_KEY = "kds-crm-requests";
const CONTENT_KEY = "kds-crm-content";
const SETTINGS_KEY = "kds-crm-settings";

const requestStatuses = [
  { id: "new", label: "New lead" },
  { id: "contacted", label: "Contacted" },
  { id: "approved", label: "Approved" },
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
  return (Array.isArray(value) ? value : []).filter((request) => {
    const id = String(request?.id || "");
    const name = String(request?.name || "");
    const message = String(request?.message || "");
    return !(
      id.startsWith("demo-") ||
      (name === "VIP client" && message.includes("Evening content package")) ||
      (name === "Weekend booking" && message.includes("Needs final date"))
    );
  });
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
  if (message.includes("schema cache") || message.includes("public.cars") || message.includes("relation")) {
    return "Cloud database setup needed. Run supabase/schema.sql in Supabase SQL Editor, then click Sync website fleet.";
  }
  if (message.includes("row-level security")) {
    return "Supabase permission setup needs attention. Re-run supabase/schema.sql, then try again.";
  }
  return message;
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
    source: "website",
  };
}

function localFleetCars() {
  return fleet.map((car) =>
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
  };
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
  const activeCars = dashboardCars();
  const carsWithStrongGallery = activeCars.filter(hasStrongGallery);
  const newLeads = requests.filter((request) => request.status === "new").length;
  const followUps = requests.filter((request) => ["contacted", "approved"].includes(request.status)).length;
  const datedRequests = requests.filter((request) => request.date).length;
  const photoGaps = Math.max(activeCars.length - carsWithStrongGallery.length, 0);

  overviewStats.innerHTML = [
    ["Ready to rent", `${activeCars.length} cars`, `${carsWithStrongGallery.length} have strong galleries`],
    ["New leads", `${newLeads}`, `${requests.length} total quote requests`],
    ["Follow-up queue", `${followUps}`, "Deposit, insurance, or approval"],
    ["Booking dates", `${datedRequests}`, "Requests with a selected date"],
    ["Content gaps", `${photoGaps}`, "Cars needing stronger photos"],
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

function renderOverviewDetails() {
  const activeCars = dashboardCars();
  const strongGalleryCount = activeCars.filter(hasStrongGallery).length;
  const photoGapCars = activeCars.filter((car) => !hasStrongGallery(car));
  const openRequests = requests.filter((request) => request.status !== "booked");
  const newLeads = requests.filter((request) => request.status === "new");
  const followUps = requests.filter((request) => ["contacted", "approved"].includes(request.status));
  const datedRequests = requests.filter((request) => request.date);
  const missingPhone = requests.filter((request) => !request.phone).length;
  const missingDate = requests.filter((request) => !request.date).length;
  const addonRequests = requests.filter((request) => request.addons?.length).length;

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
  carForm.elements.tags.value = arrayToLines(car.tags);
  carForm.elements.details.value = arrayToLines(car.details);
  editorTitle.textContent = car.name || "New car";
  editorPreview.src = carImage(car);
  editorPreview.alt = car.name ? `${car.name} preview` : "";
  editorPrice.textContent = `$${Number(car.price || 0).toLocaleString()}/day`;
  editorMeta.textContent = [car.category_label, `${car.seats || seatsFor(car)} seats`, car.mileage].filter(Boolean).join(" / ");
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
    const { categoryLabel, gallery, image, image_url: localImageUrl, ...carPayload } = localPayload;
    carPayload.image_url = photos[0]?.file ? selectedCar()?.image_url || "" : localImageUrl;

    setStatus(adminStatus, "Saving car...");
    const saved = savedId
      ? await runQuery(supabase.from("cars").update(carPayload).eq("id", savedId).select().single())
      : await runQuery(supabase.from("cars").insert(carPayload).select().single());

    const savedPhotos = await savePhotos(saved.id, carPayload.slug);
    await saveAvailability(saved.id);
    if (savedPhotos[0]?.url) {
      await runQuery(supabase.from("cars").update({ image_url: savedPhotos[0].url }).eq("id", saved.id));
    }
    selectedCarId = saved.id;
    await loadCars();
    signalFleetRefresh();
    setStatus(adminStatus, "Saved to Supabase.", "success");
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

  const confirmed = window.confirm(`Delete ${car.name}? This removes the vehicle from the admin fleet.`);
  if (!confirmed) return;

  try {
    setStatus(adminStatus, `Deleting ${car.name}...`);

    if (isLocalCarId(car.id)) {
      setStatus(adminStatus, "Sync this website vehicle to Supabase before deleting it from every device.", "error");
      return;
    }

    if (!requireConfig()) return;
    await runQuery(supabase.from("car_photos").delete().eq("car_id", car.id));
    await runQuery(supabase.from("car_available_dates").delete().eq("car_id", car.id));
    await runQuery(supabase.from("cars").delete().eq("id", car.id));

    selectedCarId = null;
    await loadCars();
    signalFleetRefresh();
    setStatus(adminStatus, "Vehicle deleted from Supabase.", "success");
  } catch (error) {
    setStatus(adminStatus, friendlyError(error), "error");
  }
}

async function seedFleet() {
  if (!requireConfig()) return;
  try {
    setStatus(adminStatus, "Syncing current website fleet...");

    for (const localCar of fleet) {
      const { gallery, id, source, ...carPayload } = normalizeLocalCar(localCar);
      const saved = await runQuery(supabase.from("cars").upsert(carPayload, { onConflict: "slug" }).select().single());
      const photoRows = localCar.gallery.slice(0, MAX_LISTING_PHOTOS).map((url, index) => ({ car_id: saved.id, position: index + 1, url }));
      await runQuery(supabase.from("car_photos").delete().eq("car_id", saved.id));
      if (photoRows.length) await runQuery(supabase.from("car_photos").insert(photoRows));
      if (photoRows[0]?.url) await runQuery(supabase.from("cars").update({ image_url: photoRows[0].url }).eq("id", saved.id));
    }

    selectedCarId = null;
    await loadCars();
    signalFleetRefresh();
    setStatus(adminStatus, "Current website fleet synced into Supabase.", "success");
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
  if (data.session) await loadCars();
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
});

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

addDemoRequestButton.addEventListener("click", () => {
  requests.unshift({
    id: `manual-${Date.now()}`,
    name: "New client",
    phone: "",
    vehicle: selectedCar()?.name || cars[0]?.name || "Vehicle TBD",
    date: "",
    addons: ["Delivery"],
    message: "Manual lead. Add notes after the first call.",
    status: "new",
    createdAt: new Date().toISOString(),
  });
  writeJson(REQUESTS_KEY, requests);
  renderCrm();
});

requestPipeline.addEventListener("change", (event) => {
  const select = event.target.closest("[data-request-status]");
  if (!select) return;

  requests = requests.map((request) =>
    String(request.id) === String(select.dataset.requestStatus) ? { ...request, status: select.value } : request,
  );
  writeJson(REQUESTS_KEY, requests);
  renderCrm();
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
deleteCarButton?.addEventListener("click", deleteSelectedCar);
seedButton.addEventListener("click", seedFleet);

init();
