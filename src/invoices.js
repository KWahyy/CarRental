import { amountLabel, rentalRange, statePill } from "./crm-billing-display.js";
import { singleFlight, registerSection } from "./crm-navigation.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js?v=fleet-sync-20260714";
import { clearDraft, draftData, restoreForm, scheduleDraft, serializeForm, writeDraft } from "./form-drafts.js";

const DEFAULT_TERMS = "Full payment is due by the due date to confirm the reservation. The refundable security deposit is subject to inspection and deductions for excess mileage, fuel, tolls, late return, damage, or other charges permitted by the signed rental agreement. A valid driver license, proof of insurance, and driver approval are required. Changes and cancellations are governed by the signed rental agreement. This invoice does not replace the rental agreement.";
const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
const supabase = window.prestigeLuxorSupabase || (configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null);

const panelButton = document.querySelector('[data-crm-section="invoices"]');
const form = document.querySelector("[data-invoice-form]");
const invoiceDialog = document.querySelector("[data-invoice-dialog]");
const invoiceDocument = document.querySelector("[data-invoice-document]");
const invoiceFilter = document.querySelector("[data-invoice-filter]");
const invoiceCount = document.querySelector("[data-invoice-count]");
const editorStatus = document.querySelector("[data-invoice-editor-status]");
const invoiceLabels = {draft:"Draft", finalized:"Unpaid", sent:"Sent", due:"Due", partially_paid:"Partially paid", paid:"Paid", overdue:"Overdue", refunded:"Refunded", void:"Void"};
let selectedId = "";
let fleetImages = [];
const paymentCache = new Map();
async function renderPaymentHistory(invoice, node) {
  let pending = paymentCache.get(invoice.id);
  if (!pending) {
    pending = Promise.resolve(supabase.from("invoice_payments").select("amount,method,reference,paid_at").eq("invoice_id",invoice.id).order("paid_at",{ascending:false}));
    paymentCache.set(invoice.id,pending);
  }
  try {
    const {data, error} = await pending;
    if (error) throw error;
    if (!data?.length || !node.isConnected) return;
    node.innerHTML = '<h4>Payment history</h4>' + data.map(payment => `<div><span>${escapeHtml(dateLabel(String(payment.paid_at || "").slice(0,10)))} · ${escapeHtml(payment.method || "Payment")}${payment.reference ? " · "+escapeHtml(payment.reference) : ""}</span><b>${amountLabel(payment.amount)}</b></div>`).join("");
    node.hidden=false;
  } catch { paymentCache.delete(invoice.id); }
}
const list = document.querySelector("[data-invoice-list]");
const status = document.querySelector("[data-invoice-status]");
const kpis = document.querySelector("[data-invoice-kpis]");
const search = document.querySelector("[data-invoice-search]");
const newButton = document.querySelector("[data-new-invoice]");
const title = document.querySelector("[data-invoice-title]");
const badge = document.querySelector("[data-invoice-badge]");
const lockNote = document.querySelector("[data-invoice-lock-note]");
const sourceType = document.querySelector("[data-invoice-source-type]");
const sourceSelect = document.querySelector("[data-invoice-source]");
const totalCard = document.querySelector("[data-invoice-total]");
const depositMethod = document.querySelector("[data-deposit-method]");
const depositHelp = document.querySelector("[data-deposit-help]");
const rentalStartInput = form?.elements.rental_start;
const rentalEndInput = form?.elements.rental_end;
const rentalDaysInput = form?.elements.rental_days;
const rentalDaysHelp = document.querySelector("[data-rental-days-help]");
const saveButton = document.querySelector("[data-save-invoice]");
const downloadButton = document.querySelector("[data-download-invoice]");
const paymentButton = document.querySelector("[data-record-payment]");
const releaseButton = document.querySelector("[data-release-hold]");
const voidButton = document.querySelector("[data-void-invoice]");
const deleteButton = document.querySelector("[data-delete-invoice]");
const discardDraftButton = document.querySelector("[data-discard-invoice-draft]");
const continueButton = document.querySelector("[data-continue-agreement]");

let invoices = [];
let quotes = [];
let currentInvoice = null;
let employeeRole = "staff";
let loaded = false;
const INVOICE_DRAFT_KEY = "prestige-luxor:draft:new-invoice:v1";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message = "", type = "") {
  if (!status) return;
  const target = invoiceDialog.open ? editorStatus : status;
  const other = invoiceDialog.open ? status : editorStatus;
  target.textContent = message;
  target.className = `admin-status ${type}`.trim();
  other.textContent = "";
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return "No date";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function syncRentalDays() {
  const start = rentalStartInput?.value || "";
  const end = rentalEndInput?.value || "";
  if (rentalEndInput) rentalEndInput.min = start;
  rentalEndInput?.setCustomValidity("");
  rentalDaysHelp?.classList.remove("error");

  if (!start || !end) {
    if (rentalDaysHelp) rentalDaysHelp.textContent = "Calculated automatically after both dates are selected.";
    return;
  }

  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    rentalEndInput?.setCustomValidity("Rental end must be on or after the start date.");
    if (rentalDaysHelp) {
      rentalDaysHelp.textContent = "Choose an end date on or after the rental start date.";
      rentalDaysHelp.classList.add("error");
    }
    return;
  }

  const days = Math.max(1, Math.ceil((endTime - startTime) / 86400000));
  if (rentalDaysInput) rentalDaysInput.value = String(days);
  if (rentalDaysHelp) rentalDaysHelp.textContent = `${days} rental day${days === 1 ? "" : "s"} calculated from the selected dates.`;
  renderTotals();
}

async function sessionToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sign in again to use invoices.");
  return data.session.access_token;
}

async function invoiceApi(path = "", options = {}) {
  const token = await sessionToken();
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if ([404, 405, 501].includes(response.status) && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      throw new Error("Invoice saving needs the full application server. The current local server only displays static files and cannot run /api/invoices.");
    }
    const message = data.error || "Invoice request failed.";
    if (/invoices|admin_profiles/i.test(message) && /schema|table|not found|cache/i.test(message)) {
      throw new Error("The invoice database is not installed yet. Run supabase/invoices.sql in the Supabase SQL Editor, then refresh the CRM.");
    }
    throw new Error(message);
  }
  if (options.method && options.method !== "GET") {
    const saved = data.invoice;
    const previous = saved && invoices.find(row => row.id === saved.id);
    // The editor also saves before downloading a PDF or opening an agreement.
    // A repeated save of the same amounts and attribution needs no ledger read.
    const ledgerFields = ["status","subtotal","total","amount_paid","balance_due","refundable_deposit","deposit_method","deposit_hold_status",
      "source_type","source_id","quote_id","customer_name","vehicle_name","rental_start","rental_end","issue_date","due_date","paid_at"];
    const changed = options.method !== "PATCH" || !previous || ledgerFields.some(key => previous[key] !== saved[key]);
    if (changed) window.dispatchEvent(new CustomEvent("prestige:finance-updated"));
  }
  return data;
}

function numeric(name) {
  return Math.max(Number(form.elements[name]?.value || 0), 0);
}

function totalsFromForm() {
  const rental = numeric("daily_rate") * Math.max(numeric("rental_days"), 1);
  const subtotal = Math.max(
    rental + numeric("delivery_fee") + numeric("addons_total") + numeric("insurance_fee") + numeric("mileage_fee") +
      numeric("fuel_fee") + numeric("tolls_fee") + numeric("damage_fee") + numeric("other_fee") - numeric("discount"),
    0,
  );
  const deposit = numeric("refundable_deposit");
  const total = subtotal + (form.elements.deposit_method.value === "charge" ? deposit : 0);
  const paid = Number(currentInvoice?.amount_paid || 0);
  return { subtotal, deposit, total, paid, balance: Math.max(subtotal - paid, 0) };
}

function renderTotals() {
  if (!form || form.hidden) return;
  const totals = totalsFromForm();
  const hold = form.elements.deposit_method.value === "authorization_hold" && totals.deposit > 0;
  totalCard.innerHTML = `
    <div><span>Rental subtotal</span><strong>${money(totals.subtotal)}</strong></div>
    ${hold ? `<div><span>Refundable authorization hold</span><strong>${money(totals.deposit)}</strong></div>` : ""}
    <div class="invoice-grand-total"><span>Invoice total</span><strong>${money(totals.total)}</strong></div>
    ${totals.paid ? `<div><span>Paid</span><strong>${money(totals.paid)}</strong></div><div><span>Rental balance due</span><strong>${money(totals.balance)}</strong></div>` : ""}
  `;
  depositHelp.textContent = hold
    ? "The hold is shown on the PDF but is not added to the invoice total. Release it manually after inspection."
    : "A charged refundable deposit is included in the invoice total.";
}

function payloadFromForm() {
  const data = new FormData(form);
  const numberFields = ["daily_rate", "rental_days", "delivery_fee", "addons_total", "insurance_fee", "mileage_fee", "fuel_fee", "tolls_fee", "damage_fee", "other_fee", "discount", "refundable_deposit"];
  const payload = Object.fromEntries(data.entries());
  numberFields.forEach((name) => { payload[name] = Number(payload[name] || 0); });
  ["source_id", "due_date", "rental_start", "rental_end"].forEach((name) => { payload[name] = payload[name] || null; });
  return payload;
}

function sourceRecords(type) {
  if (type === "quote") return quotes.map((item) => ({ id: item.id, label: `${item.name} · ${item.vehicle}`, item }));
  return [];
}

function populateSources(selected = "") {
  const records = sourceRecords(sourceType.value);
  if (selected && !records.some(record => String(record.id) === String(selected))) records.push({id:selected,label:"Linked rental record"});
  sourceSelect.disabled = sourceType.value === "manual";
  sourceSelect.innerHTML = `<option value="">${records.length ? "Select a record" : "None selected"}</option>${records
    .map(({ id, label }) => `<option value="${escapeHtml(id)}" ${String(id) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("")}`;
}

function applySource() {
  const record = sourceRecords(sourceType.value).find(({ id }) => String(id) === sourceSelect.value)?.item;
  if (!record) return;
  if (sourceType.value === "quote") {
    form.elements.customer_name.value = record.name || "";
    form.elements.customer_email.value = record.email || "";
    form.elements.customer_phone.value = record.phone || "";
    form.elements.vehicle_name.value = record.vehicle || "";
    form.elements.rental_start.value = record.rental_date || "";
    form.elements.rental_days.value = record.quote_days || 1;
    form.elements.daily_rate.value = record.quote_daily_rate || 0;
    form.elements.delivery_fee.value = record.quote_delivery_fee || 0;
    form.elements.addons_total.value = record.quote_addons_total || 0;
    form.elements.discount.value = record.quote_discount || 0;
    form.elements.refundable_deposit.value = record.quote_deposit || 0;
  }
  syncRentalDays();
  renderTotals();
}

function renderList() {
  const query = (search.value || "").trim().toLowerCase();
  const filtered = invoices.filter(invoice => (!invoiceFilter.value || invoice.status === invoiceFilter.value) &&
    [invoice.invoice_number, invoice.customer_name, invoice.vehicle_name, invoiceLabels[invoice.status]].some(value => String(value || "").toLowerCase().includes(query)));
  const selected = filtered.find(invoice => invoice.id === selectedId) || filtered[0];
  selectedId = selected?.id || "";
  invoiceCount.textContent = String(filtered.length);
  list.innerHTML = filtered.map(invoice => `<button type="button" class="bl-invoice-row" data-select-invoice="${escapeHtml(invoice.id)}" aria-pressed="${invoice.id === selectedId}">
    <span><small>${escapeHtml(invoice.invoice_number)}</small><strong>${escapeHtml(invoice.customer_name)}</strong><span class="bl-list-vehicle">${escapeHtml(invoice.vehicle_name)}</span></span>
    <span class="bl-invoice-right"><b>${amountLabel(invoice.total)}</b>${statePill(invoiceLabels[invoice.status] || invoice.status)}</span></button>`).join("") ||
    `<p class="bl-empty">${invoices.length ? "No matching invoices. Try another search or status." : "No invoices yet."}</p>`;
  const issued = invoices.filter(invoice => !["draft","void","refunded"].includes(invoice.status));
  const outstanding = issued.filter(invoice => Number(invoice.balance_due) > 0);
  const drafts = invoices.filter(invoice => invoice.status === "draft");
  const sum = (rows, field) => amountLabel(rows.reduce((value, row) => value + Number(row[field] || 0), 0));
  kpis.innerHTML = `<div class="bl-balance"><span>Outstanding balance</span><strong>${sum(outstanding,"balance_due")}</strong><small>${outstanding.length} open invoice${outstanding.length === 1 ? "" : "s"}</small></div>
    <div class="bl-statement"><div><span>Recorded payments</span><strong>${sum(issued,"amount_paid")}</strong><small>On issued invoices</small></div>
    <div><span>In draft</span><strong>${sum(drafts,"total")}</strong><small>${drafts.length} draft invoice${drafts.length === 1 ? "" : "s"}</small></div></div>`;
  renderStatement(selected);
}

function renderStatement(invoice) {
  if (!invoice) { invoiceDocument.replaceChildren(); return; }
  const fact = (label, value) => `<div><dt>${label}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
  const charges = [["Delivery / pickup",invoice.delivery_fee],["Add-ons",invoice.addons_total],["Insurance",invoice.insurance_fee],
    ["Additional mileage",invoice.mileage_fee],["Fuel",invoice.fuel_fee],["Tolls",invoice.tolls_fee],["Damage",invoice.damage_fee],
    [invoice.other_label || "Other charges",invoice.other_fee],["Discount",-Number(invoice.discount || 0)]];
  if (invoice.deposit_method === "charge") charges.push(["Refundable deposit",invoice.refundable_deposit]);
  const canEdit = employeeRole !== "viewer" && invoice.status !== "void";
  const canPay = ["owner","manager"].includes(employeeRole) && !["void","refunded","paid"].includes(invoice.status) && Number(invoice.balance_due) > 0;
  const car = fleetImages.find(item => (invoice.vehicle_id && item.id === invoice.vehicle_id) || item.name?.trim().toLowerCase() === invoice.vehicle_name?.trim().toLowerCase());
  const image = invoice.vehicle_image_url || car?.image_url;
  invoiceDocument.innerHTML = `<article class="bl-folio"><div class="bl-document-bar"><span>Prestige Luxor <i>/</i> Billing</span>${statePill(invoiceLabels[invoice.status] || invoice.status)}</div>
    <div class="bl-document-title"><div><p>Invoice</p><h3>${escapeHtml(invoice.invoice_number)}</h3></div><button type="button" class="bl-print-btn" data-invoice-pdf>Download PDF</button></div>
    <dl class="bl-facts">${fact("Billed to",invoice.customer_name)}${fact("Rental dates",rentalRange(invoice.rental_start,invoice.rental_end))}${fact("Due date",invoice.due_date ? dateLabel(invoice.due_date) : "—")}</dl>
    <div class="bl-vehicle-line">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ""}<span><small>Rental vehicle</small><b>${escapeHtml(invoice.vehicle_name || "Unspecified")}</b></span></div>
    <div class="bl-line-items"><div><span><b>Vehicle rental</b><small>${Number(invoice.rental_days || 1)} × ${amountLabel(invoice.daily_rate)} per day</small></span><b>${amountLabel(Number(invoice.daily_rate || 0)*Number(invoice.rental_days || 1))}</b></div>
    ${charges.filter(([,amount])=>Number(amount)).map(([label,amount])=>`<div><span>${escapeHtml(label)}</span><b>${amountLabel(amount)}</b></div>`).join("")}
    <div class="bl-total"><span>Invoice total</span><strong>${amountLabel(invoice.total)}</strong></div></div>
    <div class="bl-remainder">${invoice.deposit_method === "authorization_hold" && Number(invoice.refundable_deposit) ? `<span>Authorization hold <b>${amountLabel(invoice.refundable_deposit)}</b></span>` : ""}
      <span>Rental payments <b>${amountLabel(invoice.amount_paid)}</b></span><span>Rental balance due <strong>${amountLabel(invoice.balance_due)}</strong></span></div>
    ${invoice.notes ? `<p class="bl-note">${escapeHtml(invoice.notes)}</p>` : ""}
    ${invoice.quote_id ? `<button class="bl-print-btn" type="button" data-open-quote="${escapeHtml(invoice.quote_id)}">Open source quote →</button>` : ""}</article>
    <div class="bl-doc-actions">${canEdit && invoice.status === "draft" ? '<button type="button" class="primary-button" data-issue-invoice>Issue invoice →</button>' : ""}
    ${canPay ? '<button type="button" class="secondary-button" data-statement-payment>Record payment</button>' : ""}
    ${canEdit ? '<button type="button" class="secondary-button" data-edit-invoice>Edit invoice</button><button type="button" class="secondary-button" data-statement-agreement>Continue to agreement →</button>' : '<button type="button" class="secondary-button" data-view-invoice-details>View details</button>'}</div><section class="bl-history" aria-label="Payment history" hidden></section>`;
  if (Number(invoice.amount_paid) > 0) renderPaymentHistory(invoice, invoiceDocument.querySelector(".bl-history"));
}

function goToAgreement(invoice) {
  invoiceDialog.close();
  document.querySelector('[data-crm-section="agreements"]')?.click();
  window.dispatchEvent(new CustomEvent("prestige:start-agreement", { detail: {invoice} }));
}
async function downloadPdf(invoice) {
  const token = await sessionToken();
  const response = await fetch(`/api/invoice-pdf?id=${encodeURIComponent(invoice.id)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not download invoice.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = `${invoice.invoice_number}.pdf`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function setFormLocked(locked) {
  [...form.elements].forEach((field) => {
    if (["button", "hidden"].includes(field.type)) return;
    field.disabled = locked;
  });
  saveButton.hidden = locked;
  downloadButton.hidden = locked;
  paymentButton.hidden = !currentInvoice || !["owner", "manager"].includes(employeeRole) || ["paid", "void"].includes(currentInvoice?.status);
  releaseButton.hidden = !currentInvoice || !["owner", "manager"].includes(employeeRole) || currentInvoice?.deposit_method !== "authorization_hold" || currentInvoice?.deposit_hold_status === "released";
  voidButton.hidden = !currentInvoice || employeeRole !== "owner" || ["draft", "paid", "void"].includes(currentInvoice?.status);
  deleteButton.hidden = !currentInvoice || employeeRole !== "owner" || currentInvoice?.status !== "draft";
  discardDraftButton.hidden = Boolean(currentInvoice);
  continueButton.hidden = locked || !currentInvoice;
}

function openInvoice(invoice = null) {
  currentInvoice = invoice;
  if (!invoice && employeeRole === "viewer") return;
  if (!invoiceDialog.open) invoiceDialog.showModal();
  editorStatus.textContent = "";
  if (invoice) selectedId = invoice.id;
  form.hidden = false;
  form.reset();
  const defaults = invoice || {
    source_type: "manual",
    issue_date: today(),
    rental_days: 1,
    mileage_allowance: "100 miles/day",
    other_label: "Other charge",
    deposit_method: "charge",
    terms: DEFAULT_TERMS,
    status: "draft",
  };
  Object.entries(defaults).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value ?? "";
  });
  const savedFields = !invoice ? draftData(INVOICE_DRAFT_KEY)?.fields : null;
  const savedSourceType = savedFields?.find((field) => field.name === "source_type")?.value;
  const savedSourceId = savedFields?.find((field) => field.name === "source_id")?.value;
  const type = savedSourceType || defaults.source_type || "manual";
  if (type === "booking" && !sourceType.querySelector('[value="booking"]')) sourceType.add(new Option("Booking","booking"));
  sourceType.value = type;
  populateSources(savedSourceId || defaults.source_id || "");
  const restored = !invoice && restoreForm(form, savedFields);
  if (restored) {
    sourceType.value = form.elements.source_type?.value || "manual";
    populateSources(form.elements.source_id?.value || "");
  }
  title.textContent = invoice?.invoice_number || "New invoice";
  const state = invoice?.status || "draft";
  badge.textContent = state.replaceAll("_", " ");
  badge.className = `invoice-status-badge ${state}`;
  const locked = invoice?.status === "void" || employeeRole === "viewer";
  lockNote.textContent = invoice?.status === "void" ? "Voided invoices are read-only." : locked ? "Read-only invoice details." : "Invoices can be edited after saving.";
  setFormLocked(locked);
  sourceSelect.disabled = Boolean(locked) || sourceType.value === "manual";
  syncRentalDays();
  renderTotals();
  renderList();
  if (restored) setStatus("Your unsaved invoice was restored.", "success");
}

async function loadSourceRecords() {
  const [quoteResult, imagesResult] = await Promise.all([
    supabase.from("quote_requests").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("cars").select("id,name,image_url").order("name").limit(500),
  ]);
  fleetImages = imagesResult.data || [];
  if (!quoteResult.error) quotes = quoteResult.data || [];
}

const loadInvoices = singleFlight(async function (force = false) {
  if (!configured || (loaded && !force)) return;
  try {
    if (!loaded) setStatus("Loading invoices...");
    const [, data] = await Promise.all([loadSourceRecords(), invoiceApi("invoices")]);
    if (force) paymentCache.clear();
    invoices = data.invoices || [];
    employeeRole = data.role || "staff";
    loaded = true;
    if (currentInvoice) currentInvoice = invoices.find((item) => item.id === currentInvoice.id) || null;
    renderList();
    if (currentInvoice && invoiceDialog.open) openInvoice(currentInvoice);
    else if (!force && !invoiceDialog.open && document.querySelector('[data-section-panel="invoices"]')?.classList.contains("active") && draftData(INVOICE_DRAFT_KEY)) openInvoice();
    if (!draftData(INVOICE_DRAFT_KEY) || currentInvoice) setStatus("");
  } catch (error) {
    const hasDraft = !currentInvoice && Boolean(draftData(INVOICE_DRAFT_KEY));
    if (hasDraft && document.querySelector('[data-section-panel="invoices"]')?.classList.contains("active")) openInvoice();
    setStatus(hasDraft ? `Draft restored. ${error.message}` : error.message, "error");
  }
});

async function saveDraft() {
  if (!form.reportValidity()) return null;
  const payload = payloadFromForm();
  const id = payload.id;
  const data = id
    ? await invoiceApi("invoices", { method: "PATCH", body: JSON.stringify(payload) })
    : await invoiceApi("invoices", { method: "POST", body: JSON.stringify(payload) });
  currentInvoice = data.invoice;
  clearDraft(INVOICE_DRAFT_KEY);
  await loadInvoices(true);
  openInvoice(currentInvoice);
  return currentInvoice;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setStatus("Saving invoice...");
    if (!await saveDraft()) return;
    setStatus("Invoice saved. You can keep editing it or download the PDF.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

downloadButton?.addEventListener("click", async () => {
  try {
    setStatus("Saving invoice and preparing PDF...");
    const invoice = await saveDraft();
    if (!invoice) return;
    await downloadPdf(invoice);
    setStatus("PDF downloaded. Send it to the customer using your preferred method.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

continueButton?.addEventListener("click", async () => {
  try {
    continueButton.disabled = true;
    setStatus("Saving invoice and opening the rental agreement...");
    const invoice = await saveDraft();
    if (!invoice) return;
    goToAgreement(invoice);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    continueButton.disabled = false;
  }
});

const paymentDialog = document.createElement("dialog");
paymentDialog.className = "quote-action-dialog invoice-payment";
paymentDialog.setAttribute("aria-labelledby","invoice-payment-title");
paymentDialog.innerHTML = `<form><header><h3 id="invoice-payment-title">Record payment</h3><button type="button" data-close-payment aria-label="Close payment form">×</button></header>
  <p data-payment-caption></p><label>Rental payment received<input name="amount" type="number" min="0.01" step="0.01" required></label>
  <label>Payment date<input name="payment_date" type="date" required></label>
  <label>Method<select name="payment_method"><option value="stripe">Stripe</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="zelle">Zelle</option><option value="other">Other</option></select></label>
  <label>Reference (optional)<input name="payment_reference"></label><p role="status" data-payment-error></p>
  <footer><button type="button" class="secondary-button" data-close-payment>Cancel</button><button class="primary-button" type="submit">Record payment</button></footer></form>`;
document.body.append(paymentDialog);
let paymentInvoice = null;
function openPayment(invoice) {
  if (!invoice || !["owner","manager"].includes(employeeRole)) return;
  const paymentForm = paymentDialog.querySelector("form");
  paymentInvoice = invoice;
  paymentForm.reset();
  const balance = Math.max(Number(invoice.subtotal || 0) - Number(invoice.amount_paid || 0),0);
  const now = new Date();
  paymentForm.elements.amount.value = balance || "";
  paymentForm.elements.amount.max = String(balance);
  paymentForm.elements.payment_date.value = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  paymentForm.elements.payment_method.value = invoice.payment_method || "stripe";
  paymentDialog.querySelector("[data-payment-caption]").textContent = invoice.invoice_number + " · Rental balance " + amountLabel(balance);
  paymentDialog.querySelector("[data-payment-error]").textContent = "";
  if (!paymentDialog.open) paymentDialog.showModal();
}
paymentButton?.addEventListener("click", () => openPayment(currentInvoice));
paymentDialog.querySelectorAll("[data-close-payment]").forEach(button => button.addEventListener("click", () => paymentDialog.close()));
paymentDialog.querySelector("form").addEventListener("submit", async event => {
  event.preventDefault();
  const invoice = paymentInvoice;
  const button = event.target.querySelector('[type="submit"]');
  if (!invoice || button.disabled) return;
  const fields = Object.fromEntries(new FormData(event.target));
  try {
    button.disabled = true;
    await invoiceApi("invoices",{method:"POST",body:JSON.stringify({...fields,id:invoice.id,action:"record_payment",amount:Number(fields.amount)})});
    await loadInvoices(true);
    paymentDialog.close();
    setStatus("Payment recorded.","success");
  } catch(error) { paymentDialog.querySelector("[data-payment-error]").textContent = error.message; }
  finally { button.disabled = false; }
});

releaseButton?.addEventListener("click", async () => {
  if (!window.confirm("Confirm that the refundable deposit hold has been released?")) return;
  try {
    const data = await invoiceApi("invoices", { method: "POST", body: JSON.stringify({ action: "release_hold", id: currentInvoice.id }) });
    currentInvoice = data.invoice;
    await loadInvoices(true);
    openInvoice(currentInvoice);
    setStatus("Deposit hold marked released.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

voidButton?.addEventListener("click", async () => {
  if (!window.confirm("Void this invoice? This cannot be undone.")) return;
  try {
    const data = await invoiceApi("invoices", { method: "POST", body: JSON.stringify({ action: "void", id: currentInvoice.id }) });
    currentInvoice = data.invoice;
    await loadInvoices(true);
    openInvoice(currentInvoice);
    setStatus("Invoice voided.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

deleteButton?.addEventListener("click", async () => {
  if (!currentInvoice?.id) return;
  const invoiceNumber = currentInvoice.invoice_number || "this invoice";
  if (!window.confirm(`Permanently delete ${invoiceNumber}? This cannot be undone.`)) return;
  try {
    deleteButton.disabled = true;
    setStatus(`Deleting ${invoiceNumber}...`);
    await invoiceApi(`invoices?id=${encodeURIComponent(currentInvoice.id)}`, { method: "DELETE" });
    currentInvoice = null;
    form.hidden = true;
    invoiceDialog.close();
    await loadInvoices(true);
    setStatus(`${invoiceNumber} was deleted.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    deleteButton.disabled = false;
  }
});

newButton?.addEventListener("click", () => openInvoice());
discardDraftButton?.addEventListener("click", () => {
  if (!window.confirm("Discard this unsaved invoice draft?")) return;
  clearDraft(INVOICE_DRAFT_KEY);
  currentInvoice = null;
  form.reset();
  form.hidden = true;
  invoiceDialog.close();
  renderList();
  setStatus("Unsaved invoice draft discarded.", "success");
});
search?.addEventListener("input", renderList);
form?.addEventListener("input", renderTotals);
form?.addEventListener("input", () => {
  if (!currentInvoice) scheduleDraft(INVOICE_DRAFT_KEY, () => ({ fields: serializeForm(form) }));
});
form?.addEventListener("change", () => {
  if (!currentInvoice) scheduleDraft(INVOICE_DRAFT_KEY, () => ({ fields: serializeForm(form) }));
});
window.addEventListener("pagehide", () => {
  if (!currentInvoice && form && !form.hidden) writeDraft(INVOICE_DRAFT_KEY, { fields: serializeForm(form) });
});
depositMethod?.addEventListener("change", renderTotals);
rentalStartInput?.addEventListener("input", syncRentalDays);
rentalEndInput?.addEventListener("input", syncRentalDays);
sourceType?.addEventListener("change", () => populateSources());
sourceSelect?.addEventListener("change", applySource);
list?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-invoice]");
  if (!button) return;
  selectedId = button.dataset.selectInvoice;
  renderList();
  list.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
});
panelButton?.addEventListener("click", () => loadInvoices());
window.addEventListener("prestige:open-invoice", async (event) => {
  try {
    await loadInvoices(true);
    const invoice = invoices.find((item) => String(item.id) === String(event.detail?.id));
    if (!invoice) throw new Error("Invoice not found.");
    search.value = ""; invoiceFilter.value = ""; selectedId = invoice.id; renderList();
  } catch (error) {
    setStatus(error.message, "error");
  }
});
supabase?.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    paymentCache.clear();
    invoices = [];
    loaded = false;
    currentInvoice = null;
    renderList();
  } else if (session && document.querySelector('[data-section-panel="invoices"]')?.classList.contains("active")) {
    loadInvoices();
  }
});

registerSection("invoices", loadInvoices);


invoiceFilter.insertAdjacentHTML("beforeend", Object.entries(invoiceLabels).map(([value,label]) => `<option value="${value}">${label}</option>`).join(""));
invoiceFilter.addEventListener("change",renderList);
document.querySelector("[data-close-invoice-editor]").addEventListener("click", () => invoiceDialog.close());
invoiceDialog.addEventListener("close", () => {
  if (!currentInvoice && !form.hidden) writeDraft(INVOICE_DRAFT_KEY,{fields:serializeForm(form)});
  currentInvoice = null;
  form.hidden = true;
});
invoiceDocument.addEventListener("click", async event => {
  const button = event.target.closest("button");
  const invoice = invoices.find(item => item.id === selectedId);
  if (!button || !invoice) return;
  if (button.matches("[data-edit-invoice],[data-view-invoice-details]")) return openInvoice(invoice);
  if (button.hasAttribute("data-open-quote")) {
    document.querySelector('[data-crm-section="requests"]')?.click();
    window.dispatchEvent(new CustomEvent("prestige:open-quote",{detail:{id:invoice.quote_id}}));
    return;
  }
  if (button.hasAttribute("data-statement-agreement")) return goToAgreement(invoice);
  if (button.hasAttribute("data-statement-payment")) return openPayment(invoice);
  try {
    button.disabled = true;
    if (button.hasAttribute("data-invoice-pdf")) {
      await downloadPdf(invoice);
      setStatus("Invoice PDF downloaded.","success");
    }
    if (button.hasAttribute("data-issue-invoice")) {
      await invoiceApi("invoices", {method:"POST", body:JSON.stringify({id:invoice.id,action:"finalize"})});
      await loadInvoices(true);
      setStatus("Invoice issued.","success");
    }
  } catch (error) { setStatus(error.message,"error"); }
  finally { button.disabled = false; }
});
