import { optimizedFleetImageUrl } from "./supabase-fleet.js";
import { renderDeskFollowups } from "./crm-desk-followups.js";
import { renderDeskDemand } from "./crm-desk-demand.js";
import { openInquiryReview } from "./crm-inquiry-review.js";
import { deskMovements, deskDay } from "./crm-dispatch-data.js";
import { dispatchOverview, bindDispatch, resetRentalDesk } from "./crm-dispatch-view.js";
import { loadNewportFunnel, newportCounts } from "./newport-funnel.js";
import { canViewFinancials } from "./crm-permissions.js";
import { ownedFleet } from "./owned-fleet.js";
import { renderOwnedFleet } from "./owned-fleet-view.js";
import { singleFlight, registerSection } from "./crm-navigation.js";
const root = document.querySelector("[data-executive-dashboard]");
const overviewButton = document.querySelector('[data-crm-section="overview"]');
const supabase = window.prestigeLuxorSupabase;

let loaded = false;
let needsRefresh = false;
let accountVersion = 0;
let ownershipError = "";
let scheduleReadFailed = false;
let unavailableTables = new Set();
let readyIds = new Set();
let model = { invoices: [], invoicePayments: [], agreements: [], quotes: [], proposals: [], bookings: [], cars: [], partners: [], profile: null };
let deskView = "desk";
let rangeKey = "this_month";
let chartMetric = "revenue";
let vehicleMetric = "revenue";
let customStart = "";
let customEnd = "";

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
const number = (value) => Number(value || 0);
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const isoDate = (value) => String(value || "").slice(0, 10);
const todayIso = () => { const date = new Date(); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); };
const titleCase = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const vehicleNameKey = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\bhurracan\b/g, "huracan")
  .replace(/\b(?:19|20)\d{2}\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function vehicleIndex(cars) {
  const index = new Map();
  cars.forEach((car) => {
    index.set(String(car.name || "").trim().toLowerCase(), car);
    const normalized = vehicleNameKey(car.name);
    if (normalized && !index.has(normalized)) index.set(normalized, car);
  });
  return index;
}

function resolveVehicle(value, index) {
  const name = String(value || "").trim();
  return index.get(name.toLowerCase()) || index.get(vehicleNameKey(name)) || null;
}
const dateLabel = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(`${isoDate(value)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function dayStart(value) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function dayEnd(value) { const date = new Date(value); date.setHours(23, 59, 59, 999); return date; }
function addDays(value, days) { const date = new Date(value); date.setDate(date.getDate() + days); return date; }

function selectedRange(key = rangeKey) {
  const now = new Date();
  let start; let end;
  if (key === "today") { start = dayStart(now); end = dayEnd(now); }
  else if (key === "this_week") { start = dayStart(addDays(now, -((now.getDay() + 6) % 7))); end = dayEnd(addDays(start, 6)); }
  else if (key === "last_month") { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = dayEnd(new Date(now.getFullYear(), now.getMonth(), 0)); }
  else if (key === "ytd") { start = new Date(now.getFullYear(), 0, 1); end = dayEnd(now); }
  else if (key === "custom" && customStart && customEnd) { start = dayStart(`${customStart}T00:00:00`); end = dayEnd(`${customEnd}T00:00:00`); }
  else { start = new Date(now.getFullYear(), now.getMonth(), 1); end = dayEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0)); }
  return { start, end };
}

function inRange(value, range) {
  if (!value) return false;
  const date = new Date(`${isoDate(value)}T12:00:00`);
  return date >= range.start && date <= range.end;
}

function invoiceDate(invoice) { return invoice.rental_start || invoice.issue_date || invoice.created_at; }
function agreementDate(agreement) { return agreement.rental_start || agreement.created_at; }
function invoiceGross(invoice) {
  return number(invoice.daily_rate) * Math.max(number(invoice.rental_days), 1) + number(invoice.delivery_fee) + number(invoice.addons_total) + number(invoice.insurance_fee) + number(invoice.mileage_fee) + number(invoice.fuel_fee) + number(invoice.tolls_fee) + number(invoice.damage_fee) + number(invoice.other_fee);
}
function invoiceRevenue(invoice) { return Math.max(invoiceGross(invoice) - number(invoice.discount), 0); }
function rentalBalance(invoice) { return Math.max(number(invoice.subtotal) - Math.min(number(invoice.amount_paid), number(invoice.subtotal)), 0); }
function isEarnedInvoice(invoice) { return !["draft", "void", "refunded"].includes(invoice.status); }

function bookingFinance(row) {
  const match = String(row?.notes || "").match(/\[PL_FINANCE\]([^\n]+)/);
  if (!match) return {};
  try { return JSON.parse(match[1]); } catch { return {}; }
}

function bookingCosts(row) {
  const finance = bookingFinance(row);
  return {
    partnerPayouts: number(row.partner_cost),
    processingFees: number(finance.processing_fee),
    deliveryCosts: number(finance.delivery_cost),
    detailing: number(finance.detailing_cost),
    other: number(finance.other_cost),
  };
}

async function safeRows(query) {
  try { const { data, error } = await query; return error ? [] : data || []; } catch { return []; }
}

async function dashboardRows(table, columns = "*") {
  const rows = [];
  try {
    for (let from=0; ; from+=500) {
      const {data,error} = await supabase.from(table).select(columns).order(table==="car_partners"?"car_id":"id").range(from,from+499);
      if(error) throw error;
      rows.push(...(data||[]));
      if((data||[]).length<500) return rows;
      if(from>=49500) throw new Error("Dashboard history exceeds the loading limit.");
    }
  } catch {
    unavailableTables.add(table);
    if (!["quotes","quote_requests"].includes(table)) ownershipError = "Financial records unavailable";
    if (["invoices", "rental_agreements", "booking_sales"].includes(table)) scheduleReadFailed = true;
    return [];
  }
}

const loadDashboard = singleFlight(async function (force = false) {
  if (!root || !supabase || (loaded && !force && !needsRefresh)) return;
  const version=accountVersion;
  needsRefresh = false;
  if (!loaded) root.innerHTML = `<div class="executive-dashboard-loading crm-loading-state" role="status">Loading rental records…</div>`;
  ownershipError = "";
  scheduleReadFailed = false;
  unavailableTables = new Set();
  const session = (await supabase.auth.getSession()).data.session;
  const userId = session?.user?.id;
  const [invoices, invoicePayments, agreements, quotes, proposals, bookings, cars, partners, profiles] = await Promise.all([
    dashboardRows("invoices"),
    dashboardRows("invoice_payments"),
    dashboardRows("rental_agreements"),
    dashboardRows("quote_requests"),
    dashboardRows("quotes", [
      "id","lead_id","quote_number","customer_first_name","customer_last_name","customer_email","vehicle_name",
      "status","follow_up_at","expires_at","sent_at","created_at","start_at","reservation_id",
    ].join(",")),
    dashboardRows("booking_sales"),
    dashboardRows("cars"),
    dashboardRows("car_partners"),
    userId ? safeRows(supabase.from("admin_profiles").select("display_name,role").eq("user_id", userId).limit(1)) : [],
  ]);
  const financial = canViewFinancials(profiles[0]?.role);
  const [expenses, newport, readiness] = await Promise.all([
    financial ? dashboardRows("vehicle_expenses") : [],
    financial ? loadNewportFunnel(supabase).catch(() => null) : null,
    loadReadiness(agreements),
  ]);
  if(version !== accountVersion) return;
  readyIds = readiness;
  model = { newport, expenses, invoices, invoicePayments, agreements, quotes, proposals, bookings, cars, partners, profile: profiles[0] || null, session };
  model.quotes.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  model.rentalReceipts = rentalReceipts(invoices, invoicePayments);
  loaded = true;
  render();
});

async function loadReadiness(agreements) {
  const result = new Set();
  const eligible = agreements.filter(item => item.status === "signed" && item.signed_at && (item.rental_start_at || item.rental_start)
    && deskDay(item.rental_start_at || item.rental_start) >= deskDay()).map(item => item.id);
  try {
    for (let start = 0; start < eligible.length; start += 75) {
      const { data, error } = await supabase.from("rental_agreement_events").select("agreement_id")
        .eq("event_type", "pickup_ready").in("agreement_id", eligible.slice(start,start+75));
      if (error) throw error;
      for (const entry of data || []) result.add(String(entry.agreement_id));
    }
  } catch { result.loaded = false; }
  return result;
}

export async function getOwnershipRow(id, range) {
  await loadDashboard();
  if (ownershipError || !canViewFinancials(model.profile?.role)) return null;
  return ownedFleet(model, range).rows.find(row => String(row.id) === String(id)) || null;
}

// Apply the invoice's lifetime rental cap before filtering by reporting period.
function rentalReceipts(invoices, payments) {
  const remaining = new Map(invoices.filter(isEarnedInvoice).map(row => [String(row.id), Math.max(0, Math.round(number(row.subtotal) * 100))]));
  const receipts = [];
  for (const payment of [...payments].sort((a,b) => String(a.paid_at).localeCompare(String(b.paid_at)))) {
    const id = String(payment.invoice_id);
    const cents = Math.min(remaining.get(id) || 0, Math.max(0, Math.round(number(payment.amount) * 100)));
    if (!cents) continue;
    remaining.set(id, remaining.get(id) - cents);
    receipts.push({...payment, amount: cents / 100});
  }
  return receipts;
}

function recordsForRange(range) {
  const agreements = model.agreements.filter((item) => item.status !== "cancelled" && item.signed_at && inRange(item.signed_at, range));
  const manualBookings = model.bookings.filter((item) => {
    const finance = bookingFinance(item);
    return !finance.cancelled && !finance.agreement_id && item.payment_status !== "refunded" && inRange(item.booked_on || item.created_at, range);
  });
  const bookings = [...agreements, ...manualBookings];
  const invoiceById = new Map(model.invoices.map((item) => [String(item.id), item]));
  const paymentInvoiceIds = new Set(model.invoicePayments.map((item) => String(item.invoice_id)));
  const invoiceCash = model.rentalReceipts.filter(payment => inRange(payment.paid_at, range));
  const legacyInvoiceCash = model.invoices.filter((invoice) => !paymentInvoiceIds.has(String(invoice.id)) && number(invoice.amount_paid) > 0 && isEarnedInvoice(invoice) && inRange(invoice.paid_at || invoice.updated_at, range)).map((invoice) => ({ invoice_id: invoice.id, amount: Math.min(number(invoice.amount_paid), number(invoice.subtotal)), paid_at: invoice.paid_at || invoice.updated_at }));
  const agreementById = new Map(model.agreements.map((item) => [String(item.id), item]));
  const manualCash = model.bookings.filter((item) => {
    const finance = bookingFinance(item);
    const agreement = finance.agreement_id ? agreementById.get(String(finance.agreement_id)) : null;
    const linkedInvoice = agreement?.source_type === "invoice" && invoiceById.has(String(agreement.source_id));
    return !linkedInvoice && number(item.amount_paid) > 0 && item.payment_status !== "refunded" && !finance.cancelled && inRange(finance.payment_date || item.booked_on, range);
  });
  const revenue = invoiceCash.reduce((sum, item) => sum + number(item.amount), 0) + legacyInvoiceCash.reduce((sum, item) => sum + number(item.amount), 0) + manualCash.reduce((sum, item) => sum + number(item.amount_paid), 0);
  const invoices = [...new Set([...invoiceCash, ...legacyInvoiceCash].map((item) => invoiceById.get(String(item.invoice_id))).filter(Boolean))];
  const earned = invoices;
  const gross = revenue;
  const costs = { discounts: 0, refunds: 0, partnerPayouts: 0, processingFees: 0, deliveryCosts: 0, detailing: 0, fuel: 0, other: 0 };
  model.bookings.forEach((item) => {
    const finance = bookingFinance(item);
    if (finance.cancelled || item.payment_status === "refunded" || !inRange(finance.cost_date || finance.payment_date || item.booked_on, range)) return;
    const rowCosts = bookingCosts(item);
    Object.keys(rowCosts).forEach((key) => { costs[key] += rowCosts[key]; });
  });
  const totalCosts = Object.values(costs).reduce((sum, value) => sum + value, 0);
  const netProfit = revenue - totalCosts;
  const completed = bookings.filter((item) => ["completed", "returned", "paid"].includes(item.status)).length;
  const upcoming = bookings.filter((item) => isoDate(item.rental_start || item.issue_date) >= todayIso() && !["completed", "cancelled", "void"].includes(item.status)).length;
  const outstanding = model.invoices.filter((item) => isEarnedInvoice(item) && inRange(invoiceDate(item), range)).reduce((sum, item) => sum + rentalBalance(item), 0);
  const depositsHeld = agreements.filter((item) => ["held", "charged"].includes(item.deposit_status) && !["completed", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Math.max(number(item.refundable_deposit) - number(item.deposit_deduction), 0), 0);
  return { agreements, invoices, bookings, earned, gross, revenue, costs, netProfit, completed, upcoming, outstanding, depositsHeld, invoiceCash, legacyInvoiceCash, manualCash };
}

function bucketsFor(range) {
  const totalDays = Math.max(1, Math.round((dayStart(range.end) - dayStart(range.start)) / 86400000) + 1);
  const count = totalDays <= 14 ? totalDays : totalDays <= 62 ? Math.min(10, Math.ceil(totalDays / 7)) : Math.min(12, Math.ceil(totalDays / 30));
  const size = Math.ceil(totalDays / count);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(range.start, index * size);
    const end = dayEnd(addDays(start, size - 1));
    return { start, end: end > range.end ? range.end : end, label: start.toLocaleDateString("en-US", { month: "short", day: totalDays <= 62 ? "numeric" : undefined }) };
  }).filter((item) => item.start <= range.end);
}

function chartData(range) {
  return bucketsFor(range).map((bucket) => {
    const data = recordsForRange(bucket);
    return { ...bucket, revenue: data.revenue, profit: data.netProfit, bookings: data.bookings.length };
  });
}

function periodChart(data, metric, total) {
  if (!data.length) return '<p class="dispatch-empty">Choose an end date on or after the start date.</p>';
  const values = data.map(row => number(row[metric]));
  const high = Math.max(...values, 0), low = Math.min(...values, 0);
  const span = high - low || 1;
  const baseline = -low / span * 100;
  const format = value => metric === "bookings" ? String(value) : money(value);
  const dateFormat = new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric"});
  const name = {revenue:"Rental payments",profit:"After recorded booking costs",bookings:"Bookings"}[metric];
  const bars = data.map((row,i) => {
    const value = values[i];
    const from = dateFormat.format(row.start), to = dateFormat.format(row.end);
    const period = from === to ? from : from + " – " + to;
    const height = Math.abs(value) / span * 100;
    const bottom = value < 0 ? baseline - height : baseline;
    return `<button type="button" data-dashboard-chart-period data-value="${escapeHtml(format(value))}" data-period="${escapeHtml(period)}"
      aria-label="${escapeHtml(period + ', ' + name + ', ' + format(value))}" style="--bar-bottom:${bottom}%;--bar-height:${height}%"><i aria-hidden="true"></i></button>`;
  }).join("");
  return `<div class="overview-period-chart"><div class="overview-chart-readout"><strong data-period-value>${format(total)}</strong><span data-period-label>${name} this period</span></div>
    <div class="overview-bars" role="group" aria-label="${name} by date" style="--zero:${baseline}%">${bars}</div>
    <div class="overview-chart-axis"><span>${dateFormat.format(data[0].start)}</span><span>${dateFormat.format(data.at(-1).end)}</span></div></div>`;
}

function bindPeriodChart() {
  const chart = root.querySelector(".overview-period-chart");
  if (!chart) return;
  const value = chart.querySelector("[data-period-value]"), label = chart.querySelector("[data-period-label]");
  const total = value.textContent, period = label.textContent;
  const bars = chart.querySelector(".overview-bars");
  function show(bar) {
    const previous = bars.querySelector(".is-selected");
    if (previous && previous !== bar) previous.classList.remove("is-selected");
    bar?.classList.add("is-selected");
    value.textContent = bar?.dataset.value ?? total;
    label.textContent = bar?.dataset.period ?? period;
  }
  for (const event of ["pointerover","focusin","click"]) {
    bars.addEventListener(event, e => show(e.target.closest("button")));
  }
  bars.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") show(bars.contains(document.activeElement) ? document.activeElement : null); });
  bars.addEventListener("focusout", e => { if (!bars.contains(e.relatedTarget)) show(null); });
  bars.addEventListener("keydown", e => {
    if (e.key === "Escape") { show(null); return; }
    const next = e.key === "ArrowLeft" ? e.target.previousElementSibling : e.key === "ArrowRight" ? e.target.nextElementSibling : null;
    if (next) { e.preventDefault(); next.focus(); }
  });
}

function sourceLabel(source) {
  const map = { "google-ads-landing-page": "Google Ads", instagram: "Instagram", google: "Google Organic", referral: "Referral", phone: "Phone", website: "Website", "wedding-page": "Wedding Page", "fleet-availability": "Exotic Rental Page", manual: "Phone" };
  return map[String(source || "website").toLowerCase()] || titleCase(source || "Other");
}

function render() {
  if (!root) return;
  if (!supabase) { root.innerHTML = `<div class="executive-dashboard-loading crm-loading-state">Connect Supabase to load the dashboard.</div>`; return; }
  const range = selectedRange();
  const current = recordsForRange(range);
  const month = rangeKey === "this_month" ? current : recordsForRange(selectedRange("this_month"));
  const reportsOpen = root.querySelector(".executive-reports")?.open || false;
  const ownedOpen = root.querySelector(".owned-report")?.open || false;
  const owner = canViewFinancials(model.profile?.role);
  if (!owner && chartMetric !== "bookings") chartMetric = "bookings";
  const today = deskDay();
  const invoiceById = new Map(model.invoices.map((item) => [String(item.id), item]));
  const quotes = model.quotes.filter((item) => inRange(item.created_at, range));
  const pipeline = { new: 0, contacted: 0, sent: 0, booked: 0 };
  quotes.forEach((item) => { if (item.status === "new") pipeline.new++; if (item.status === "checking") pipeline.contacted++; if (["available","alternative","approved"].includes(item.status)) pipeline.sent++; if (item.status === "booked") pipeline.booked++; });
  const openQuotes = quotes.filter((item) => !["booked","lost","cancelled","declined"].includes(item.status));
  const pipelineValue = openQuotes.reduce((sum,item) => sum + number(item.quote_total), 0);
  const conversion = quotes.length ? (pipeline.booked / quotes.length) * 100 : 0;
  const chart = chartData(range);
  const carByName = vehicleIndex(model.cars);
  const carById = new Map(model.cars.map((car) => [String(car.id), car]));
  const partnerCarIds = new Set(model.partners.map((item) => String(item.car_id)));
  const vehicleMap = new Map();
  const mergeVehicle = (rawName, values = {}, vehicleId = "") => {
    const fallbackName = String(rawName || "Vehicle TBD").trim() || "Vehicle TBD";
    const car = carById.get(String(vehicleId || "")) || resolveVehicle(fallbackName, carByName);
    const key = car ? `car:${car.id}` : `name:${vehicleNameKey(fallbackName) || fallbackName.toLowerCase()}`;
    const row = vehicleMap.get(key) || { name: car?.name || fallbackName, car, bookings: 0, revenue: 0, profit: 0 };
    row.bookings += number(values.bookings);
    row.revenue += number(values.revenue);
    row.profit += number(values.profit);
    vehicleMap.set(key, row);
  };
  current.bookings.forEach((item) => mergeVehicle(item.vehicle_name || item.vehicle, { bookings: 1 }, item.vehicle_id));
  [...current.invoiceCash, ...current.legacyInvoiceCash].forEach((payment) => { const invoice = invoiceById.get(String(payment.invoice_id)); if (invoice) mergeVehicle(invoice.vehicle_name, { revenue: payment.amount, profit: payment.amount }, invoice.vehicle_id); });
  current.manualCash.forEach((item) => mergeVehicle(item.vehicle, { revenue: item.amount_paid, profit: item.amount_paid }));
  model.bookings.filter((item) => { const f=bookingFinance(item); return !f.cancelled && inRange(f.cost_date || f.payment_date || item.booked_on, range); }).forEach((item) => mergeVehicle(item.vehicle, { profit: -Object.values(bookingCosts(item)).reduce((sum,value)=>sum+value,0) }));
  const vehicles = [...vehicleMap.values()].sort((a,b) => number(b[vehicleMetric])-number(a[vehicleMetric])).slice(0,5);
  const leadSources = new Map();
  quotes.forEach((quote) => { const label=sourceLabel(quote.source); const row=leadSources.get(label)||{label,leads:0,bookings:0,revenue:0}; row.leads++; if(quote.status==="booked")row.bookings++; const invoice=model.invoices.find(item=>item.source_type==="quote"&&String(item.source_id)===String(quote.id)); if(invoice)row.revenue+=[...current.invoiceCash,...current.legacyInvoiceCash].filter(payment=>String(payment.invoice_id)===String(invoice.id)).reduce((sum,payment)=>sum+number(payment.amount),0); leadSources.set(label,row); });
  const receivables = model.invoices.filter(item => isEarnedInvoice(item) && inRange(invoiceDate(item), range) && rentalBalance(item) > 0);
  const overdue = receivables.filter((item)=>item.due_date&&isoDate(item.due_date)<today);
  const pendingDeposits = current.agreements.filter((item)=>item.deposit_status==="pending").reduce((sum,item)=>sum+number(item.refundable_deposit),0);
  const attention = buildAttention(invoiceById);
  const movements = deskMovements(model, record => carById.get(String(record.vehicle_id || "")) ||
    resolveVehicle(record.vehicle_name || record.vehicle, carByName), bookingFinance, readyIds);
  const attentionPartial = ["quote_requests","invoices","rental_agreements"].some(table => unavailableTables.has(table));
  const knownIssues = groupAttention(attention);
  const attentionHtml = (attentionPartial ? '<p class="dispatch-empty" role="status">Some records could not be loaded. Showing known items.</p>' : "") +
    (knownIssues.length ? knownIssues.map(attentionRow).join("") : attentionPartial ? "" : '<p class="dispatch-empty">No outstanding items.</p>');
  const hasBusinessData = Boolean(model.invoices.length || model.agreements.length || model.quotes.length || model.bookings.length);
  const activeCars = model.cars.filter(car => car.is_active !== false && car.operational_status !== "inactive");
  const monthUnavailable = ["invoices","invoice_payments","rental_agreements","booking_sales"].some(table => unavailableTables.has(table));
  const count = (value, failed) => failed ? "—" : value;
  const pipelineUnavailable = unavailableTables.has("quote_requests");
  const reportUnavailable = chartMetric === "bookings" ? scheduleReadFailed : monthUnavailable;
  const funnel = owner ? `<section class="executive-card studio-funnel"><div class="executive-card-head"><div><h3>Direct booking activity</h3><p>Newport Beach · Huracán EVO</p></div></div>
    ${model.newport ? '<div class="traffic-kpis">' + newportCounts(model.newport,model,range).map((value,index) => '<article><span>' + ['Button clicks','Browser sessions','Reservation requests','Requests with a paid booking'][index] + '</span><strong>' + value + '</strong></article>').join('') + '</div>' : '<p>Tracking data unavailable.</p>'}</section>` : "";
  const secondaryAnalytics = owner ? `
    <details class="executive-reports" ${reportsOpen ? "open" : ""}><summary><span><strong>Reports &amp; financials</strong><small>Vehicle performance, revenue, lead sources and balances</small></span><span aria-hidden="true">+</span></summary><div class="executive-report-content">
    <div class="executive-two-column executive-balanced">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Top Performing Vehicles</h3><p>Owned and partner inventory.</p></div>${toggle("vehicle",["revenue","profit","bookings"],vehicleMetric)}</div><div class="vehicle-performance-list">${vehicles.length?vehicles.map((item,index)=>vehicleRow(item,index,carByName,partnerCarIds)).join(""):`<p class="admin-empty">Vehicle performance will appear after agreements are created.</p>`}</div></section>
      <section class="executive-card"><div class="executive-card-head"><div><h3>Financial Breakdown</h3><p>Deposits are excluded from revenue.</p></div></div>${financialBreakdown(current)}</section>
    </div>
    <div class="executive-two-column executive-balanced">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Lead Sources</h3><p>Acquisition performance from existing lead data.</p></div></div>${leadSourceTable([...leadSources.values()])}</section>
      <section class="executive-card money-collect-card"><div class="executive-card-head"><div><h3>Money to Collect</h3><p>Rental receivables and pending deposits.</p></div><strong>${money(current.outstanding+pendingDeposits)}</strong></div><div class="money-summary"><span>Upcoming balances<b>${money(current.outstanding-overdue.reduce((sum,item)=>sum+rentalBalance(item),0))}</b></span><span>Overdue balances<b>${money(overdue.reduce((sum,item)=>sum+rentalBalance(item),0))}</b></span><span>Pending deposits<b>${money(pendingDeposits)}</b></span></div>${collectionList(receivables)}</section>
    </div>
    ${funnel}
    </div></details>` : "";
  const followupsHtml = renderDeskFollowups({
    quotes:model.proposals, requests:model.quotes, today,
    failed:unavailableTables.has("quotes"), requestsFailed:unavailableTables.has("quote_requests"),
  });
  const demandHtml = renderDeskDemand({
    requests:model.quotes, cars:model.cars, today, failed:unavailableTables.has("quote_requests"),
  });
  const fleetUnavailable = unavailableTables.has("cars");
  const fleetHtml = fleetContext(activeCars, partnerCarIds, {
    fleetUnavailable, ownershipUnavailable: unavailableTables.has("car_partners"),
    monthLabel: owner ? "Payments this month" : "Bookings this month",
    monthValue: owner ? count(money(month.revenue), monthUnavailable) : count(month.bookings.length, scheduleReadFailed),
  });
  const dayLabel = new Date(today + "T12:00:00").toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric"});
  const canWrite = ["owner","manager","staff"].includes(model.profile?.role);
  root.innerHTML = `
    <header class="desk-mast">
      <div><time datetime="${today}">${dayLabel}</time><h2>Rental desk</h2></div>
      ${canWrite ? `<div class="desk-actions"><button type="button" data-dashboard-create="booking"><span aria-hidden="true">+</span> Add booking</button><details class="desk-create-menu"><summary aria-label="More create actions" title="More create actions">•••</summary><div><button type="button" data-dashboard-create="quote">New quote</button><button type="button" data-dashboard-create="invoice">New invoice</button></div></details></div>` : ""}
    </header>
    <nav class="desk-view-switch" aria-label="Overview views">${[["desk","Desk"],["reports","Reports"]].map(([key,label]) => `<button type="button" data-desk-view="${key}" aria-controls="rental-view-${key}" aria-pressed="${deskView === key}">${label}</button>`).join("")}</nav>
    <div id="rental-view-desk" data-desk-screen="desk" ${deskView === "desk" ? "" : "hidden"}>
      ${dispatchOverview({rows:movements, requests:model.quotes, attentionHtml, attentionCount:knownIssues.length, partial:attentionPartial, inquiryFailed:unavailableTables.has("quote_requests"), scheduleFailed:scheduleReadFailed, fleetHtml, followupsHtml, demandHtml})}
    </div>
    <div id="rental-view-reports" class="desk-report-surface" data-desk-screen="reports" ${deskView === "reports" ? "" : "hidden"}>
    <header class="overview-report-head"><h3>Business performance</h3>
      <div class="overview-range"><label><span>Reporting period</span><select data-dashboard-range><option value="today">Today</option><option value="this_week">This week</option><option value="this_month">This month</option><option value="last_month">Last month</option><option value="ytd">Year to date</option><option value="custom">Custom</option></select></label>
      <div class="executive-custom-dates" ${rangeKey==="custom"?"":"hidden"}><input type="date" value="${escapeHtml(customStart)}" data-dashboard-start aria-label="Custom start date"><input type="date" value="${escapeHtml(customEnd)}" data-dashboard-end aria-label="Custom end date"></div></div></header>
    <div class="overview-reports-grid">
      <section class="overview-secondary-panel overview-chart"><header><h3>${owner ? "Fleet performance" : "Booking activity"}</h3>${owner ? toggle("chart",["revenue","profit","bookings"],chartMetric) : ""}</header>
      ${reportUnavailable ? '<p class="dispatch-empty">Some rental records could not be loaded.</p>' : hasBusinessData ? periodChart(chart,chartMetric,{revenue:current.revenue,profit:current.netProfit,bookings:current.bookings.length}[chartMetric]) : '<p class="dispatch-empty">No rental activity recorded for this period.</p>'}</section>
      <section class="overview-secondary-panel"><header><h3>Sales pipeline</h3><button type="button" data-dashboard-section="requests">View quotes <span aria-hidden="true">→</span></button></header>
        <dl class="overview-lines">${[["New inquiries",pipeline.new],["Checking availability",pipeline.contacted],["Quote ready or offered",pipeline.sent],["Booked",pipeline.booked]].map(([label,value]) => `<div><dt>${label}</dt><dd>${count(value,unavailableTables.has("quote_requests"))}</dd></div>`).join("")}</dl>
        ${owner ? `<div class="pipeline-summary"><span>Open pipeline <strong>${count(money(pipelineValue),pipelineUnavailable)}</strong></span><span>Booked <strong>${count(conversion.toFixed(1)+"%",pipelineUnavailable)}</strong></span></div>` : ""}</section>
    </div>
    ${secondaryAnalytics}
    ${owner ? `<details class="owned-report" ${ownedOpen ? "open" : ""}><summary>Prestige-owned cars <span aria-hidden="true">＋</span></summary><div data-overview-owned></div></details>` : ""}
    </div>`;
  root.querySelector("[data-dashboard-range]").value = rangeKey;
  const detail = root.querySelector(".owned-report");
  function showOwnership() {
    const host = detail.querySelector("[data-overview-owned]");
    if (!detail.open || host.hasChildNodes()) return;
    host.innerHTML = renderOwnedFleet(model, range, {error:ownershipError, readOnly:model.profile?.role === "viewer"});
    bindOwnedLinks(host);
  }
  if (detail) {
    detail.addEventListener("toggle", showOwnership);
    showOwnership();
  }
  bindPeriodChart();
  bindDashboard();
  bindDispatch(root, movements, {
    requests: model.quotes, inquiryFailed: unavailableTables.has("quote_requests"), canWrite,
    refresh: () => loadDashboard(true),
    openRecord: (kind, id) => {
      if (kind === "agreement") return openRecord(kind, id);
      document.querySelector('[data-crm-section="bookings"]')?.click();
      window.dispatchEvent(new CustomEvent("prestige:open-booking", { detail: { id } }));
    },
    markReady: async id => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Sign in again to update this handoff.");
      const response = await fetch("/api/agreements", {
        method: "POST", headers: { "Content-Type":"application/json", Authorization:"Bearer "+session.access_token },
        body: JSON.stringify({ action:"pickup_ready", id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ready) throw new Error(result.error || "Pickup preparation could not be saved. Try again.");
      readyIds.add(String(id));
      render();
    },
  });
}

function fleetContext(cars, partnerIds, {fleetUnavailable, ownershipUnavailable, monthLabel, monthValue}) {
  const owned = cars.filter(car => car.ownership_type === "prestige" && !partnerIds.has(String(car.id))).length;
  const partner = cars.filter(car => car.ownership_type === "partner" || partnerIds.has(String(car.id))).length;
  const makes = new Set();
  const photos = [];
  for (const car of cars) {
    const make = String(car.make || car.name?.replace(/^(?:19|20)\d{2}\s+/, "").split(" ")[0] || "").toLowerCase();
    if (!car.image_url || !make || makes.has(make)) continue;
    makes.add(make);
    photos.push(car);
    if (photos.length === 3) break;
  }
  const mix = ownershipUnavailable ? "" : [
    [owned, "owned"], [partner, "partner"], [cars.length - owned - partner, "unassigned"],
  ].filter(([value]) => value).map(([value,label]) => value + " " + label).join(" · ");
  return `<section class="desk-context"><header><h3>Fleet snapshot</h3><button type="button" data-dashboard-section="vehicles">View fleet <span aria-hidden="true">↗</span></button></header>
    ${photos.length > 1 ? `<div class="desk-fleet-photos">${photos.map(car => `<img src="${escapeHtml(optimizedFleetImageUrl(car.image_url,{width:320,height:195,quality:76,updatedAt:car.updated_at}))}" data-fleet-original="${escapeHtml(car.image_url)}" alt="${escapeHtml(car.name)}" loading="lazy" decoding="async">`).join("")}</div>` : ""}
    <dl class="desk-context-lines"><div><dt>Active fleet${mix ? `<small>${escapeHtml(mix)}</small>` : ""}</dt><dd>${fleetUnavailable ? "—" : cars.length}</dd></div><div><dt>${monthLabel}</dt><dd>${monthValue}</dd></div></dl></section>`;
}

function toggle(group,items,active){return `<div class="executive-toggle" role="group" aria-label="${titleCase(group)} metric">${items.map(item=>`<button type="button" class="${item===active?"active":""}" data-dashboard-toggle="${group}" data-value="${item}">${titleCase(item)}</button>`).join("")}</div>`;}
function vehicleRow(item,index,carByName,partnerCarIds){const car=item.car||resolveVehicle(item.name,carByName);const partner=car&&partnerCarIds.has(String(car.id));return `<article><span class="vehicle-rank">${index+1}</span>${car?.image_url?`<img src="${escapeHtml(car.image_url)}" alt="" loading="lazy" decoding="async">`:`<span class="vehicle-placeholder">PL</span>`}<div><strong>${escapeHtml(car?.name||item.name)}</strong><small>${partner?"Partner vehicle":car?"Prestige-owned vehicle":"Unassigned vehicle"}</small></div><span><b>${item.bookings}</b><small>Bookings</small></span><span><b>${money(item.revenue)}</b><small>Revenue</small></span><span><b>${money(item.profit)}</b><small>Profit</small></span></article>`;}
function financialBreakdown(data){const revenueRows=[["Invoice payments collected",data.invoiceCash.reduce((sum,item)=>sum+number(item.amount),0)+data.legacyInvoiceCash.reduce((sum,item)=>sum+number(item.amount),0)],["Manual booking payments",data.manualCash.reduce((sum,item)=>sum+number(item.amount_paid),0)],["Refundable deposits",0]];const costs=[["Partner vehicle costs",data.costs.partnerPayouts],["Stripe / card fees",data.costs.processingFees],["Delivery costs",data.costs.deliveryCosts],["Detailing",data.costs.detailing],["Other costs",data.costs.other]];return `<div class="financial-columns"><div><h4>Collected revenue</h4>${revenueRows.map(([l,v])=>`<p><span>${l}</span><b>${money(v)}</b></p>`).join("")}</div><div><h4>Recorded costs</h4>${costs.map(([l,v])=>`<p><span>${l}</span><b>${money(v)}</b></p>`).join("")}</div></div><div class="financial-net"><span>Net Profit</span><strong>${money(data.netProfit)}</strong></div>`;}
function leadSourceTable(rows){return rows.length?`<div class="executive-table-wrap crm-table-container"><table><thead><tr><th>Source</th><th>Leads</th><th>Bookings</th><th>Conversion</th><th>Revenue</th></tr></thead><tbody>${rows.sort((a,b)=>b.leads-a.leads).map(row=>`<tr><td><strong>${escapeHtml(row.label)}</strong></td><td>${row.leads}</td><td>${row.bookings}</td><td>${row.leads?((row.bookings/row.leads)*100).toFixed(1):"0.0"}%</td><td>${money(row.revenue)}</td></tr>`).join("")}</tbody></table></div><p class="executive-data-note">Spend and ROAS are hidden because ad-spend data is not stored in the CRM.</p>`:`<p class="admin-empty">Lead sources will appear when quote requests exist.</p>`;}
function collectionList(rows){return rows.length?`<div class="collection-list">${rows.sort((a,b)=>String(a.due_date||"").localeCompare(String(b.due_date||""))).slice(0,6).map(item=>`<button type="button" data-dashboard-open="invoice" data-id="${item.id}"><span><strong>${escapeHtml(item.customer_name)}</strong><small>${escapeHtml(item.vehicle_name)}</small></span><span><b>${money(rentalBalance(item))}</b><small>${item.due_date?dateLabel(item.due_date):"No due date"} · ${item.due_date&&isoDate(item.due_date)<todayIso()?"Overdue":"Upcoming"}</small></span></button>`).join("")}</div>`:`<p class="admin-empty">No rental balances to collect in this period.</p>`;}

function buildAttention(invoiceById){const now=new Date();const items=[];model.agreements.forEach(item=>{if(["completed","cancelled"].includes(item.status))return;if(!item.license_file_path)items.push({priority:2,title:"Missing driver's license",detail:`${item.customer_name} · ${item.vehicle_name}`,kind:"agreement",id:item.id});if(!item.insurance_file_path)items.push({priority:2,title:"Missing insurance",detail:`${item.customer_name} · ${item.vehicle_name}`,kind:"agreement",id:item.id});if(!item.signed_at)items.push({priority:2,title:"Unsigned agreement",detail:`${item.customer_name} · ${dateLabel(item.rental_start)}`,kind:"agreement",id:item.id});if(item.deposit_status==="pending"&&number(item.refundable_deposit))items.push({priority:2,title:"Unpaid deposit",detail:`${item.customer_name} · ${money(item.refundable_deposit)}`,kind:"agreement",id:item.id});if(item.status==="vehicle_out"&&item.rental_end&&new Date(`${item.rental_end}T23:59:59`)<now)items.push({priority:3,title:"Overdue vehicle return",detail:`${item.vehicle_name} · due ${dateLabel(item.rental_end)}`,kind:"agreement",id:item.id});const invoice=item.source_type==="invoice"?invoiceById.get(String(item.source_id)):null;if(invoice&&invoice.due_date&&isoDate(invoice.due_date)<todayIso()&&rentalBalance(invoice)>0)items.push({priority:3,title:"Overdue balance",detail:`${invoice.customer_name} · ${money(rentalBalance(invoice))}`,kind:"invoice",id:invoice.id});});model.quotes.forEach(item=>{if(item.status==="checking")items.push({priority:2,title:"Partner vehicle not confirmed",detail:`${item.name} · ${item.vehicle}`,kind:"quote",id:item.id});if(item.follow_up_at&&new Date(item.follow_up_at)<now&&!["booked","lost","cancelled","declined"].includes(item.status))items.push({priority:2,title:"Overdue follow-up",detail:`${item.name} · ${item.vehicle}`,kind:"quote",id:item.id});});return items.sort((a,b)=>b.priority-a.priority);}
function groupAttention(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (!groups.has(key)) groups.set(key, {...item, issues: []});
    groups.get(key).issues.push(item);
  }
  return [...groups.values()];
}
function attentionRow(item){
  const record = (item.kind === "agreement" ? model.agreements : item.kind === "invoice" ? model.invoices : model.quotes).find(row => String(row.id) === String(item.id));
  const name = record?.customer_name || record?.name || item.detail.split(" · ")[0];
  const vehicle = record?.vehicle_name || record?.vehicle || "";
  return `<button type="button" data-dashboard-open="${item.kind}" data-id="${item.id}"><i class="priority-${item.priority}" aria-hidden="true">${item.priority === 1 ? "↳" : "!"}</i><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(vehicle)}</small><span class="attention-issues">${item.issues.map(issue=>`<span>${escapeHtml(issue.title)}${issue.title === "Unpaid deposit" ? ` · ${money(record?.refundable_deposit)}` : ""}</span>`).join("")}</span></span><b>Review <span aria-hidden="true">↗</span></b></button>`;
}
function bindOwnedLinks(host){
  host.querySelector("[data-owned-refresh]")?.addEventListener("click",()=>loadDashboard(true));
  host.querySelectorAll("[data-owned-vehicle],[data-owned-expense]").forEach(button=>button.addEventListener("click",()=>{
    if(!button.dataset.ownedExpense)document.querySelector('[data-crm-section="vehicles"]')?.click();
    window.dispatchEvent(new CustomEvent("prestige:owned-vehicle",{detail:{id:button.dataset.ownedVehicle||button.dataset.ownedExpense,expense:!!button.dataset.ownedExpense,category:button.dataset.ownedCategory,range:selectedRange()}}));
  }));
}

function bindDashboard(){
  root.querySelector("[data-dashboard-range]")?.addEventListener("change",(event)=>{rangeKey=event.target.value;if(rangeKey==="custom"&&!customStart){customStart=todayIso();customEnd=todayIso();}render();});
  root.querySelector("[data-dashboard-start]")?.addEventListener("change",(event)=>{customStart=event.target.value;if(customStart&&customEnd)render();});
  root.querySelector("[data-dashboard-end]")?.addEventListener("change",(event)=>{customEnd=event.target.value;if(customStart&&customEnd)render();});
  root.querySelectorAll("[data-dashboard-toggle]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.dashboardToggle==="chart")chartMetric=button.dataset.value;else vehicleMetric=button.dataset.value;render();}));
  root.querySelectorAll("[data-dashboard-section]").forEach(button=>button.addEventListener("click",()=>document.querySelector(`[data-crm-section="${button.dataset.dashboardSection}"]`)?.click()));
  root.querySelectorAll("[data-dashboard-create]").forEach(button=>button.addEventListener("click",()=>{
    const type=button.dataset.dashboardCreate;
    const section=type==="invoice"?"invoices":type==="quote"?"requests":type==="booking"?"bookings":"vehicles";
    const trigger=type==="invoice"?"[data-new-invoice]":type==="quote"?"[data-new-quote]":type==="booking"?"[data-new-booking]":"[data-new-car]";
    document.querySelector(`[data-crm-section="${section}"]`)?.click();
    setTimeout(()=>document.querySelector(trigger)?.click(),120);
  }));
  for (const photo of root.querySelectorAll("img[data-fleet-original]")) {
    photo.addEventListener("error", () => {
      if (photo.getAttribute("src") !== photo.dataset.fleetOriginal) photo.src = photo.dataset.fleetOriginal;
    }, {once:true});
  }
  const menu = root.querySelector(".desk-create-menu");
  menu?.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
  menu?.addEventListener("focusout", event => { if (!menu.contains(event.relatedTarget)) menu.open = false; });
  root.querySelectorAll("[data-desk-view]").forEach(button => button.addEventListener("click", () => {
    deskView = button.dataset.deskView;
    for (const control of root.querySelectorAll("[data-desk-view]")) control.setAttribute("aria-pressed", String(control === button));
    for (const panel of root.querySelectorAll("[data-desk-screen]")) panel.hidden = panel.dataset.deskScreen !== deskView;
  }));
}

function openRecord(kind, id, trigger) {
  if (kind === "quote") {
    const request = model.quotes.find(row => String(row.id) === String(id));
    if (request) {
      openInquiryReview(request, trigger, {canWrite:["owner","manager","staff"].includes(model.profile?.role)});
      return;
    }
    document.querySelector('[data-crm-section="requests"]')?.click();
    return;
  }
  if (kind === "proposal") {
    document.querySelector('[data-crm-section="requests"]')?.click();
    window.dispatchEvent(new CustomEvent("prestige:open-quote", {detail:{id}}));
    return;
  }
  const section = kind === "invoice" ? "invoices" : "agreements";
  document.querySelector(`[data-crm-section="${section}"]`)?.click();
  window.dispatchEvent(new CustomEvent(`prestige:open-${kind}`, {detail:{id}}));
}

root?.addEventListener("click", event => {
  const button = event.target.closest("[data-dashboard-open]");
  if (button) openRecord(button.dataset.dashboardOpen, button.dataset.id, button);
});
document.addEventListener("pointerdown", event => {
  const menu = root?.querySelector(".desk-create-menu[open]");
  if (menu && !menu.contains(event.target)) menu.open = false;
});
overviewButton?.addEventListener("click",()=>loadDashboard());
function refreshRecords() {
  needsRefresh = true;
  if (!document.querySelector("[data-admin-view]").hidden && overviewButton.classList.contains("active")) loadDashboard(true);
}
window.addEventListener("prestige:finance-updated",refreshRecords);
window.addEventListener("prestige:rental-record-updated",refreshRecords);
supabase?.auth.onAuthStateChange((event,session)=>{if(!session){accountVersion++;loaded=false;deskView="desk";resetRentalDesk();readyIds=new Set();root.replaceChildren();model={invoices:[],invoicePayments:[],agreements:[],quotes:[],proposals:[],bookings:[],cars:[],partners:[],profile:null};}else if(document.querySelector('[data-section-panel="overview"]')?.classList.contains("active"))loadDashboard();});
if (!document.querySelector("[data-admin-view]")?.hidden) loadDashboard();
setTimeout(() => { if (!document.querySelector("[data-admin-view]")?.hidden && !loaded) loadDashboard(); }, 900);

registerSection("overview", loadDashboard);
