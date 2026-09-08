const app = document.querySelector("[data-booking-app]");
const sectionButton = document.querySelector('[data-crm-section="bookings"]');
const newButton = document.querySelector("[data-new-booking]");
const supabase = window.prestigeLuxorSupabase;

let loaded = false;
let loading = false;
let agreements = [];
let ledgerRows = [];
let cars = [];
let profile = null;
let selectedKey = "";
let searchTerm = "";

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const iso = (value) => String(value || "").slice(0, 10);
const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const number = (value) => Math.max(0, Number(value || 0));
const isOwner = () => profile?.role === "owner";

function dateLabel(value) {
  if (!value) return "Date not set";
  const date = new Date(`${iso(value)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Date not set" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseFinance(notes) {
  const value = String(notes || "");
  const match = value.match(/\[PL_FINANCE\]([^\n]+)/);
  if (!match) return { notes: value };
  try { return { ...JSON.parse(match[1]), notes: value.replace(match[0], "").trim() }; }
  catch { return { notes: value }; }
}

function financeNotes(meta, notes) {
  return `[PL_FINANCE]${JSON.stringify(meta)}${String(notes || "").trim() ? `\n${String(notes).trim()}` : ""}`;
}

function costsFor(row) {
  const meta = row.finance || parseFinance(row.notes);
  return number(row.partner_cost) + number(meta.processing_fee) + number(meta.delivery_cost) + number(meta.detailing_cost) + number(meta.other_cost);
}

function agreementShadow(agreement) {
  return ledgerRows.find((row) => {
    const meta = parseFinance(row.notes);
    if (String(meta.agreement_id || "") === String(agreement.id)) return true;
    return agreement.source_type === "quote" && agreement.source_id && String(row.quote_request_id || "") === String(agreement.source_id);
  }) || null;
}

function records() {
  const agreementRecords = agreements
    .filter((item) => item.signed_at && item.status !== "cancelled")
    .map((agreement) => {
      const shadow = agreementShadow(agreement);
      const finance = parseFinance(shadow?.notes);
      return {
        key: `agreement:${agreement.id}`,
        kind: "agreement",
        id: agreement.id,
        shadowId: shadow?.id || "",
        agreement,
        customer_name: agreement.customer_name,
        customer_email: agreement.customer_email,
        customer_phone: agreement.customer_phone,
        vehicle: agreement.vehicle_name,
        start_date: agreement.rental_start,
        end_date: agreement.rental_end,
        booked_on: iso(agreement.signed_at),
        total_amount: number(agreement.rental_total),
        amount_paid: number(shadow?.amount_paid),
        partner_cost: number(shadow?.partner_cost),
        payment_status: shadow?.payment_status || "pending",
        notes: finance.notes || "",
        finance,
        cancelled: false,
      };
    });

  const linkedIds = new Set(agreementRecords.map((item) => item.shadowId).filter(Boolean));
  const manualRecords = ledgerRows.filter((row) => !linkedIds.has(row.id)).map((row) => {
    const finance = parseFinance(row.notes);
    return { ...row, key: `manual:${row.id}`, kind: "manual", finance, notes: finance.notes || "", cancelled: Boolean(finance.cancelled) };
  });
  return [...agreementRecords, ...manualRecords].sort((a, b) => String(b.booked_on || b.created_at).localeCompare(String(a.booked_on || a.created_at)));
}

async function load(force = false) {
  if (!app || !supabase || loading || (loaded && !force)) return render();
  loading = true;
  app.innerHTML = '<div class="crm-loading-state">Loading bookings…</div>';
  try {
    const session = (await supabase.auth.getSession()).data.session;
    const userId = session?.user?.id;
    const [agreementResult, ledgerResult, carResult, profileResult] = await Promise.all([
      supabase.from("rental_agreements").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("booking_sales").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("cars").select("id,name,image_url,price,is_active").eq("is_active", true).order("name"),
      userId ? supabase.from("admin_profiles").select("display_name,role").eq("user_id", userId).limit(1) : Promise.resolve({ data: [] }),
    ]);
    if (agreementResult.error) throw agreementResult.error;
    if (ledgerResult.error) throw ledgerResult.error;
    agreements = agreementResult.data || [];
    ledgerRows = ledgerResult.data || [];
    cars = carResult.error ? [] : carResult.data || [];
    profile = profileResult.data?.[0] || { role: "staff" };
    loaded = true;
    render();
  } catch (error) {
    app.innerHTML = `<div class="booking-error"><strong>Bookings could not load.</strong><span>${escapeHtml(error.message || "Check the CRM database connection.")}</span><button class="secondary-button" type="button" data-retry-bookings>Try again</button></div>`;
    app.querySelector("[data-retry-bookings]")?.addEventListener("click", () => load(true));
  } finally { loading = false; }
}

function render() {
  if (!app) return;
  const all = records();
  const filtered = all.filter((item) => `${item.customer_name} ${item.vehicle} ${item.customer_phone || ""}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const collected = all.filter((item) => !item.cancelled).reduce((sum, item) => sum + number(item.amount_paid), 0);
  const costs = all.filter((item) => !item.cancelled).reduce((sum, item) => sum + costsFor(item), 0);
  const active = all.filter((item) => !item.cancelled && (!item.end_date || iso(item.end_date) >= today())).length;
  const ownerSummary = isOwner() ? `
    <div class="booking-kpis">
      <article class="featured"><span>Cash collected</span><strong>${money(collected)}</strong><small>Refundable deposits excluded</small></article>
      <article><span>Recorded costs</span><strong>${money(costs)}</strong><small>Partner, card, delivery, detailing and other</small></article>
      <article><span>Profit</span><strong>${money(collected - costs)}</strong><small>Collected cash minus recorded costs</small></article>
      <article><span>Bookings</span><strong>${all.filter((item) => !item.cancelled).length}</strong><small>${active} active or upcoming</small></article>
    </div>` : `<div class="booking-staff-note"><strong>Booking operations</strong><span>Financial totals are visible to the owner only.</span></div>`;

  app.innerHTML = `${ownerSummary}
    <section class="booking-ledger-card">
      <header><div><p class="eyebrow">All rentals</p><h3>Booking ledger</h3><span>Signed agreements are added automatically.</span></div><label><span>Search</span><input type="search" value="${escapeHtml(searchTerm)}" placeholder="Customer or vehicle" data-booking-search></label></header>
      <div class="booking-list">${filtered.length ? filtered.map(bookingCard).join("") : '<div class="admin-empty">No matching bookings yet.</div>'}</div>
    </section>
    <dialog class="booking-dialog" data-booking-dialog><div class="booking-dialog-shell" data-booking-editor></div></dialog>`;

  app.querySelector("[data-booking-search]")?.addEventListener("input", (event) => { searchTerm = event.target.value; render(); app.querySelector("[data-booking-search]")?.focus(); });
  app.querySelectorAll("[data-open-booking]").forEach((button) => button.addEventListener("click", () => openEditor(button.dataset.openBooking)));
}

function bookingCard(item) {
  const cost = costsFor(item);
  const financial = isOwner() ? `<div><span>Collected</span><strong>${money(item.amount_paid)}</strong></div><div><span>Costs</span><strong>${money(cost)}</strong></div><div><span>Profit</span><strong>${money(number(item.amount_paid) - cost)}</strong></div>` : "";
  const status = item.cancelled ? "Cancelled" : item.amount_paid > 0 ? "Paid" : "No payment";
  return `<button class="booking-row ${item.cancelled ? "cancelled" : ""}" type="button" data-open-booking="${escapeHtml(item.key)}">
    <span class="booking-row-source">${item.kind === "agreement" ? "SIGNED AGREEMENT" : "MANUAL BOOKING"}</span>
    <span class="booking-row-main"><strong>${escapeHtml(item.customer_name || "Customer")}</strong><small>${escapeHtml(item.vehicle || "Vehicle not selected")}</small></span>
    <span class="booking-row-dates"><strong>${dateLabel(item.start_date)}</strong><small>${item.end_date ? `to ${dateLabel(item.end_date)}` : "End date not set"}</small></span>
    ${financial}<span class="booking-row-status"><i>${status}</i><b aria-hidden="true">→</b></span>
  </button>`;
}

function blankRecord() {
  return { key: "new", kind: "manual", customer_name: "", customer_email: "", customer_phone: "", vehicle: "", start_date: "", end_date: "", booked_on: today(), total_amount: 0, amount_paid: 0, partner_cost: 0, payment_status: "pending", notes: "", finance: { payment_date: today(), payment_method: "stripe", cost_date: today(), processing_fee: 0, delivery_cost: 0, detailing_cost: 0, other_cost: 0 }, cancelled: false };
}

function openEditor(key = "new") {
  const item = key === "new" ? blankRecord() : records().find((row) => row.key === key);
  if (!item) return;
  selectedKey = key;
  const dialog = app.querySelector("[data-booking-dialog]");
  const editor = app.querySelector("[data-booking-editor]");
  const lockedSource = item.kind === "agreement";
  const meta = item.finance || {};
  editor.innerHTML = `<header><div><p class="eyebrow">${lockedSource ? "Signed rental" : "Manual booking"}</p><h3>${key === "new" ? "Add booking" : `Edit ${escapeHtml(item.customer_name || "booking")}`}</h3><span>${lockedSource ? "Rental details come from the signed agreement. Add payment and cost details here." : "Use this for phone bookings and historical rentals."}</span></div><button type="button" data-close-booking aria-label="Close">×</button></header>
    <form data-booking-form>
      <section><h4>Booking details</h4><div class="booking-form-grid">
        <label>Customer name<input name="customer_name" value="${escapeHtml(item.customer_name)}" required ${lockedSource ? "readonly" : ""}></label>
        <label>Phone<input name="customer_phone" value="${escapeHtml(item.customer_phone || "")}" ${lockedSource ? "readonly" : ""}></label>
        <label>Email<input name="customer_email" type="email" value="${escapeHtml(item.customer_email || meta.customer_email || "")}" ${lockedSource ? "readonly" : ""}></label>
        <label>Vehicle<input name="vehicle" list="booking-vehicles" value="${escapeHtml(item.vehicle)}" required ${lockedSource ? "readonly" : ""}><datalist id="booking-vehicles">${cars.map((car) => `<option value="${escapeHtml(car.name)}"></option>`).join("")}</datalist></label>
        <label>Rental starts<input name="start_date" type="date" value="${iso(item.start_date)}" ${lockedSource ? "readonly" : ""}></label>
        <label>Rental ends<input name="end_date" type="date" value="${iso(item.end_date)}" ${lockedSource ? "readonly" : ""}></label>
        <label>Booking date<input name="booked_on" type="date" value="${iso(item.booked_on) || today()}" required ${lockedSource ? "readonly" : ""}></label>
        <label class="booking-cancel"><input name="cancelled" type="checkbox" ${item.cancelled ? "checked" : ""}> Cancelled booking</label>
      </div></section>
      <section class="booking-money-section"><h4>Payment received</h4><p>Enter rental money actually collected. Do not include a refundable security deposit.</p><div class="booking-form-grid">
        <label>Amount collected<input name="amount_paid" type="number" min="0" step=".01" value="${number(item.amount_paid)}"></label>
        <label>Payment date<input name="payment_date" type="date" value="${iso(meta.payment_date) || (item.amount_paid ? iso(item.booked_on) : today())}"></label>
        <label>Payment method<select name="payment_method">${["stripe","cash","wire","zelle","other"].map((method) => `<option value="${method}" ${method === (meta.payment_method || "stripe") ? "selected" : ""}>${method.charAt(0).toUpperCase()+method.slice(1)}</option>`).join("")}</select></label>
      </div></section>
      <section class="booking-cost-section"><h4>Booking costs</h4><p>Enter only the real fixed cost for this rental.</p><div class="booking-form-grid booking-cost-grid">
        <label>Partner vehicle cost<input name="partner_cost" type="number" min="0" step=".01" value="${number(item.partner_cost)}"></label>
        <label>Stripe / card fee<input name="processing_fee" type="number" min="0" step=".01" value="${number(meta.processing_fee)}"></label>
        <label>Delivery cost<input name="delivery_cost" type="number" min="0" step=".01" value="${number(meta.delivery_cost)}"></label>
        <label>Detailing cost<input name="detailing_cost" type="number" min="0" step=".01" value="${number(meta.detailing_cost)}"></label>
        <label>Other cost<input name="other_cost" type="number" min="0" step=".01" value="${number(meta.other_cost)}"></label>
        <label>Cost date<input name="cost_date" type="date" value="${iso(meta.cost_date) || iso(meta.payment_date) || today()}"></label>
      </div></section>
      <label class="booking-notes">Internal notes<textarea name="notes" rows="3">${escapeHtml(item.notes || "")}</textarea></label>
      <div class="booking-editor-summary" data-booking-preview></div>
      <footer>${item.kind === "manual" && key !== "new" ? '<button class="danger-button" type="button" data-delete-booking>Delete</button>' : '<span></span>'}<div><button class="secondary-button" type="button" data-close-booking>Cancel</button><button class="primary-button" type="submit">Save booking</button></div></footer>
      <p class="admin-status" data-booking-status></p>
    </form>`;
  const form = editor.querySelector("[data-booking-form]");
  form.addEventListener("input", () => updatePreview(form));
  form.addEventListener("submit", (event) => save(event, item));
  editor.querySelectorAll("[data-close-booking]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  editor.querySelector("[data-delete-booking]")?.addEventListener("click", () => remove(item));
  updatePreview(form);
  dialog.showModal();
}

function updatePreview(form) {
  const data = new FormData(form);
  const collected = number(data.get("amount_paid"));
  const costs = ["partner_cost","processing_fee","delivery_cost","detailing_cost","other_cost"].reduce((sum, key) => sum + number(data.get(key)), 0);
  form.querySelector("[data-booking-preview]").innerHTML = `<span><small>Collected</small><strong>${money(collected)}</strong></span><span><small>Total costs</small><strong>${money(costs)}</strong></span><span class="${collected-costs<0?"negative":""}"><small>Profit</small><strong>${money(collected-costs)}</strong></span>`;
}

async function save(event, item) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-booking-status]");
  const data = new FormData(form);
  const amountPaid = number(data.get("amount_paid"));
  const totalAmount = Math.max(number(item.total_amount), amountPaid);
  const meta = {
    agreement_id: item.kind === "agreement" ? item.id : undefined,
    customer_email: String(data.get("customer_email") || "").trim(),
    payment_date: data.get("payment_date") || null,
    payment_method: data.get("payment_method") || "other",
    cost_date: data.get("cost_date") || data.get("payment_date") || data.get("booked_on") || today(),
    processing_fee: number(data.get("processing_fee")), delivery_cost: number(data.get("delivery_cost")), detailing_cost: number(data.get("detailing_cost")), other_cost: number(data.get("other_cost")),
    cancelled: data.get("cancelled") === "on",
  };
  const agreement = item.agreement;
  const quoteId = agreement?.source_type === "quote" ? agreement.source_id : item.quote_request_id;
  const payload = {
    quote_request_id: /^[0-9a-f-]{36}$/i.test(String(quoteId || "")) ? quoteId : null,
    customer_name: String(data.get("customer_name") || "").trim(), customer_phone: String(data.get("customer_phone") || "").trim(), vehicle: String(data.get("vehicle") || "").trim(),
    booked_on: data.get("booked_on") || today(), start_date: data.get("start_date") || null, end_date: data.get("end_date") || null,
    rental_days: Math.max(1, item.agreement?.rental_days || Math.ceil((new Date(`${data.get("end_date")}T12:00:00`) - new Date(`${data.get("start_date")}T12:00:00`)) / 86400000) || 1),
    daily_rate: item.agreement?.daily_rate || 0, delivery_fee: 0, addons_total: 0, discount: 0,
    partner_cost: number(data.get("partner_cost")), total_amount: totalAmount, amount_paid: amountPaid,
    payment_status: meta.cancelled ? "refunded" : amountPaid >= totalAmount && totalAmount > 0 ? "paid" : amountPaid > 0 ? "partial" : "pending",
    notes: financeNotes(meta, data.get("notes")), updated_at: new Date().toISOString(),
  };
  status.textContent = "Saving booking…";
  const existingId = item.shadowId || (item.kind === "manual" ? item.id : "");
  const result = existingId
    ? await supabase.from("booking_sales").update(payload).eq("id", existingId).select().single()
    : await supabase.from("booking_sales").insert(payload).select().single();
  if (result.error) { status.textContent = result.error.message; status.dataset.tone = "error"; return; }
  const index = ledgerRows.findIndex((row) => row.id === result.data.id);
  if (index >= 0) ledgerRows.splice(index, 1, result.data); else ledgerRows.unshift(result.data);
  app.querySelector("[data-booking-dialog]")?.close();
  render();
  window.dispatchEvent(new CustomEvent("prestige:finance-updated"));
}

async function remove(item) {
  if (!window.confirm("Delete this manual booking?")) return;
  const result = await supabase.from("booking_sales").delete().eq("id", item.id);
  if (result.error) return window.alert(result.error.message);
  ledgerRows = ledgerRows.filter((row) => row.id !== item.id);
  app.querySelector("[data-booking-dialog]")?.close();
  render();
  window.dispatchEvent(new CustomEvent("prestige:finance-updated"));
}

sectionButton?.addEventListener("click", () => {
  document.querySelectorAll("[data-crm-section]").forEach((button) => button.classList.toggle("active", button === sectionButton));
  document.querySelectorAll("[data-section-panel]").forEach((panel) => {
    const active = panel.dataset.sectionPanel === "bookings";
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  try { localStorage.setItem("prestige-luxor-crm-active-section", "bookings"); } catch {}
  load();
});
newButton?.addEventListener("click", async () => { if (!loaded) await load(); openEditor("new"); });
window.addEventListener("prestige:agreement-signed", () => load(true));
supabase?.auth.onAuthStateChange((event, session) => { if (!session) { loaded = false; agreements = []; ledgerRows = []; } });
