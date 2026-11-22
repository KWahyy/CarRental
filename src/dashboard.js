import {compactPersonName, compactVehicleName} from "./crm-compact-labels.js";
import {overviewMarkup, bindOverview, bindOperatingReports} from "./crm-desk-overview.js";
import {rentalLedger, financeNote} from "./crm-desk-overview-ledger.js";
import {businessDay} from "./crm-desk-overview-revenue.js";
import { canViewFinancials } from "./crm-permissions.js";
import { renderOwnedFleet } from "./owned-fleet-view.js";
import { singleFlight, registerSection } from "./crm-navigation.js";
const root = document.querySelector("[data-executive-dashboard]");
const overviewButton = document.querySelector('[data-crm-section="overview"]');
const supabase = window.prestigeLuxorSupabase;
let failedTables = new Set();
let cashLedger = [];
let rentalBalances = 0;
let statementModel;
let sessionGeneration = 0;
let financeVersion = 0;
let financeRefresh = null;
const overviewFreshMs = 30_000;
let lastOverviewRead = 0, changeVersion = 0;
let overview, renderedRole, activityRead;

let loaded = false;
let ownershipError = "";
let model = { invoices: [], invoicePayments: [], agreements: [], quotes: [], quoteActivities: [], invoiceEvents: [], agreementEvents: [], bookings: [], cars: [], partners: [], profile: null };
let rangeKey = "this_month";
let chartMetric = "revenue";
let vehicleMetric = "revenue";
let customStart = "";
let customEnd = "";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD",minimumFractionDigits:0,maximumFractionDigits:2 });
const money = value => currency.format(Number(value || 0));
const number = (value) => Number(value || 0);
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const isoDate = (value) => String(value || "").slice(0, 10);
const todayIso = () => businessDay();
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
  const now = new Date(todayIso()+"T12:00:00");
  let start; let end;
  if (key === "today") { start = dayStart(now); end = dayEnd(now); }
  else if (key === "this_week") { start = dayStart(addDays(now, -((now.getDay() + 6) % 7))); end = dayEnd(addDays(start, 6)); }
  else if (key === "last_month") { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = dayEnd(new Date(now.getFullYear(), now.getMonth(), 0)); }
  else if (key === "ytd") { start = new Date(now.getFullYear(), 0, 1); end = dayEnd(now); }
  else if (key === "custom" && customStart && customEnd) { start = dayStart(`${customStart}T00:00:00`); end = dayEnd(`${customEnd}T00:00:00`); }
  else { start = new Date(now.getFullYear(), now.getMonth(), 1); end = dayEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0)); }
  return { start, end };
}

function rangeDays({start,end}) {
  const dayNumber = date => Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()) / 86400000;
  return Math.max(1,dayNumber(end)-dayNumber(start)+1);
}
function previousRange(range) {
  const days = rangeDays(range);
  const end = dayEnd(addDays(range.start, -1));
  return { start: dayStart(addDays(end, -(days - 1))), end };
}

function inRange(value, range) {
  if (!value) return false;
  const date = new Date(`${isoDate(value)}T12:00:00`);
  return date >= range.start && date <= range.end;
}

function invoiceDate(invoice) { return invoice.rental_start || invoice.issue_date || invoice.created_at; }
function agreementDate(agreement) { return agreement.rental_start || agreement.created_at; }
function rentalBalance(invoice) { return Math.max(number(invoice.subtotal) - Math.min(number(invoice.amount_paid), number(invoice.subtotal)), 0); }
function isEarnedInvoice(invoice) { return !["draft", "void", "refunded"].includes(invoice.status); }

const bookingFinance = financeNote;

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

async function financialRows(table, failures) {
  const rows = [];
  try {
    for (let from=0; ; from+=500) {
      const {data,error} = await supabase.from(table).select("*").order(table==="car_partners"?"car_id":"id").range(from,from+499);
      if(error) throw error;
      rows.push(...(data||[]));
      if((data||[]).length<500) return rows;
      if(from>=49500) throw new Error("Financial history exceeds the safe loading limit.");
    }
  } catch(error) { failures.add(table); return []; }
}

async function readDashboard(force = false) {
  if (!root || !supabase || (loaded && !force && Date.now() - lastOverviewRead < overviewFreshMs)) return;
  const generation = sessionGeneration;
  const versionAtStart = changeVersion;
  const failures = new Set();
  const read = table => financialRows(table, failures);
  const session = (await supabase.auth.getSession()).data.session;
  const userId = session?.user?.id;
  if (!userId) return;
  const [invoices, invoicePayments, agreements, quotes, quoteActivities, bookings, cars, partners, profiles, proposals, blocks] = await Promise.all([
    read("invoices"),
    read("invoice_payments"),
    read("rental_agreements"),
    read("quote_requests"),
    read("quote_activities"),
    read("booking_sales"),
    read("cars"),
    read("car_partners"),
    safeRows(supabase.from("admin_profiles").select("display_name,role").eq("user_id", userId).limit(1)),
    read("quotes"),
    read("vehicle_blocks"),
  ]);
  const expenses = canViewFinancials(profiles[0]?.role) ? await read("vehicle_expenses") : [];
  if (generation !== sessionGeneration) return;
  failedTables = failures;
  activityRead = null;
  ownershipError = ["invoices","invoice_payments","booking_sales","rental_agreements","cars","car_partners","vehicle_expenses"].some(table=>failedTables.has(table)) ? "Financial records unavailable" : "";
  model = { proposals, blocks, expenses, invoices, invoicePayments, agreements, quotes, quoteActivities, bookings, cars, partners, profile: profiles[0] || null, session };
  const ledger = rentalLedger(model);
  cashLedger = ledger.receipts;
  rentalBalances = ledger.balance;
  // Apply the same authoritative receipts and Pacific posting dates to the
  // Overview and the linked vehicle statement. Preserve all reservation costs.
  const manualPaid = new Map(cashLedger.filter(row=>row.booking).map(row=>[row.booking.id,row.amount]));
  statementModel = {...model,
    bookings:bookings.map(row=>({...row,amount_paid:manualPaid.get(row.id)||0})),
    invoices:invoices.map(row=>({...row,paid_at:row.paid_at ? businessDay(row.paid_at) : null,updated_at:row.updated_at ? businessDay(row.updated_at) : null})),
    invoicePayments:invoicePayments.map(row=>({...row,paid_at:businessDay(row.paid_at)})),
  };
  loaded = true;
  lastOverviewRead = versionAtStart === changeVersion ? Date.now() : 0;
  if (!lastOverviewRead && overviewIsVisible()) return readDashboard();
  render();
}

let loadSessionDashboard = singleFlight(readDashboard);
const loadDashboard = (force = false) => loadSessionDashboard(force);

function recordsForRange(range) {
  const agreements = model.agreements.filter((item) => item.status !== "cancelled" && item.signed_at && inRange(item.signed_at, range));
  const manualBookings = model.bookings.filter((item) => {
    const finance = bookingFinance(item);
    return !finance.cancelled && !finance.agreement_id && item.payment_status !== "refunded" && inRange(item.booked_on || item.created_at, range);
  });
  const bookings = [...agreements, ...manualBookings];
  const invoiceById = new Map(model.invoices.map((item) => [String(item.id), item]));
  const receipts = cashLedger.filter(row => inRange(businessDay(row.date),range));
  const invoiceCash = receipts.filter(row => row.invoice_id && !row.legacy);
  const legacyInvoiceCash = receipts.filter(row => row.invoice_id && row.legacy);
  const manualCash = receipts.filter(row => row.booking).map(row=>({...row.booking,amount_paid:row.amount}));
  const revenue = receipts.reduce((sum,row)=>sum+row.amount,0);
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

function delta(current, previous) {
  if (!previous) return "—";
  const value = ((current - previous) / Math.abs(previous)) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function bucketsFor(range) {
  const totalDays = rangeDays(range);
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
    return { label: bucket.label, revenue: data.revenue, profit: data.netProfit, bookings: data.bookings.length };
  });
}

function chartSvg(data, metric) {
  const values = data.map(item=>number(item[metric]));
  const max = Math.max(...values,0), min = Math.min(...values,0);
  const width = 760, height = 220, pad = 24;
  const y = value => height-pad-(value-min)/Math.max(max-min,1)*(height-pad*2);
  const baseline=y(0);
  const points = values.map((value, index) => `${pad + (index * (width - pad * 2)) / Math.max(values.length - 1, 1)},${y(value)}`);
  const area = `${pad},${baseline} ${points.join(" ")} ${width - pad},${baseline}`;
  return `<svg class="executive-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${titleCase(metric)} performance chart"><defs><linearGradient id="dashboardOxblood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b38c52" stop-opacity=".4"/><stop offset="1" stop-color="#b38c52" stop-opacity="0"/></linearGradient></defs><line x1="${pad}" y1="${baseline}" x2="${width-pad}" y2="${baseline}"/><polygon points="${area}" fill="url(#dashboardOxblood)"/><polyline points="${points.join(" ")}"/><g>${points.map((point, index) => { const [x,y]=point.split(","); return `<circle cx="${x}" cy="${y}" r="4"><title>${data[index].label}: ${metric === "bookings" ? values[index] : money(values[index])}</title></circle>`; }).join("")}</g></svg><div class="executive-chart-labels">${data.map((item) => `<span>${escapeHtml(item.label)}</span>`).join("")}</div>`;
}

function emptyPerformance() {
  return `<div class="executive-empty-performance">
    <div class="executive-empty-copy">
      <span>Invoice-first workflow</span>
      <h3>Your command center starts with an invoice.</h3>
      <p>Create the client invoice first. From there, Prestige Luxor routes the rental into the agreement and handoff process.</p>
      <button type="button" class="executive-action-primary" data-dashboard-create="invoice">Create first invoice <span aria-hidden="true">→</span></button>
    </div>
    <ol class="executive-workflow" aria-label="Rental workflow">
      <li><span>01</span><div><strong>Create invoice</strong><small>Client, vehicle, dates, and rate</small></div></li>
      <li><span>02</span><div><strong>Complete agreement</strong><small>Terms, documents, and signature</small></div></li>
      <li><span>03</span><div><strong>Manage rental</strong><small>Pickup, return, and deposit</small></div></li>
    </ol>
  </div>`;
}

function statusForReservation(item, invoice) {
  if (item.status === "vehicle_out") return "Vehicle Out";
  if (!item.license_file_path || !item.insurance_file_path) return "Docs Missing";
  if (["pending", "not_required"].includes(item.deposit_status) && number(item.refundable_deposit)) return "Deposit Pending";
  if (invoice && rentalBalance(invoice) > 0) return "Balance Due";
  if (item.signed_at) return "Ready";
  return "Confirmed";
}

function sourceLabel(source) {
  const map = { "google-ads-landing-page": "Google Ads", instagram: "Instagram", google: "Google Organic", referral: "Referral", phone: "Phone", website: "Website", "wedding-page": "Wedding Page", "fleet-availability": "Exotic Rental Page", manual: "Phone" };
  return map[String(source || "website").toLowerCase()] || titleCase(source || "Other");
}

function render() {
  if (!root || !supabase) return;
  const invoiceById = new Map(model.invoices.map(item=>[String(item.id),item]));
  const attention = buildAttention(invoiceById);
  const view = {model, statementModel, balance:rentalBalances, ledger:cashLedger,
    owner:canViewFinancials(model.profile?.role), error:ownershipError, failedTables,
    attention:groupAttention(attention), carById:new Map(model.cars.map(car=>[String(car.id),car])),
    carByName:vehicleIndex(model.cars), resolveVehicle, sourceLabel, onOpen:openRecord, refresh:()=>loadDashboard(true)};
  if (!overview || renderedRole !== model.profile?.role) {
    root.innerHTML = overviewMarkup(view) + '<details class="desk-reports" data-desk-reports><summary>Rental reports and activity</summary></details>';
    overview = bindOverview(root,view);
    renderedRole = model.profile?.role;
  } else {
    overview.update(view);
  }
  bindOperatingReports(view);
  const disclosure = root.querySelector("[data-desk-reports]");
  const openFinancialReport = !!disclosure.querySelector(".executive-reports")?.open;
  disclosure.querySelector(".desk-report-body")?.remove();
  const showReports = () => {
    if (!disclosure.open || disclosure.querySelector(".desk-report-body")) return;
    renderReports(disclosure,view,invoiceById,attention,openFinancialReport);
  };
  disclosure.ontoggle = showReports;
  showReports();
}

function renderReports(disclosure,view,invoiceById,attention,openFinancialReport) {
  const range = selectedRange(); const current = recordsForRange(range); const previous = recordsForRange(previousRange(range));
  const financeRole = canViewFinancials(model.profile?.role);
  const owner = financeRole && !ownershipError;
  if (!owner && chartMetric !== "bookings") chartMetric = "bookings";
  const today = todayIso();
  const pickups = model.agreements.filter((item) => isoDate(item.rental_start) === today && ["signed", "draft"].includes(item.status));
  const returns = model.agreements.filter((item) => isoDate(item.rental_end) === today && item.status === "vehicle_out");
  const paymentsDue = model.invoices.filter((item) => isoDate(item.due_date) === today && rentalBalance(item) > 0 && item.status !== "void");
  const missingDocs = model.agreements.filter((item) => !["completed", "cancelled"].includes(item.status) && (!item.license_file_path || !item.insurance_file_path));
  const upcoming = model.agreements.filter((item) => isoDate(item.rental_start) >= today && !["completed", "cancelled"].includes(item.status)).sort((a,b) => String(a.rental_start).localeCompare(String(b.rental_start))).slice(0, 8);
  const quotes = model.quotes.filter((item) => inRange(item.created_at, range));
  const pipeline = { new: 0, contacted: 0, sent: 0, followup: 0, booked: 0, lost: 0 };
  quotes.forEach((item) => { if (item.status === "new") pipeline.new++; if (item.status === "checking") pipeline.contacted++; if (["available","alternative","approved"].includes(item.status)) pipeline.sent++; if (item.follow_up_at && new Date(item.follow_up_at) <= new Date() && item.status !== "booked") pipeline.followup++; if (item.status === "booked") pipeline.booked++; });
  const openQuotes = quotes.filter((item) => item.status !== "booked");
  const pipelineValue = openQuotes.reduce((sum,item) => sum + number(item.quote_total), 0);
  const conversion = quotes.length ? (pipeline.booked / quotes.length) * 100 : 0;
  const chart = chartData(range);
  const {carByName,carById} = view;
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
  const receivables = model.invoices.filter(item=>isEarnedInvoice(item) && inRange(invoiceDate(item),range) && rentalBalance(item)>0);
  const overdue = receivables.filter((item)=>item.due_date&&isoDate(item.due_date)<today);
  const pendingDeposits = current.agreements.filter((item)=>item.deposit_status==="pending").reduce((sum,item)=>sum+number(item.refundable_deposit),0);
  const activeRentals = model.agreements.filter((item) => !["completed", "cancelled"].includes(item.status)).length;
  const hasBusinessData = Boolean(model.invoices.length || model.agreements.length || model.quotes.length || model.bookings.length);
  const secondaryAnalytics = hasBusinessData && owner ? `
    <details class="executive-reports"><summary><span><strong>Reports &amp; financials</strong><small>Vehicle performance, revenue, lead sources and balances</small></span><span aria-hidden="true">+</span></summary><div class="executive-report-content">
    <div class="executive-two-column executive-balanced">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Top Performing Vehicles</h3><p>Owned and partner inventory.</p></div>${toggle("vehicle",["revenue","profit","bookings"],vehicleMetric)}</div><div class="vehicle-performance-list">${vehicles.length?vehicles.map((item,index)=>vehicleRow(item,index,carByName,partnerCarIds)).join(""):`<p class="admin-empty">Vehicle performance will appear after agreements are created.</p>`}</div></section>
      <section class="executive-card"><div class="executive-card-head"><div><h3>Financial Breakdown</h3><p>Deposits are excluded from revenue.</p></div></div>${financialBreakdown(current)}</section>
    </div>
    <div class="executive-two-column executive-balanced">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Lead Sources</h3><p>Acquisition performance from existing lead data.</p></div></div>${leadSourceTable([...leadSources.values()])}</section>
      <section class="executive-card money-collect-card"><div class="executive-card-head"><div><h3>Money to Collect</h3><p>Rental receivables and pending deposits.</p></div><strong>${money(current.outstanding+pendingDeposits)}</strong></div><div class="money-summary"><span>Upcoming balances<b>${money(current.outstanding-overdue.reduce((sum,item)=>sum+rentalBalance(item),0))}</b></span><span>Overdue balances<b>${money(overdue.reduce((sum,item)=>sum+rentalBalance(item),0))}</b></span><span>Pending deposits<b>${money(pendingDeposits)}</b></span></div>${collectionList(receivables)}</section>
    </div>
    </div></details>
    <div class="executive-two-column executive-bottom-grid">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Needs Attention <span class="attention-count">${attention.length}</span></h3><p>Resolve outstanding items by rental.</p></div></div><div class="attention-list">${attention.length?groupAttention(attention).slice(0,10).map(attentionRow).join(""):`<p class="admin-empty">No current issues found.</p>`}</div></section>
      <section class="executive-card"><div class="executive-card-head"><div><h3>Recent Activity</h3><p>Latest activity across billing, rentals, and sales.</p></div></div><div class="activity-list" aria-busy="true">Loading activity…</div></section>
    </div>` : hasBusinessData ? `<div class="executive-two-column executive-bottom-grid"><section class="executive-card"><div class="executive-card-head"><div><h3>Needs Attention <span class="attention-count">${attention.length}</span></h3><p>Resolve outstanding items by rental.</p></div></div><div class="attention-list">${attention.length?groupAttention(attention).slice(0,10).map(attentionRow).join(""):`<p class="admin-empty">No current issues found.</p>`}</div></section><section class="executive-card"><div class="executive-card-head"><div><h3>Recent Activity</h3><p>Latest team activity.</p></div></div><div class="activity-list" aria-busy="true">Loading activity…</div></section></div>` : "";

  disclosure.insertAdjacentHTML("beforeend", `
    <div class="desk-report-body"><div class="desk-report-toolbar"><h2>Rental reports</h2>
    <div class="executive-primary-actions">${model.profile?.role==="viewer"?"":`<button type="button" data-dashboard-create="invoice">New invoice</button><button type="button" data-dashboard-create="booking">Add booking</button><button type="button" data-dashboard-create="quote">New quote</button>`}</div>
        <div class="executive-date-control crm-page-actions"><label><span>Date range</span><select data-dashboard-range><option value="today">Today</option><option value="this_week">This Week</option><option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="ytd">YTD</option><option value="custom">Custom</option></select></label><div class="executive-custom-dates" ${rangeKey==="custom"?"":"hidden"}><input type="date" value="${escapeHtml(customStart)}" data-dashboard-start aria-label="Custom start date"><input type="date" value="${escapeHtml(customEnd)}" data-dashboard-end aria-label="Custom end date"></div></div>
    </div>
    <section class="executive-kpis">
      ${owner ? kpi("Revenue collected",money(current.revenue),`${delta(current.revenue,previous.revenue)} vs previous period`,"01",true) : kpi("Bookings",current.bookings.length,"Signed and manually added","01",true)}
      ${kpi("Active Rentals",activeRentals,activeRentals?"Currently in the agreement workflow":"No active rentals","02")}
      ${owner ? kpi("Outstanding",money(current.outstanding),"Rental balance still owed","03") : kpi("Pickups Today",pickups.length,"Scheduled rental starts","03")}
      ${kpi("Open Quotes",openQuotes.length,openQuotes.length?`${pipeline.followup} follow-up${pipeline.followup===1?"":"s"} due`:"No open opportunities","04")}
    </section>
    <section class="executive-section executive-operations"><div class="executive-section-title"><div><span>Live desk</span><h3>Today’s Operations</h3></div><time>${dateLabel(today)}</time></div><div class="operations-strip">${operation("Pickups",pickups.length,"agreements")}${operation("Returns",returns.length,"agreements")}${operation("Payments Due",paymentsDue.length,"invoices")}${operation("Missing Documents",missingDocs.length,"agreements")}</div></section>
    <div class="executive-two-column">
      <section class="executive-card executive-wide"><div class="executive-card-head"><div><h3>Upcoming Reservations</h3><p>Next rentals in the agreement workflow.</p></div><button class="text-button" data-dashboard-section="agreements">View All</button></div>${reservationTable(upcoming,invoiceById)}</section>
      <section class="executive-card"><div class="executive-card-head"><div><h3>Sales Pipeline</h3><p>Active lead movement and value.</p></div><button class="text-button" data-dashboard-section="requests">Open Quotes</button></div><div class="pipeline-grid">${pipelineCell("New Leads",pipeline.new)}${pipelineCell("Contacted",pipeline.contacted)}${pipelineCell("Quotes Sent",pipeline.sent)}${pipelineCell("Follow-Ups Due",pipeline.followup)}${pipelineCell("Booked",pipeline.booked)}${pipelineCell("Lost",pipeline.lost)}</div><div class="pipeline-summary"><span>Lead → Booking Conversion<strong>${conversion.toFixed(1)}%</strong></span><span>Open Pipeline Value<strong>${money(pipelineValue)}</strong></span></div></section>
    </div>
    <section class="executive-card executive-performance ${hasBusinessData?"":"is-empty"}">${hasBusinessData?`<div class="executive-card-head"><div><h3>${owner ? "Performance" : "Booking activity"}</h3><p>${dateLabel(range.start)} – ${dateLabel(range.end)}</p></div>${owner ? toggle("chart",["revenue","profit","bookings"],chartMetric) : ""}</div>${chartSvg(chart,owner ? chartMetric : "bookings")}`:emptyPerformance()}</section>
    ${financeRole ? renderOwnedFleet(statementModel, range, {error:ownershipError,readOnly:model.profile?.role === "viewer"}) : ""}
    ${secondaryAnalytics}</div>`);
  if (openFinancialReport && root.querySelector(".executive-reports")) root.querySelector(".executive-reports").open = true;
  disclosure.querySelector("[data-dashboard-range]").value = rangeKey;
  bindDashboard(disclosure, () => {
    const financialOpen = Boolean(disclosure.querySelector(".executive-reports")?.open);
    disclosure.querySelector(".desk-report-body").remove();
    renderReports(disclosure, view, invoiceById, attention, financialOpen);
  });
  const activityList = disclosure.querySelector(".activity-list");
  if (activityList) {
    const read = reportActivity();
    read.then(items => {
      if (!activityList.isConnected) return;
      activityList.innerHTML = items.length ? items.slice(0,6).map(activityRow).join("") : '<p class="admin-empty">No recent activity.</p>';
      bindDashboard(activityList);
    }).catch(() => {
      if (activityRead === read) activityRead = null;
      activityList.textContent = "Recent activity could not be loaded.";
    }).finally(() => activityList.removeAttribute("aria-busy"));
  }
}

function kpi(label,value,note,index,featured=false){return `<article class="${featured?"featured":""}"><div><span>${escapeHtml(label)}</span><b>${escapeHtml(index)}</b></div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;}
function toggle(group,items,active){return `<div class="executive-toggle" role="group" aria-label="${titleCase(group)} metric">${items.map(item=>`<button type="button" class="${item===active?"active":""}" data-dashboard-toggle="${group}" data-value="${item}">${item==="profit"?"Booking margin":titleCase(item)}</button>`).join("")}</div>`;}
function operation(label,value,section,note=""){return `<button type="button" data-dashboard-section="${section}" class="${value ? "has-items" : "is-clear"}"><span>${escapeHtml(label)}</span><strong>${value}</strong><i aria-hidden="true">↗</i><small>${escapeHtml(note || (value ? "View details" : "Nothing pending"))}</small></button>`;}
function pipelineCell(label,value){return `<button type="button" data-dashboard-section="requests"><span>${label}</span><strong>${value}</strong></button>`;}

function reservationTable(rows,invoiceById){return rows.length?`<div class="executive-table-wrap crm-table-container"><table><thead><tr><th>Customer</th><th>Vehicle</th><th>Start</th><th>End</th><th>Total</th><th>Remaining</th><th>Status</th></tr></thead><tbody>${rows.map(item=>{const invoice=item.source_type==="invoice"?invoiceById.get(String(item.source_id)):null;const status=statusForReservation(item,invoice);return `<tr tabindex="0" role="button" data-dashboard-open="agreement" data-id="${item.id}"><td><strong>${escapeHtml(compactPersonName(item.customer_name))}</strong></td><td>${escapeHtml(compactVehicleName(item.vehicle_name))}</td><td>${dateLabel(item.rental_start)}</td><td>${dateLabel(item.rental_end)}</td><td>${money(invoice?.subtotal||item.rental_total)}</td><td>${money(invoice?rentalBalance(invoice):0)}</td><td><span class="executive-status">${status}</span></td></tr>`;}).join("")}</tbody></table></div>`:`<div class="executive-reservation-empty"><span>Clear road ahead</span><strong>No upcoming rentals.</strong><p>Create an invoice to begin a new client rental.</p><button type="button" data-dashboard-create="invoice">Create invoice <span aria-hidden="true">→</span></button></div>`;}
function vehicleRow(item,index,carByName,partnerCarIds){const car=item.car||resolveVehicle(item.name,carByName);const partner=car&&(car.ownership_type==="partner"||partnerCarIds.has(String(car.id)));return `<article><span class="vehicle-rank">${index+1}</span>${car?.image_url?`<img src="${escapeHtml(car.image_url)}" alt="" loading="lazy" decoding="async">`:`<span class="vehicle-placeholder">PL</span>`}<div><strong>${escapeHtml(compactVehicleName(car?.name||item.name,car))}</strong><small>${partner?"Partner vehicle":car?.ownership_type==="prestige"?"Prestige-owned vehicle":car?"Ownership unconfirmed":"Unassigned vehicle"}</small></div><span><b>${item.bookings}</b><small>Bookings</small></span><span><b>${money(item.revenue)}</b><small>Revenue</small></span><span><b>${money(item.profit)}</b><small>Booking margin</small></span></article>`;}
function financialBreakdown(data){const revenueRows=[["Invoice payments collected",data.invoiceCash.reduce((sum,item)=>sum+number(item.amount),0)+data.legacyInvoiceCash.reduce((sum,item)=>sum+number(item.amount),0)],["Manual booking payments",data.manualCash.reduce((sum,item)=>sum+number(item.amount_paid),0)],["Refundable deposits",0]];const costs=[["Partner vehicle costs",data.costs.partnerPayouts],["Stripe / card fees",data.costs.processingFees],["Delivery costs",data.costs.deliveryCosts],["Detailing",data.costs.detailing],["Other costs",data.costs.other]];return `<div class="financial-columns"><div><h4>Collected revenue</h4>${revenueRows.map(([l,v])=>`<p><span>${l}</span><b>${money(v)}</b></p>`).join("")}</div><div><h4>Recorded costs</h4>${costs.map(([l,v])=>`<p><span>${l}</span><b>${money(v)}</b></p>`).join("")}</div></div><div class="financial-net"><span>Cash after recorded booking costs</span><strong>${money(data.netProfit)}</strong></div>`;}
function leadSourceTable(rows){return rows.length?`<div class="executive-table-wrap crm-table-container"><table><thead><tr><th>Source</th><th>Leads</th><th>Bookings</th><th>Conversion</th><th>Revenue</th></tr></thead><tbody>${rows.sort((a,b)=>b.leads-a.leads).map(row=>`<tr><td><strong>${escapeHtml(row.label)}</strong></td><td>${row.leads}</td><td>${row.bookings}</td><td>${row.leads?((row.bookings/row.leads)*100).toFixed(1):"0.0"}%</td><td>${money(row.revenue)}</td></tr>`).join("")}</tbody></table></div><p class="executive-data-note">Spend and ROAS are hidden because ad-spend data is not stored in the CRM.</p>`:`<p class="admin-empty">Lead sources will appear when quote requests exist.</p>`;}
function collectionList(rows){return rows.length?`<div class="collection-list">${rows.sort((a,b)=>String(a.due_date||"").localeCompare(String(b.due_date||""))).slice(0,6).map(item=>`<button type="button" data-dashboard-open="invoice" data-id="${item.id}"><span><strong>${escapeHtml(compactPersonName(item.customer_name))}</strong><small>${escapeHtml(compactVehicleName(item.vehicle_name))}</small></span><span><b>${money(rentalBalance(item))}</b><small>${item.due_date?dateLabel(item.due_date):"No due date"} · ${item.due_date&&isoDate(item.due_date)<todayIso()?"Overdue":"Upcoming"}</small></span></button>`).join("")}</div>`:`<p class="admin-empty">No rental balances to collect in this period.</p>`;}

function buildAttention(invoiceById){const now=new Date();const items=[];model.agreements.forEach(item=>{if(["completed","cancelled"].includes(item.status))return;if(!item.license_file_path)items.push({priority:2,title:"Missing driver's license",detail:`${item.customer_name} · ${item.vehicle_name}`,kind:"agreement",id:item.id});if(!item.insurance_file_path)items.push({priority:2,title:"Missing insurance",detail:`${item.customer_name} · ${item.vehicle_name}`,kind:"agreement",id:item.id});if(!item.signed_at)items.push({priority:2,title:"Unsigned agreement",detail:`${item.customer_name} · ${dateLabel(item.rental_start)}`,kind:"agreement",id:item.id});if(item.deposit_status==="pending"&&number(item.refundable_deposit))items.push({priority:2,title:"Unpaid deposit",detail:`${item.customer_name} · ${money(item.refundable_deposit)}`,kind:"agreement",id:item.id});if(item.status==="vehicle_out"&&item.rental_end&&new Date(`${item.rental_end}T23:59:59`)<now)items.push({priority:3,title:"Overdue vehicle return",detail:`${item.vehicle_name} · due ${dateLabel(item.rental_end)}`,kind:"agreement",id:item.id});const invoice=item.source_type==="invoice"?invoiceById.get(String(item.source_id)):null;if(invoice&&invoice.due_date&&isoDate(invoice.due_date)<todayIso()&&rentalBalance(invoice)>0)items.push({priority:3,title:"Overdue balance",detail:`${invoice.customer_name} · ${money(rentalBalance(invoice))}`,kind:"invoice",id:invoice.id});});model.quotes.forEach(item=>{if(item.status==="checking")items.push({priority:2,title:"Partner vehicle not confirmed",detail:`${item.name} · ${item.vehicle}`,kind:"quote",id:item.id});if(item.follow_up_at&&new Date(item.follow_up_at)<now&&item.status!=="booked")items.push({priority:2,title:"Overdue follow-up",detail:`${item.name} · ${item.vehicle}`,kind:"quote",id:item.id});});return items.sort((a,b)=>b.priority-a.priority);}
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
  return `<button type="button" data-dashboard-open="${item.kind}" data-id="${item.id}"><i class="priority-${item.priority}" aria-hidden="true">!</i><span><strong>${escapeHtml(compactPersonName(name))}</strong><small>${escapeHtml(compactVehicleName(vehicle))}</small><span class="attention-issues">${item.issues.map(issue=>`<span>${escapeHtml(issue.title)}${issue.title === "Unpaid deposit" ? ` · ${money(record?.refundable_deposit)}` : ""}</span>`).join("")}</span></span><b>Review <span aria-hidden="true">↗</span></b></button>`;
}
function reportActivity() {
  if (!activityRead) {
    const recent = table => supabase.from(table).select("*").order("created_at", {ascending:false}).limit(100);
    const leads = model.quoteActivities;
    activityRead = Promise.all([recent("invoice_events"), recent("rental_agreement_events")]).then(([invoices, agreements]) => {
      if (invoices.error || agreements.error) throw new Error("Activity unavailable");
      return [
        ...invoices.data.map(item => ({date:item.created_at, title:titleCase(item.event_type), detail:item.detail||"Invoice updated", kind:"invoice", id:item.invoice_id})),
        ...agreements.data.map(item => ({date:item.created_at, title:titleCase(item.event_type), detail:item.detail||"Rental updated", kind:"agreement", id:item.agreement_id})),
        ...leads.map(item => ({date:item.created_at, title:titleCase(item.activity_type), detail:item.body||"Quote updated", kind:"quote", id:item.quote_request_id})),
      ].sort((a,b) => String(b.date).localeCompare(String(a.date)));
    });
  }
  return activityRead;
}

function activityRow(item){return `<button type="button" data-dashboard-open="${item.kind}" data-id="${item.id}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><time datetime="${escapeHtml(item.date)}">${new Date(item.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</time></button>`;}

function bindDashboard(scope, updateReport){
  scope.querySelectorAll("[data-owned-refresh]:not(.desk-overview *)").forEach(button=>button.addEventListener("click",()=>loadDashboard(true)));
  scope.querySelectorAll("[data-owned-vehicle],[data-owned-expense]").forEach(button=>button.addEventListener("click",()=>{
    if(!button.dataset.ownedExpense)document.querySelector('[data-crm-section="vehicles"]')?.click();
    window.dispatchEvent(new CustomEvent("prestige:owned-vehicle",{detail:{id:button.dataset.ownedVehicle||button.dataset.ownedExpense,expense:!!button.dataset.ownedExpense,category:button.dataset.ownedCategory}}));
  }));
  scope.querySelector("[data-dashboard-range]")?.addEventListener("change",(event)=>{rangeKey=event.target.value;if(rangeKey==="custom"&&!customStart){customStart=todayIso();customEnd=todayIso();}updateReport();});
  scope.querySelector("[data-dashboard-start]")?.addEventListener("change",(event)=>{customStart=event.target.value;if(customStart>customEnd)customEnd=customStart;if(customStart&&customEnd)updateReport();});
  scope.querySelector("[data-dashboard-end]")?.addEventListener("change",(event)=>{customEnd=event.target.value;if(customEnd && customEnd<customStart)customStart=customEnd;if(customStart&&customEnd)updateReport();});
  scope.querySelectorAll("[data-dashboard-toggle]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.dashboardToggle==="chart")chartMetric=button.dataset.value;else vehicleMetric=button.dataset.value;updateReport();}));
  scope.querySelectorAll("[data-dashboard-section]").forEach(button=>button.addEventListener("click",()=>document.querySelector(`[data-crm-section="${button.dataset.dashboardSection}"]`)?.click()));
  scope.querySelectorAll("[data-dashboard-create]").forEach(button=>button.addEventListener("click",()=>{
    const type=button.dataset.dashboardCreate;
    const section=type==="invoice"?"invoices":type==="quote"?"requests":type==="booking"?"bookings":"vehicles";
    const trigger=type==="invoice"?"[data-new-invoice]":type==="quote"?"[data-new-quote]":type==="booking"?"[data-new-booking]":"[data-new-car]";
    document.querySelector(`[data-crm-section="${section}"]`)?.click();
    document.querySelector(trigger)?.click();
  }));
  scope.querySelectorAll("[data-dashboard-open]:not([data-desk-record])").forEach(button=>{const open=()=>openRecord(button.dataset.dashboardOpen,button.dataset.id);button.addEventListener("click",open);button.addEventListener("keydown",event=>{if(["Enter"," "].includes(event.key)){event.preventDefault();open();}});});
}

function openRecord(kind,id) {
  if (kind === "quote") {
    root.querySelector('.desk-overview')?.dispatchEvent(new CustomEvent('desk:open-lead',{detail:{id}}));
    return;
  }
  const section = {invoice:"invoices",agreement:"agreements",proposal:"requests",vehicle:"vehicles",booking:"bookings"}[kind];
  const event = {invoice:"open-invoice",agreement:"open-agreement",proposal:"open-quote",vehicle:"open-fleet-vehicle",booking:"open-booking"}[kind];
  if (!section) return;
  document.querySelector(`[data-crm-section="${section}"]`)?.click();
  const records = kind === "invoice" ? model.invoices : kind === "agreement" ? model.agreements : [];
  const record = records.find(item => String(item.id) === String(id));
  window.dispatchEvent(new CustomEvent("prestige:"+event,{detail:{id,kind:"manual",record}}));
}

function refreshFinancialWrites() {
  ++financeVersion;
  if (financeRefresh) return financeRefresh;
  const generation = sessionGeneration;
  financeRefresh = Promise.resolve().then(async () => {
    let readVersion;
    do {
      readVersion = financeVersion;
      await loadDashboard(true);
    } while (generation === sessionGeneration && readVersion !== financeVersion);
  }).finally(() => { financeRefresh = null; });
  return financeRefresh;
}

export async function getOwnedFleetSource(force = false) {
  if (financeRefresh) await financeRefresh;
  else await loadDashboard(force);
  return {model:statementModel || model,error:ownershipError};
}

overviewButton?.addEventListener("click", () => loadDashboard());
window.addEventListener("prestige:finance-updated",refreshFinancialWrites);
window.addEventListener("prestige:overview-changed", () => {
  changeVersion++;
  lastOverviewRead = 0;
  if (overviewIsVisible()) loadDashboard();
});
function overviewIsVisible() {
  return !document.querySelector("[data-admin-view]")?.hidden && root?.closest("[data-section-panel]")?.classList.contains("active");
}
window.addEventListener("prestige:desk-page", ({detail}) => overview?.setActive(detail.section === "overview"));
supabase?.auth.onAuthStateChange((event, session) => {
  if (session) {
    if (overviewIsVisible()) loadDashboard();
    return;
  }
  sessionGeneration++;
  loaded = false;
  lastOverviewRead = 0;
  loadSessionDashboard = singleFlight(readDashboard);
  overview = renderedRole = statementModel = activityRead = null;
  cashLedger = [];
  rentalBalances = 0;
  root?.replaceChildren();
  const reports = document.querySelector(".desk-operating-reports");
  if (reports) {
    reports.open = false;
    reports.ontoggle = reports.onclick = null;
    reports.querySelector("[data-desk-operating-content]")?.replaceChildren();
  }
  window.dispatchEvent(new CustomEvent("prestige:overview-leads",{detail:{count:null}}));
  model = {invoices:[],invoicePayments:[],agreements:[],quotes:[],quoteActivities:[],bookings:[],cars:[],partners:[],profile:null};
});
if (overviewIsVisible()) loadDashboard();
registerSection("overview", loadDashboard);
