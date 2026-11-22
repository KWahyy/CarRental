import { deskDay } from "./crm-dispatch-data.js";
import { escapeFleetText as escapeHtml } from "./home-fleet-model.js";
import { featuredBrands } from "./vehicle-brands.js";

const receivedDate = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", timeZone: "America/Los_Angeles",
});

export function isTestInquiry(request) {
  if (request.is_test === true || request.is_synthetic === true) return true;
  const name = String(request.name || "").trim();
  const email = String(request.email || "").trim();
  const testMarker = /^(?:test|retest|qa test)\b|\b(?:test only|do not contact|(?:pixel|email|quote|delivery|tracking|booking|form) (?:test|retest))\b/i;
  return testMarker.test(name) || /^(?:test|qa-test|synthetic-test)$/i.test(request.source || "")
    || /^(?:test only|synthetic (?:test|submission))\b/i.test(request.message || "")
    || /@(?:example\.(?:com|org|net)|[^@\s]+\.(?:test|invalid))$/i.test(email);
}

function cleanName(value) {
  return String(value || "").replace(/\s*[-–—·|]?\s*(?:from\s*)?\$\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:\/|per)\s*(?:day|night))?\s*$/i, "").trim();
}

function normalized(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bhurracan\b/g, "huracan").replace(/[^a-z0-9]+/g, " ").trim();
}

const unspecified = new Set([
  "n a", "none", "unknown", "unspecified", "undecided", "tbd", "car", "vehicle", "other", "any", "any car", "any vehicle",
  "not sure", "not sure yet", "open to options", "open to recommendations", "help me decide", "vehicle tbd", "car tbd",
  "vehicle to confirm", "vehicle request", "vehicle pending", "choose a car", "choose a vehicle", "select a car",
  "select a vehicle", "select your vehicle", "vehicle recommendation requested", "exotic or supercar", "rolls royce or grand luxury",
  "luxury suv", "convertible", "exotic", "suv", "supercar",
]);
const stripYear = name => name.replace(/^(?:19|20)\d{2}\s+/, "");

function catalogIndex(cars) {
  const byId = new Map();
  const bySlug = new Map();
  const byName = new Map();
  const makes = new Set(featuredBrands.map(normalized));
  for (const car of cars) {
    if (!car.name) continue;
    if (car.id) byId.set(String(car.id), car);
    if (car.slug) bySlug.set(car.slug, car);
    if (car.make) makes.add(normalized(car.make));
    const name = normalized(car.name);
    const withoutYear = stripYear(name);
    const aliases = new Set([name, withoutYear]);
    if (car.year) aliases.add(car.year + " " + withoutYear);
    for (const alias of aliases) {
      // A label shared by more than one fleet record cannot identify a specific car.
      byName.set(alias, byName.has(alias) && byName.get(alias) !== car ? null : car);
    }
  }
  return {byId, bySlug, byName, makes};
}

export function vehicleDemand(requests, cars, today = deskDay()) {
  const start = new Date(today + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - 29);
  const first = start.toISOString().slice(0, 10);
  const catalog = catalogIndex(cars);
  const groups = new Map();
  const seen = new Set();
  for (const request of requests) {
    if (!request.id || seen.has(request.id) || !request.created_at) continue;
    const day = deskDay(request.created_at);
    if (!day || day < first || day > today || !Number.isFinite(Date.parse(request.created_at))) continue;
    if (isTestInquiry(request) || request.source === "partner-vehicle-review") continue;
    const label = cleanName(request.vehicle);
    const key = normalized(label);
    const car = catalog.byId.get(String(request.vehicle_id || "")) || catalog.bySlug.get(request.vehicle_slug)
      || catalog.bySlug.get(label) || catalog.byName.get(key);
    if (!car && (!key || unspecified.has(key) || key.includes("help me choose") || catalog.makes.has(key))) continue;
    const groupKey = car ? "car:" + (car.id || car.slug || normalized(car.name)) : "name:" + key;
    if (!groups.has(groupKey)) groups.set(groupKey, {name: car?.name || label, requests: []});
    groups.get(groupKey).requests.push(request);
    seen.add(request.id);
  }
  const ranked = [...groups.values()].sort((a,b) => b.requests.length - a.requests.length || a.name.localeCompare(b.name, "en"));
  return ranked.slice(0, 3).map(group => ({
    ...group, requests: group.requests.sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
  }));
}

function inquiryItem(request) {
  const timestamp = String(request.created_at);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(timestamp) ? timestamp + "T12:00:00Z" : timestamp);
  return `<li><button type="button" data-dashboard-open="quote" data-id="${escapeHtml(request.id)}">
    <span>${escapeHtml(request.name || "Customer inquiry")}</span><time datetime="${escapeHtml(timestamp)}">${receivedDate.format(date)}</time>
  </button></li>`;
}

function demandRow(group, max) {
  const count = group.requests.length;
  const share = (100 * count / max).toFixed(1) + "%";
  return `<details class="desk-demand-vehicle"><summary>
    <span class="desk-demand-name">${escapeHtml(group.name)}</span><span class="desk-demand-count">${count} ${count === 1 ? "inquiry" : "inquiries"}</span><span class="desk-demand-chevron" aria-hidden="true">⌄</span>
    <i class="desk-demand-bar" aria-hidden="true"><i style="--demand-share:${share}"></i></i>
    </summary><ul class="desk-demand-inquiries" aria-label="Inquiries for ${escapeHtml(group.name)}">${group.requests.map(inquiryItem).join("")}</ul></details>`;
}

export function renderDeskDemand({requests, cars, failed, today}) {
  const ranked = failed ? [] : vehicleDemand(requests, cars, today);
  const contents = ranked.length
    ? `<div class="desk-demand-list">${ranked.map(group => demandRow(group, ranked[0].requests.length)).join("")}</div>`
    : `<p class="desk-no-data"${failed ? ' role="status"' : ''}>${failed ? "Inquiry data is unavailable." : "No vehicle-specific inquiries in the last 30 days."}</p>`;
  return `<section class="desk-demand" data-desk-demand aria-labelledby="desk-demand-title"><header>
    <h3 id="desk-demand-title">Most requested vehicles</h3><small>Last 30 days</small></header>${contents}</section>`;
}
