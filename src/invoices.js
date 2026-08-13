import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js?v=fleet-sync-20260714";

const DEFAULT_TERMS = "Full payment is due by the due date to confirm the reservation. The refundable security deposit is subject to inspection and deductions for excess mileage, fuel, tolls, late return, damage, or other charges permitted by the signed rental agreement. A valid driver license, proof of insurance, and driver approval are required. Changes and cancellations are governed by the signed rental agreement. This invoice does not replace the rental agreement.";
const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
const supabase = window.prestigeLuxorSupabase || (configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null);

const panelButton = document.querySelector('[data-crm-section="invoices"]');
const form = document.querySelector("[data-invoice-form]");
const emptyState = document.querySelector("[data-invoice-empty]");
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
const continueButton = document.querySelector("[data-continue-agreement]");

let invoices = [];
let quotes = [];
let currentInvoice = null;
let employeeRole = "staff";
let loaded = false;

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
  status.textContent = message;
  status.className = `admin-status ${type}`.trim();
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
  return { subtotal, deposit, total, paid, balance: Math.max(total - paid, 0) };
}

function renderTotals() {
  if (!form || form.hidden) return;
  const totals = totalsFromForm();
  const hold = form.elements.deposit_method.value === "authorization_hold" && totals.deposit > 0;
  totalCard.innerHTML = `
    <div><span>Rental subtotal</span><strong>${money(totals.subtotal)}</strong></div>
    ${hold ? `<div><span>Refundable authorization hold</span><strong>${money(totals.deposit)}</strong></div>` : ""}
    <div class="invoice-grand-total"><span>Invoice total</span><strong>${money(totals.total)}</strong></div>
    ${totals.paid ? `<div><span>Paid</span><strong>${money(totals.paid)}</strong></div><div><span>Balance</span><strong>${money(totals.balance)}</strong></div>` : ""}
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
  const query = String(search?.value || "").trim().toLowerCase();
  const filtered = invoices.filter((invoice) => [invoice.invoice_number, invoice.customer_name, invoice.vehicle_name].some((value) => String(value || "").toLowerCase().includes(query)));
  list.innerHTML = filtered.length ? filtered.map((invoice) => `
    <button class="invoice-list-item ${currentInvoice?.id === invoice.id ? "active" : ""}" type="button" data-select-invoice="${escapeHtml(invoice.id)}">
      <span><strong>${escapeHtml(invoice.invoice_number)}</strong><small>${escapeHtml(invoice.status.replaceAll("_", " "))}</small></span>
      <b>${escapeHtml(invoice.customer_name)}</b>
      <span><small>${escapeHtml(invoice.vehicle_name)}</small><strong>${money(invoice.total)}</strong></span>
    </button>
  `).join("") : `<p class="admin-empty">No matching invoices.</p>`;

  const open = invoices.filter((invoice) => !["paid", "void", "refunded"].includes(invoice.status));
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  kpis.innerHTML = `
    <article><span>Total invoices</span><strong>${invoices.length}</strong></article>
    <article><span>Open</span><strong>${open.length}</strong></article>
    <article><span>Outstanding</span><strong>${money(open.reduce((sum, item) => sum + Number(item.balance_due || 0), 0))}</strong></article>
    <article><span>Collected</span><strong>${money(paid.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0))}</strong></article>
  `;
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
  continueButton.hidden = !currentInvoice || currentInvoice?.status === "void";
}

function openInvoice(invoice = null) {
  currentInvoice = invoice;
  emptyState.hidden = true;
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
  sourceType.value = defaults.source_type || "manual";
  populateSources(defaults.source_id || "");
  title.textContent = invoice?.invoice_number || "New invoice";
  const state = invoice?.status || "draft";
  badge.textContent = state.replaceAll("_", " ");
  badge.className = `invoice-status-badge ${state}`;
  const locked = invoice?.status === "void";
  lockNote.textContent = locked ? "Voided invoices are read-only." : "Invoices can be edited after saving.";
  setFormLocked(locked);
  syncRentalDays();
  renderTotals();
  renderList();
}

async function loadSourceRecords() {
  const quoteResult = await supabase.from("quote_requests").select("*").order("created_at", { ascending: false }).limit(500);
  if (!quoteResult.error) quotes = quoteResult.data || [];
}

async function loadInvoices(force = false) {
  if (!configured || (loaded && !force)) return;
  try {
    setStatus("Loading invoices...");
    const [, data] = await Promise.all([loadSourceRecords(), invoiceApi("invoices")]);
    invoices = data.invoices || [];
    employeeRole = data.role || "staff";
    loaded = true;
    if (currentInvoice) currentInvoice = invoices.find((item) => item.id === currentInvoice.id) || null;
    renderList();
    if (currentInvoice) openInvoice(currentInvoice);
    setStatus(`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} loaded.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function saveDraft() {
  if (!form.reportValidity()) return null;
  const payload = payloadFromForm();
  const id = payload.id;
  const data = id
    ? await invoiceApi("invoices", { method: "PATCH", body: JSON.stringify(payload) })
    : await invoiceApi("invoices", { method: "POST", body: JSON.stringify(payload) });
  currentInvoice = data.invoice;
  await loadInvoices(true);
  openInvoice(currentInvoice);
  return currentInvoice;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setStatus("Saving invoice...");
    await saveDraft();
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
    const token = await sessionToken();
    const response = await fetch(`/api/invoice-pdf?id=${encodeURIComponent(invoice.id)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not download invoice.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.invoice_number}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
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
    document.querySelector('[data-crm-section="agreements"]')?.click();
    window.dispatchEvent(new CustomEvent("prestige:start-agreement", { detail: { invoice } }));
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    continueButton.disabled = false;
  }
});

paymentButton?.addEventListener("click", async () => {
  const amount = window.prompt("Amount received", String(currentInvoice.total || 0));
  if (amount === null) return;
  const reference = window.prompt("Stripe payment reference (optional)", currentInvoice.payment_reference || "");
  try {
    const data = await invoiceApi("invoices", { method: "POST", body: JSON.stringify({ action: "record_payment", id: currentInvoice.id, amount: Number(amount), payment_method: "stripe", payment_reference: reference || "" }) });
    currentInvoice = data.invoice;
    await loadInvoices(true);
    openInvoice(currentInvoice);
    setStatus("Payment recorded.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
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
    emptyState.hidden = false;
    await loadInvoices(true);
    setStatus(`${invoiceNumber} was deleted.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    deleteButton.disabled = false;
  }
});

newButton?.addEventListener("click", () => openInvoice());
search?.addEventListener("input", renderList);
form?.addEventListener("input", renderTotals);
depositMethod?.addEventListener("change", renderTotals);
rentalStartInput?.addEventListener("input", syncRentalDays);
rentalEndInput?.addEventListener("input", syncRentalDays);
sourceType?.addEventListener("change", () => populateSources());
sourceSelect?.addEventListener("change", applySource);
list?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-invoice]");
  if (button) openInvoice(invoices.find((item) => item.id === button.dataset.selectInvoice));
});
panelButton?.addEventListener("click", () => loadInvoices());
window.addEventListener("prestige:open-invoice", async (event) => {
  try {
    await loadInvoices(true);
    const invoice = invoices.find((item) => String(item.id) === String(event.detail?.id));
    if (!invoice) throw new Error("Invoice not found.");
    openInvoice(invoice);
  } catch (error) {
    setStatus(error.message, "error");
  }
});
supabase?.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    invoices = [];
    loaded = false;
    currentInvoice = null;
    renderList();
  } else if (session && document.querySelector('[data-section-panel="invoices"]')?.classList.contains("active")) {
    loadInvoices();
  }
});
