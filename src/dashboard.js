const root = document.querySelector("[data-executive-dashboard]");
const overviewButton = document.querySelector('[data-crm-section="overview"]');
const supabase = window.prestigeLuxorSupabase;

let loaded = false;
let model = { invoices: [], agreements: [], quotes: [], quoteActivities: [], invoiceEvents: [], agreementEvents: [], bookings: [], cars: [], partners: [], profile: null };
let rangeKey = "this_month";
let chartMetric = "revenue";
let vehicleMetric = "revenue";
let customStart = "";
let customEnd = "";

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
const number = (value) => Number(value || 0);
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const isoDate = (value) => String(value || "").slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);
const titleCase = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function previousRange(range) {
  const days = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1);
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
function invoiceGross(invoice) {
  return number(invoice.daily_rate) * Math.max(number(invoice.rental_days), 1) + number(invoice.delivery_fee) + number(invoice.addons_total) + number(invoice.insurance_fee) + number(invoice.mileage_fee) + number(invoice.fuel_fee) + number(invoice.tolls_fee) + number(invoice.damage_fee) + number(invoice.other_fee);
}
function invoiceRevenue(invoice) { return Math.max(invoiceGross(invoice) - number(invoice.discount), 0); }
function rentalBalance(invoice) { return Math.max(number(invoice.subtotal) - Math.min(number(invoice.amount_paid), number(invoice.subtotal)), 0); }
function isEarnedInvoice(invoice) { return !["draft", "void", "refunded"].includes(invoice.status); }

async function safeRows(query) {
  try { const { data, error } = await query; return error ? [] : data || []; } catch { return []; }
}

async function loadDashboard(force = false) {
  if (!root || !supabase || (loaded && !force)) return render();
  root.innerHTML = `<div class="executive-dashboard-loading crm-loading-state">Loading your command center…</div>`;
  const session = (await supabase.auth.getSession()).data.session;
  const userId = session?.user?.id;
  const [invoices, agreements, quotes, quoteActivities, invoiceEvents, agreementEvents, bookings, cars, partners, profiles] = await Promise.all([
    safeRows(supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(500)),
    safeRows(supabase.from("rental_agreements").select("*").order("created_at", { ascending: false }).limit(500)),
    safeRows(supabase.from("quote_requests").select("*").order("created_at", { ascending: false }).limit(500)),
    safeRows(supabase.from("quote_activities").select("*").order("created_at", { ascending: false }).limit(100)),
    safeRows(supabase.from("invoice_events").select("*").order("created_at", { ascending: false }).limit(100)),
    safeRows(supabase.from("rental_agreement_events").select("*").order("created_at", { ascending: false }).limit(100)),
    safeRows(supabase.from("booking_sales").select("*").order("created_at", { ascending: false }).limit(500)),
    safeRows(supabase.from("cars").select("id,name,image_url,price,is_active").order("name")),
    safeRows(supabase.from("car_partners").select("car_id,partner_name")),
    userId ? safeRows(supabase.from("admin_profiles").select("display_name,role").eq("user_id", userId).limit(1)) : [],
  ]);
  model = { invoices, agreements, quotes, quoteActivities, invoiceEvents, agreementEvents, bookings, cars, partners, profile: profiles[0] || null, session };
  loaded = true;
  render();
}

function recordsForRange(range) {
  const agreements = model.agreements.filter((item) => inRange(agreementDate(item), range) && item.status !== "cancelled");
  const agreementInvoiceIds = new Set(agreements.filter((item) => item.source_type === "invoice").map((item) => String(item.source_id)));
  const invoices = model.invoices.filter((item) => inRange(invoiceDate(item), range) && item.status !== "void");
  const bookings = agreements.length ? agreements : invoices.filter((item) => !agreementInvoiceIds.has(String(item.id)));
  const earned = invoices.filter(isEarnedInvoice);
  const gross = earned.reduce((sum, item) => sum + invoiceGross(item), 0);
  const discounts = earned.reduce((sum, item) => sum + number(item.discount), 0);
  const revenue = Math.max(gross - discounts, 0);
  const quoteIds = new Set(invoices.filter((item) => item.source_type === "quote").map((item) => String(item.source_id)));
  const partnerCosts = model.bookings.filter((item) => inRange(item.start_date || item.booked_on, range) && (!quoteIds.size || quoteIds.has(String(item.quote_request_id)))).reduce((sum, item) => sum + number(item.partner_cost), 0);
  const costs = { discounts, refunds: 0, partnerPayouts: partnerCosts, processingFees: 0, deliveryCosts: 0, detailing: 0, fuel: 0, other: 0 };
  const totalCosts = Object.values(costs).reduce((sum, value) => sum + value, 0);
  const netProfit = gross - totalCosts;
  const completed = bookings.filter((item) => ["completed", "returned", "paid"].includes(item.status)).length;
  const upcoming = bookings.filter((item) => isoDate(item.rental_start || item.issue_date) >= todayIso() && !["completed", "cancelled", "void"].includes(item.status)).length;
  const outstanding = invoices.reduce((sum, item) => sum + rentalBalance(item), 0);
  const depositsHeld = agreements.filter((item) => ["held", "charged"].includes(item.deposit_status) && !["completed", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Math.max(number(item.refundable_deposit) - number(item.deposit_deduction), 0), 0);
  return { agreements, invoices, bookings, earned, gross, revenue, costs, netProfit, completed, upcoming, outstanding, depositsHeld };
}

function delta(current, previous) {
  if (!previous) return current ? "+100%" : "—";
  const value = ((current - previous) / Math.abs(previous)) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function bucketsFor(range) {
  const totalDays = Math.round((range.end - range.start) / 86400000) + 1;
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
  const values = data.map((item) => Math.max(number(item[metric]), 0));
  const max = Math.max(...values, 1); const width = 760; const height = 220; const pad = 24;
  const points = values.map((value, index) => `${pad + (index * (width - pad * 2)) / Math.max(values.length - 1, 1)},${height - pad - (value / max) * (height - pad * 2)}`);
  const area = `${pad},${height - pad} ${points.join(" ")} ${width - pad},${height - pad}`;
  return `<svg class="executive-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${titleCase(metric)} performance chart"><defs><linearGradient id="dashboardGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7b46a" stop-opacity=".42"/><stop offset="1" stop-color="#d7b46a" stop-opacity="0"/></linearGradient></defs><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}"/><polygon points="${area}" fill="url(#dashboardGold)"/><polyline points="${points.join(" ")}"/><g>${points.map((point, index) => { const [x,y]=point.split(","); return `<circle cx="${x}" cy="${y}" r="4"><title>${data[index].label}: ${metric === "bookings" ? values[index] : money(values[index])}</title></circle>`; }).join("")}</g></svg><div class="executive-chart-labels">${data.map((item) => `<span>${escapeHtml(item.label)}</span>`).join("")}</div>`;
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
  if (!root) return;
  if (!supabase) { root.innerHTML = `<div class="executive-dashboard-loading crm-loading-state">Connect Supabase to load the dashboard.</div>`; return; }
  const range = selectedRange(); const current = recordsForRange(range); const previous = recordsForRange(previousRange(range));
  const today = todayIso();
  const pickups = model.agreements.filter((item) => isoDate(item.rental_start) === today && ["signed", "draft"].includes(item.status));
  const returns = model.agreements.filter((item) => isoDate(item.rental_end) === today && item.status === "vehicle_out");
  const paymentsDue = model.invoices.filter((item) => isoDate(item.due_date) === today && rentalBalance(item) > 0 && item.status !== "void");
  const missingDocs = model.agreements.filter((item) => !["completed", "cancelled"].includes(item.status) && (!item.license_file_path || !item.insurance_file_path));
  const invoiceById = new Map(model.invoices.map((item) => [String(item.id), item]));
  const upcoming = model.agreements.filter((item) => isoDate(item.rental_start) >= today && !["completed", "cancelled"].includes(item.status)).sort((a,b) => String(a.rental_start).localeCompare(String(b.rental_start))).slice(0, 8);
  const quotes = model.quotes.filter((item) => inRange(item.created_at, range));
  const pipeline = { new: 0, contacted: 0, sent: 0, followup: 0, booked: 0, lost: 0 };
  quotes.forEach((item) => { if (item.status === "new") pipeline.new++; if (item.status === "checking") pipeline.contacted++; if (["available","alternative","approved"].includes(item.status)) pipeline.sent++; if (item.follow_up_at && new Date(item.follow_up_at) <= new Date() && item.status !== "booked") pipeline.followup++; if (item.status === "booked") pipeline.booked++; });
  const openQuotes = quotes.filter((item) => item.status !== "booked");
  const pipelineValue = openQuotes.reduce((sum,item) => sum + number(item.quote_total), 0);
  const conversion = quotes.length ? (pipeline.booked / quotes.length) * 100 : 0;
  const chart = chartData(range);
  const carByName = new Map(model.cars.map((car) => [String(car.name).toLowerCase(), car]));
  const partnerCarIds = new Set(model.partners.map((item) => String(item.car_id)));
  const vehicleMap = new Map();
  current.bookings.forEach((item) => { const name = item.vehicle_name || item.vehicle || "Vehicle TBD"; const invoice = item.source_type === "invoice" ? invoiceById.get(String(item.source_id)) : current.invoices.find((row) => row.vehicle_name === name); const row = vehicleMap.get(name) || { name, bookings: 0, revenue: 0, profit: 0 }; const revenue = invoice ? invoiceRevenue(invoice) : number(item.rental_total || item.total_amount); row.bookings++; row.revenue += revenue; row.profit += revenue; vehicleMap.set(name,row); });
  model.bookings.filter((item) => inRange(item.start_date || item.booked_on, range)).forEach((item) => { const row = vehicleMap.get(item.vehicle); if (row) row.profit -= number(item.partner_cost); });
  const vehicles = [...vehicleMap.values()].sort((a,b) => number(b[vehicleMetric])-number(a[vehicleMetric])).slice(0,5);
  const leadSources = new Map();
  quotes.forEach((quote) => { const label=sourceLabel(quote.source); const row=leadSources.get(label)||{label,leads:0,bookings:0,revenue:0}; row.leads++; if(quote.status==="booked")row.bookings++; const invoice=model.invoices.find(item=>item.source_type==="quote"&&String(item.source_id)===String(quote.id)); if(invoice)row.revenue+=invoiceRevenue(invoice); leadSources.set(label,row); });
  const receivables = current.invoices.filter((item)=>rentalBalance(item)>0);
  const overdue = receivables.filter((item)=>item.due_date&&isoDate(item.due_date)<today);
  const pendingDeposits = current.agreements.filter((item)=>item.deposit_status==="pending").reduce((sum,item)=>sum+number(item.refundable_deposit),0);
  const attention = buildAttention(invoiceById);
  const activity = buildActivity();
  const rawName = model.profile?.display_name || model.session?.user?.user_metadata?.full_name || model.session?.user?.email?.split("@")[0] || "there";
  const normalizedName = String(rawName).split("@")[0].replace(/\d+$/g, "");
  const displayName = /^khaled/i.test(normalizedName) ? "Khaled" : normalizedName.split(/[._-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

  root.innerHTML = `
    <header class="executive-head crm-page-header"><div><p class="eyebrow">Executive command center</p><h2>Good ${new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}, ${escapeHtml(displayName)}</h2><p>Here’s what’s happening at Prestige Luxor.</p></div><div class="executive-date-control crm-page-actions"><label><span>Date range</span><select data-dashboard-range><option value="today">Today</option><option value="this_week">This Week</option><option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="ytd">YTD</option><option value="custom">Custom</option></select></label><div class="executive-custom-dates" ${rangeKey==="custom"?"":"hidden"}><input type="date" value="${escapeHtml(customStart)}" data-dashboard-start aria-label="Custom start date"><input type="date" value="${escapeHtml(customEnd)}" data-dashboard-end aria-label="Custom end date"></div></div></header>
    <section class="executive-kpis">
      ${kpi("Revenue",money(current.revenue),`${delta(current.revenue,previous.revenue)} vs previous period`)}
      ${kpi("Net Profit",money(current.netProfit),"Revenue minus recorded costs")}
      ${kpi("Bookings",current.bookings.length,`${current.completed} completed · ${current.upcoming} upcoming`)}
      ${kpi("Average Booking Value",money(current.bookings.length?current.revenue/current.bookings.length:0),"Revenue ÷ bookings")}
      ${kpi("Outstanding Balance",money(current.outstanding),"Rental money still owed")}
      ${kpi("Deposits Held",money(current.depositsHeld),"Refundable · excluded from revenue")}
    </section>
    <section class="executive-card executive-performance"><div class="executive-card-head"><div><h3>Performance</h3><p>${dateLabel(range.start)} – ${dateLabel(range.end)}</p></div>${toggle("chart",["revenue","profit","bookings"],chartMetric)}</div>${chartSvg(chart,chartMetric)}</section>
    <section class="executive-section"><div class="executive-section-title"><h3>Today’s Operations</h3><span>${dateLabel(today)}</span></div><div class="operations-strip">${operation("Pickups Today",pickups.length,"agreements")}${operation("Returns Today",returns.length,"agreements")}${operation("Deliveries Today",0,"agreements","No delivery schedule field yet")}${operation("Payments Due",paymentsDue.length,"invoices")}${operation("Missing Documents",missingDocs.length,"agreements")}</div></section>
    <div class="executive-two-column">
      <section class="executive-card executive-wide"><div class="executive-card-head"><div><h3>Upcoming Reservations</h3><p>Next rentals in the agreement workflow.</p></div><button class="text-button" data-dashboard-section="agreements">View All</button></div>${reservationTable(upcoming,invoiceById)}</section>
      <section class="executive-card"><div class="executive-card-head"><div><h3>Sales Pipeline</h3><p>Active lead movement and value.</p></div><button class="text-button" data-dashboard-section="requests">Open Quotes</button></div><div class="pipeline-grid">${pipelineCell("New Leads",pipeline.new)}${pipelineCell("Contacted",pipeline.contacted)}${pipelineCell("Quotes Sent",pipeline.sent)}${pipelineCell("Follow-Ups Due",pipeline.followup)}${pipelineCell("Booked",pipeline.booked)}${pipelineCell("Lost",pipeline.lost)}</div><div class="pipeline-summary"><span>Lead → Booking Conversion<strong>${conversion.toFixed(1)}%</strong></span><span>Open Pipeline Value<strong>${money(pipelineValue)}</strong></span></div></section>
    </div>
    <div class="executive-two-column executive-balanced">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Top Performing Vehicles</h3><p>Owned and partner inventory.</p></div>${toggle("vehicle",["revenue","profit","bookings"],vehicleMetric)}</div><div class="vehicle-performance-list">${vehicles.length?vehicles.map((item,index)=>vehicleRow(item,index,carByName,partnerCarIds)).join(""):`<p class="admin-empty">Vehicle performance will appear after agreements are created.</p>`}</div></section>
      <section class="executive-card"><div class="executive-card-head"><div><h3>Financial Breakdown</h3><p>Deposits are excluded from revenue.</p></div></div>${financialBreakdown(current)}</section>
    </div>
    <div class="executive-two-column executive-balanced">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Lead Sources</h3><p>Acquisition performance from existing lead data.</p></div></div>${leadSourceTable([...leadSources.values()])}</section>
      <section class="executive-card money-collect-card"><div class="executive-card-head"><div><h3>Money to Collect</h3><p>Rental receivables and pending deposits.</p></div><strong>${money(current.outstanding+pendingDeposits)}</strong></div><div class="money-summary"><span>Upcoming balances<b>${money(current.outstanding-overdue.reduce((sum,item)=>sum+rentalBalance(item),0))}</b></span><span>Overdue balances<b>${money(overdue.reduce((sum,item)=>sum+rentalBalance(item),0))}</b></span><span>Pending deposits<b>${money(pendingDeposits)}</b></span></div>${collectionList(receivables)}</section>
    </div>
    <div class="executive-two-column executive-bottom-grid">
      <section class="executive-card"><div class="executive-card-head"><div><h3>Needs Attention</h3><p>Urgent operational risks first.</p></div></div><div class="attention-list">${attention.length?attention.slice(0,10).map(attentionRow).join(""):`<p class="admin-empty">No current issues found.</p>`}</div></section>
      <section class="executive-card"><div class="executive-card-head"><div><h3>Recent Activity</h3><p>Latest activity across billing, rentals, and sales.</p></div></div><div class="activity-list">${activity.length?activity.slice(0,10).map(activityRow).join(""):`<p class="admin-empty">Activity will appear as your team works in the CRM.</p>`}</div></section>
    </div>`;
  root.querySelector("[data-dashboard-range]").value = rangeKey;
  bindDashboard();
}

function kpi(label,value,note){return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;}
function toggle(group,items,active){return `<div class="executive-toggle" role="group" aria-label="${titleCase(group)} metric">${items.map(item=>`<button type="button" class="${item===active?"active":""}" data-dashboard-toggle="${group}" data-value="${item}">${titleCase(item)}</button>`).join("")}</div>`;}
function operation(label,value,section,note=""){return `<button type="button" data-dashboard-section="${section}" title="${escapeHtml(note)}"><strong>${value}</strong><span>${escapeHtml(label)}</span>${note?`<small>${escapeHtml(note)}</small>`:""}</button>`;}
function pipelineCell(label,value){return `<button type="button" data-dashboard-section="requests"><span>${label}</span><strong>${value}</strong></button>`;}

function reservationTable(rows,invoiceById){return rows.length?`<div class="executive-table-wrap crm-table-container"><table><thead><tr><th>Customer</th><th>Vehicle</th><th>Start</th><th>End</th><th>Total</th><th>Remaining</th><th>Status</th></tr></thead><tbody>${rows.map(item=>{const invoice=item.source_type==="invoice"?invoiceById.get(String(item.source_id)):null;const status=statusForReservation(item,invoice);return `<tr tabindex="0" role="button" data-dashboard-open="agreement" data-id="${item.id}"><td><strong>${escapeHtml(item.customer_name)}</strong></td><td>${escapeHtml(item.vehicle_name)}</td><td>${dateLabel(item.rental_start)}</td><td>${dateLabel(item.rental_end)}</td><td>${money(invoice?.subtotal||item.rental_total)}</td><td>${money(invoice?rentalBalance(invoice):0)}</td><td><span class="executive-status">${status}</span></td></tr>`;}).join("")}</tbody></table></div>`:`<p class="admin-empty">No upcoming agreements yet. Start with an invoice and continue to agreement.</p>`;}
function vehicleRow(item,index,carByName,partnerCarIds){const car=carByName.get(item.name.toLowerCase());const partner=car&&partnerCarIds.has(String(car.id));return `<article><span class="vehicle-rank">${index+1}</span>${car?.image_url?`<img src="${escapeHtml(car.image_url)}" alt="" loading="lazy">`:`<span class="vehicle-placeholder">PL</span>`}<div><strong>${escapeHtml(item.name)}</strong><small>${partner?"Partner vehicle":"Prestige-owned or unassigned"}</small></div><span><b>${item.bookings}</b><small>Bookings</small></span><span><b>${money(item.revenue)}</b><small>Revenue</small></span><span><b>${money(item.profit)}</b><small>Profit</small></span></article>`;}
function financialBreakdown(data){const revenueRows=[["Rental Revenue",data.earned.reduce((s,i)=>s+number(i.daily_rate)*Math.max(number(i.rental_days),1),0)],["Delivery Fees",data.earned.reduce((s,i)=>s+number(i.delivery_fee),0)],["Mileage Charges",data.earned.reduce((s,i)=>s+number(i.mileage_fee),0)],["Late Fees",0],["Other Revenue",data.earned.reduce((s,i)=>s+number(i.addons_total)+number(i.insurance_fee)+number(i.fuel_fee)+number(i.tolls_fee)+number(i.damage_fee)+number(i.other_fee),0)]];const costs=[["Discounts",data.costs.discounts],["Refunds",data.costs.refunds],["Partner Payouts",data.costs.partnerPayouts],["Processing Fees",0],["Delivery Costs",0],["Detailing",0],["Fuel",0],["Other Expenses",0]];return `<div class="financial-columns"><div><h4>Revenue</h4>${revenueRows.map(([l,v])=>`<p><span>${l}</span><b>${money(v)}</b></p>`).join("")}</div><div><h4>Costs & deductions</h4>${costs.map(([l,v])=>`<p><span>${l}</span><b>${money(v)}</b></p>`).join("")}</div></div><div class="financial-net"><span>Net Profit</span><strong>${money(data.netProfit)}</strong></div>`;}
function leadSourceTable(rows){return rows.length?`<div class="executive-table-wrap crm-table-container"><table><thead><tr><th>Source</th><th>Leads</th><th>Bookings</th><th>Conversion</th><th>Revenue</th></tr></thead><tbody>${rows.sort((a,b)=>b.leads-a.leads).map(row=>`<tr><td><strong>${escapeHtml(row.label)}</strong></td><td>${row.leads}</td><td>${row.bookings}</td><td>${row.leads?((row.bookings/row.leads)*100).toFixed(1):"0.0"}%</td><td>${money(row.revenue)}</td></tr>`).join("")}</tbody></table></div><p class="executive-data-note">Spend and ROAS are hidden because ad-spend data is not stored in the CRM.</p>`:`<p class="admin-empty">Lead sources will appear when quote requests exist.</p>`;}
function collectionList(rows){return rows.length?`<div class="collection-list">${rows.sort((a,b)=>String(a.due_date||"").localeCompare(String(b.due_date||""))).slice(0,6).map(item=>`<button type="button" data-dashboard-open="invoice" data-id="${item.id}"><span><strong>${escapeHtml(item.customer_name)}</strong><small>${escapeHtml(item.vehicle_name)}</small></span><span><b>${money(rentalBalance(item))}</b><small>${item.due_date?dateLabel(item.due_date):"No due date"} · ${item.due_date&&isoDate(item.due_date)<todayIso()?"Overdue":"Upcoming"}</small></span></button>`).join("")}</div>`:`<p class="admin-empty">No rental balances to collect in this period.</p>`;}

function buildAttention(invoiceById){const now=new Date();const items=[];model.agreements.forEach(item=>{if(["completed","cancelled"].includes(item.status))return;if(!item.license_file_path)items.push({priority:2,title:"Missing driver's license",detail:`${item.customer_name} · ${item.vehicle_name}`,kind:"agreement",id:item.id});if(!item.insurance_file_path)items.push({priority:2,title:"Missing insurance",detail:`${item.customer_name} · ${item.vehicle_name}`,kind:"agreement",id:item.id});if(!item.signed_at)items.push({priority:2,title:"Unsigned agreement",detail:`${item.customer_name} · ${dateLabel(item.rental_start)}`,kind:"agreement",id:item.id});if(item.deposit_status==="pending"&&number(item.refundable_deposit))items.push({priority:2,title:"Unpaid deposit",detail:`${item.customer_name} · ${money(item.refundable_deposit)}`,kind:"agreement",id:item.id});if(item.status==="vehicle_out"&&item.rental_end&&new Date(`${item.rental_end}T23:59:59`)<now)items.push({priority:3,title:"Overdue vehicle return",detail:`${item.vehicle_name} · due ${dateLabel(item.rental_end)}`,kind:"agreement",id:item.id});const invoice=item.source_type==="invoice"?invoiceById.get(String(item.source_id)):null;if(invoice&&invoice.due_date&&isoDate(invoice.due_date)<todayIso()&&rentalBalance(invoice)>0)items.push({priority:3,title:"Overdue balance",detail:`${invoice.customer_name} · ${money(rentalBalance(invoice))}`,kind:"invoice",id:invoice.id});});model.quotes.forEach(item=>{if(item.status==="checking")items.push({priority:2,title:"Partner vehicle not confirmed",detail:`${item.name} · ${item.vehicle}`,kind:"quote",id:item.id});if(item.follow_up_at&&new Date(item.follow_up_at)<now&&item.status!=="booked")items.push({priority:2,title:"Overdue follow-up",detail:`${item.name} · ${item.vehicle}`,kind:"quote",id:item.id});});return items.sort((a,b)=>b.priority-a.priority);}
function attentionRow(item){return `<button type="button" data-dashboard-open="${item.kind}" data-id="${item.id}"><i class="priority-${item.priority}"></i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><b>Open</b></button>`;}
function buildActivity(){const invoice=model.invoiceEvents.map(item=>({date:item.created_at,title:titleCase(item.event_type),detail:item.detail||"Invoice updated",kind:"invoice",id:item.invoice_id}));const agreements=model.agreementEvents.map(item=>({date:item.created_at,title:titleCase(item.event_type),detail:item.detail||"Rental updated",kind:"agreement",id:item.agreement_id}));const quotes=model.quoteActivities.map(item=>({date:item.created_at,title:titleCase(item.activity_type),detail:item.body||"Quote updated",kind:"quote",id:item.quote_request_id}));return [...invoice,...agreements,...quotes].sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
function activityRow(item){return `<button type="button" data-dashboard-open="${item.kind}" data-id="${item.id}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><time>${new Date(item.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</time></button>`;}

function bindDashboard(){
  root.querySelector("[data-dashboard-range]")?.addEventListener("change",(event)=>{rangeKey=event.target.value;if(rangeKey==="custom"&&!customStart){customStart=todayIso();customEnd=todayIso();}render();});
  root.querySelector("[data-dashboard-start]")?.addEventListener("change",(event)=>{customStart=event.target.value;if(customStart&&customEnd)render();});
  root.querySelector("[data-dashboard-end]")?.addEventListener("change",(event)=>{customEnd=event.target.value;if(customStart&&customEnd)render();});
  root.querySelectorAll("[data-dashboard-toggle]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.dashboardToggle==="chart")chartMetric=button.dataset.value;else vehicleMetric=button.dataset.value;render();}));
  root.querySelectorAll("[data-dashboard-section]").forEach(button=>button.addEventListener("click",()=>document.querySelector(`[data-crm-section="${button.dataset.dashboardSection}"]`)?.click()));
  root.querySelectorAll("[data-dashboard-open]").forEach(button=>{const open=()=>openRecord(button.dataset.dashboardOpen,button.dataset.id);button.addEventListener("click",open);button.addEventListener("keydown",event=>{if(["Enter"," "].includes(event.key)){event.preventDefault();open();}});});
}

function openRecord(kind,id){const section=kind==="invoice"?"invoices":kind==="agreement"?"agreements":"requests";document.querySelector(`[data-crm-section="${section}"]`)?.click();if(kind==="invoice")window.dispatchEvent(new CustomEvent("prestige:open-invoice",{detail:{id}}));else if(kind==="agreement")window.dispatchEvent(new CustomEvent("prestige:open-agreement",{detail:{id}}));else{setTimeout(()=>document.querySelector(`[data-select-request="${CSS.escape(id)}"]`)?.click(),250);}}

overviewButton?.addEventListener("click",()=>loadDashboard());
supabase?.auth.onAuthStateChange((event,session)=>{if(!session){loaded=false;model={invoices:[],agreements:[],quotes:[],quoteActivities:[],invoiceEvents:[],agreementEvents:[],bookings:[],cars:[],partners:[],profile:null};}else if(document.querySelector('[data-section-panel="overview"]')?.classList.contains("active"))loadDashboard();});
if (!document.querySelector("[data-admin-view]")?.hidden) loadDashboard();
setTimeout(() => { if (!document.querySelector("[data-admin-view]")?.hidden && !loaded) loadDashboard(); }, 900);
