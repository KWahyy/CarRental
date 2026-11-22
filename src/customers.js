import { singleFlight, registerSection } from "./crm-navigation.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js?v=fleet-sync-20260714";

const root = document.querySelector("[data-customers-app]");
const navButton = document.querySelector('[data-crm-section="customers"]');
const refreshButton = document.querySelector("[data-refresh-customers]");
const supabase = window.prestigeLuxorSupabase || createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let loaded = false;
let customers = [];
let fleetPhotos = [];
let selectedKey = "";
let searchTerm = "";
let view = "all";
let showTotals = false;

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const emailKey = (value) => String(value || "").trim().toLowerCase();
const phoneKey = (value) => String(value || "").replace(/\D/g, "");
const nameKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const fullName = (record) => [record?.first_name ?? record?.customer_first_name, record?.last_name ?? record?.customer_last_name].filter(Boolean).join(" ").trim() || record?.customer_name || record?.driver_name || "Unnamed customer";
const contactEmail = (record) => record?.email || record?.customer_email || "";
const contactPhone = (record) => record?.phone || record?.customer_phone || "";
const activityDate = (record) => record?.signed_at || record?.paid_at || record?.updated_at || record?.created_at || record?.issue_date || record?.rental_start || "";
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PL";

function recordMatch(profile, record) {
  if (record.customer_id && profile.id && String(record.customer_id) === String(profile.id)) return true;
  const email = emailKey(contactEmail(record));
  const phone = phoneKey(contactPhone(record));
  if (email && profile.emailKey === email) return true;
  if (phone && profile.phoneKey === phone) return true;
  return !email && !phone && profile.nameKey === nameKey(fullName(record));
}

function blankProfile(record = {}) {
  const name = fullName(record);
  const email = contactEmail(record);
  const phone = contactPhone(record);
  return {
    id: record.id && record.first_name !== undefined ? record.id : null,
    key: record.id && record.first_name !== undefined ? `customer:${record.id}` : `contact:${emailKey(email) || phoneKey(phone) || nameKey(name)}`,
    firstName: record.first_name || record.customer_first_name || "",
    lastName: record.last_name || record.customer_last_name || "",
    name,
    email,
    phone,
    company: record.company || record.customer_company || "",
    leadSource: record.lead_source || "",
    notes: record.notes || "",
    marketingStatus: ["subscribed", "unsubscribed"].includes(record.marketing_consent_status) ? record.marketing_consent_status : "unknown",
    marketingSource: record.marketing_consent_source || "",
    marketingConsentAt: record.marketing_consent_at || "",
    marketingUnsubscribedAt: record.marketing_unsubscribed_at || "",
    marketingTags: Array.isArray(record.marketing_tags) ? record.marketing_tags : [],
    emailKey: emailKey(email),
    phoneKey: phoneKey(phone),
    nameKey: nameKey(name),
    createdAt: record.created_at || "",
    quotes: [], invoices: [], agreements: [], vehicles: [],
  };
}

function organize(rows) {
  const profiles = rows.customerRows.map(blankProfile);
  const attach = (record, type) => {
    let profile = profiles.find((item) => recordMatch(item, record));
    if (!profile) {
      profile = blankProfile(record);
      profiles.push(profile);
    }
    profile[type].push(record);
    if (profile.name === "Unnamed customer") profile.name = fullName(record);
    if (!profile.email) profile.email = contactEmail(record);
    if (!profile.phone) profile.phone = contactPhone(record);
    if (!profile.company) profile.company = record.customer_company || "";
    if (!profile.leadSource) profile.leadSource = record.lead_source || "";
    profile.emailKey = emailKey(profile.email);
    profile.phoneKey = phoneKey(profile.phone);
    profile.nameKey = nameKey(profile.name);
  };
  rows.quoteRows.forEach((record) => attach(record, "quotes"));
  rows.invoiceRows.forEach((record) => attach(record, "invoices"));
  rows.agreementRows.forEach((record) => attach(record, "agreements"));

  return profiles.map((profile) => {
    const records = [...profile.quotes, ...profile.invoices, ...profile.agreements];
    const vehicles = [...new Set(records.map((record) => record.vehicle_name).filter(Boolean))];
    const paid = profile.invoices.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0);
    const signed = profile.agreements.filter((agreement) => agreement.status !== "draft" && agreement.status !== "cancelled").length;
    const lastActivity = records.map(activityDate).filter(Boolean).sort().at(-1) || profile.createdAt;
    return { ...profile, vehicles, paid, signed, lastActivity, recordCount: records.length };
  }).filter((profile) => profile.id || profile.recordCount).sort((a, b) => String(b.lastActivity).localeCompare(String(a.lastActivity)));
}

async function fetchRows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} could not be loaded: ${error.message}`);
  return data || [];
}

const load = singleFlight(async function (force = false, preferredKey = "") {
  if (loaded && !force) return;
  if (!loaded) root.innerHTML = '<div class="crm-loading-state">Organizing customer records…</div>';
  try {
    const [customerRows, quoteRows, invoiceRows, agreementRows, carResult] = await Promise.all([
      fetchRows(supabase.from("crm_customers").select("*").order("updated_at", { ascending: false }).limit(1000), "Customers"),
      fetchRows(supabase.from("quotes").select("*").order("created_at", { ascending: false }).limit(1000), "Quotes"),
      fetchRows(supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(1000), "Invoices"),
      fetchRows(supabase.from("rental_agreements").select("*").order("created_at", { ascending: false }).limit(1000), "Agreements"),
      supabase.from("cars").select("id,name,image_url").limit(1000),
    ]);
    fleetPhotos = carResult.data || [];
    customers = organize({ customerRows, quoteRows, invoiceRows, agreementRows });
    loaded = true;
    selectedKey = preferredKey && customers.some((item) => item.key === preferredKey) ? preferredKey : selectedKey;
    if (!customers.some((item) => item.key === selectedKey)) selectedKey = customers[0]?.key || "";
    render();
  } catch (error) {
    root.innerHTML = `<div class="customers-error"><strong>Customers need attention</strong><p>${escapeHtml(error.message)}</p><button class="secondary-button" type="button" data-customer-retry>Retry</button></div>`;
  }
});

function visibleCustomers() {
  const query = searchTerm.trim().toLowerCase();
  return customers.filter((customer) => {
    const matchesSearch = !query || [customer.name, customer.email, customer.phone, customer.company, customer.vehicles.join(" ")].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesView = view === "all" || (view === "renters" && customer.agreements.length) || (view === "repeat" && customer.agreements.length > 1) || (view === "leads" && !customer.agreements.length) || (view === "email_ready" && customer.marketingStatus === "subscribed" && Boolean(customer.email));
    return matchesSearch && matchesView;
  });
}

function kpi(label, value, note) {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}

function renderList() {
  const visible = visibleCustomers();
  return `<aside class="customers-directory-card">
    <div class="customers-toolbar"><header class="desk-subhead"><h3>Directory</h3><span>${customers.length}</span></header>
      <label><span>Search customers</span><input type="search" value="${escapeHtml(searchTerm)}" placeholder="Name, phone, email, or vehicle" data-customer-search></label>
      <div class="customer-view-tabs" role="group" aria-label="Customer views">${[["all","All"],["renters","Renters"],["repeat","Repeat"],["leads","Leads"],["email_ready","Email ready"]].map(([id,label]) => `<button class="${view === id ? "active" : ""}" type="button" data-customer-view="${id}" aria-pressed="${view === id}">${label}</button>`).join("")}</div>
    </div>
    <div class="customers-list">${visible.length ? visible.map((customer) => `<button class="customer-list-item ${customer.key === selectedKey ? "active" : ""}" type="button" data-customer-key="${escapeHtml(customer.key)}" aria-pressed="${customer.key === selectedKey}"><span class="customer-avatar">${escapeHtml(initials(customer.name))}</span><span class="customer-list-copy"><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.email || customer.phone || "No contact details")}</small></span><span class="customer-list-meta"><strong>${customer.recordCount}</strong><small>records</small></span></button>`).join("") : '<div class="customers-list-empty"><strong>No customers found</strong><span>Try another search or view.</span></div>'}</div>
  </aside>`;
}

function statusBadge(status = "draft") {
  return `<span class="customer-record-status ${escapeHtml(status)}">${escapeHtml(String(status).replaceAll("_", " "))}</span>`;
}

function recordRow(type, record) {
  const number = type === "quote" ? record.quote_number : type === "invoice" ? record.invoice_number : record.agreement_number;
  const value = type === "quote" ? record.rental_total : type === "invoice" ? record.total : record.rental_total || record.quote_total;
  const date = type === "invoice" ? record.issue_date : record.rental_start_at || record.rental_start || record.start_at || record.created_at;
  return `<button class="customer-record-row" type="button" data-customer-record="${type}" data-record-id="${record.id}"><span class="customer-record-kind">${escapeHtml(type)}</span><span><strong>${escapeHtml(number || "Record")}</strong><small>${escapeHtml(record.vehicle_name || "Vehicle not selected")} · ${escapeHtml(dateLabel(date))}</small></span><span><strong>${money(value)}</strong>${statusBadge(record.status)}</span><b aria-hidden="true">→</b></button>`;
}

function renderDetail(customer) {
  if (!customer) return '<section class="customer-profile-empty"><strong>Select a customer</strong><span>Choose a customer to see their complete CRM history.</span></section>';
  const marketingLabel = customer.marketingStatus === "subscribed" ? "Opted in" : customer.marketingStatus === "unsubscribed" ? "Opted out" : "Not recorded";
  const marketingNote = customer.marketingStatus === "subscribed" ? "Eligible for future marketing emails" : "Do not include in marketing sends";
  const records = [
    ...customer.quotes.map((record) => ({ type: "quote", record })),
    ...customer.invoices.map((record) => ({ type: "invoice", record })),
    ...customer.agreements.map((record) => ({ type: "agreement", record })),
  ].sort((a, b) => String(activityDate(b.record)).localeCompare(String(activityDate(a.record))));
  const latest = records.find(item => item.record.vehicle_name);
  let vehiclePanel = "";
  if (latest) {
    const {record, type} = latest;
    const car = fleetPhotos.find(item => item.id === record.vehicle_id) || fleetPhotos.find(item => nameKey(item.name) === nameKey(record.vehicle_name));
    const image = record.vehicle_image_url || car?.image_url || "";
    vehiclePanel = `<div class="customer-vehicle-focus">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(record.vehicle_name)}" loading="lazy">` : ""}<div><small>Latest rental record</small><h4>${escapeHtml(record.vehicle_name)}</h4><button type="button" data-customer-record="${type}" data-record-id="${escapeHtml(record.id)}">View ${type} <span aria-hidden="true">→</span></button></div></div>`;
  }
  return `<section class="customer-profile" aria-label="Selected customer" tabindex="-1">
    <header class="customer-profile-hero"><div><span>Customer profile</span><h3>${escapeHtml(customer.name)}</h3><p>${escapeHtml(customer.company || customer.leadSource || "Prestige Luxor client")}</p></div><div class="customer-contact-actions"><button class="secondary-button" type="button" data-customer-create-quote>Create quote <span aria-hidden="true">→</span></button></div></header>
    ${vehiclePanel}
    <div class="customer-profile-grid">
      <div class="customer-history-column">
        <section class="customer-profile-card"><header><div><span>Rental history</span><h4>Customer records</h4></div><strong>${records.length}</strong></header><div class="customer-records">${records.length ? records.map(({ type, record }) => recordRow(type, record)).join("") : '<div class="customer-card-empty">No linked records yet.</div>'}</div></section>
        <section class="customer-profile-card"><header><div><span>Vehicles</span><h4>Previous selections</h4></div><strong>${customer.vehicles.length}</strong></header><div class="customer-vehicle-tags">${customer.vehicles.length ? customer.vehicles.map((vehicle) => `<span>${escapeHtml(vehicle)}</span>`).join("") : '<div class="customer-card-empty">No vehicles recorded yet.</div>'}</div></section>
        <form class="customer-profile-card customer-marketing-card" data-customer-marketing-form>
          <input type="hidden" name="customer_key" value="${escapeHtml(customer.key)}">
          <header><div><span>Future email marketing</span><h4>Permission & interests</h4></div></header>
          <p class="customer-marketing-explainer">${marketingNote}. Rental and booking emails are separate from marketing permission.</p>
          <label>Email address<input name="marketing_email" type="email" autocomplete="email" value="${escapeHtml(customer.email)}" placeholder="customer@example.com"></label>
          <label>Marketing email status<select name="marketing_status" data-marketing-status>
            <option value="unknown" ${customer.marketingStatus === "unknown" ? "selected" : ""}>Not recorded</option>
            <option value="subscribed" ${customer.marketingStatus === "subscribed" ? "selected" : ""}>Opted in</option>
            <option value="unsubscribed" ${customer.marketingStatus === "unsubscribed" ? "selected" : ""}>Opted out</option>
          </select></label>
          <label>How permission was obtained<input name="marketing_source" value="${escapeHtml(customer.marketingSource)}" placeholder="Example: website form, dated request"></label>
          <label>Interests for future segments<input name="marketing_tags" value="${escapeHtml(customer.marketingTags.join(", "))}" placeholder="Example: convertibles, weddings"></label>
          <p class="customer-marketing-date">${customer.marketingStatus === "subscribed" && customer.marketingConsentAt ? `Opted in ${escapeHtml(dateLabel(customer.marketingConsentAt))}` : customer.marketingStatus === "unsubscribed" && customer.marketingUnsubscribedAt ? `Opted out ${escapeHtml(dateLabel(customer.marketingUnsubscribedAt))}` : "No marketing permission on file"}</p>
          <div class="customer-marketing-save"><span data-customer-marketing-message role="status">${customer.id ? "Saved with customer profile" : "A profile will be created when you save"}</span><button class="primary-button compact" type="submit">Save preferences</button></div>
        </form>
      </div>
      <aside>
        <section class="customer-profile-card customer-contact-card"><header><div><span>Contact</span><h4>Customer details</h4></div></header><dl><div><dt>Phone</dt><dd>${customer.phone ? `<a data-desk-contact-link href="tel:${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}</a>` : "—"}</dd></div><div><dt>Email</dt><dd>${customer.email ? `<a data-desk-contact-link href="mailto:${escapeHtml(customer.email)}">${escapeHtml(customer.email)}</a>` : "—"}</dd></div><div><dt>Company</dt><dd>${escapeHtml(customer.company || "—")}</dd></div><div><dt>Lead source</dt><dd>${escapeHtml(customer.leadSource || "—")}</dd></div><div><dt>Last activity</dt><dd>${escapeHtml(dateLabel(customer.lastActivity))}</dd></div></dl></section>
        <form class="customer-profile-card customer-notes-card" data-customer-notes-form><input type="hidden" name="customer_key" value="${escapeHtml(customer.key)}"><header><div><span>Staff only</span><h4>Concierge notes</h4></div></header><textarea name="notes" aria-label="Concierge notes" rows="4" placeholder="Preferences, communication details, or important context…">${escapeHtml(customer.notes)}</textarea><div><span data-customer-note-status>${customer.id ? "Saved with customer profile" : "A profile will be created when you save"}</span><button class="primary-button compact" type="submit">Save notes</button></div></form>
      </aside>
    </div>
  </section>`;
}

function render() {
  const repeat = customers.filter((customer) => customer.agreements.length > 1).length;
  const renters = customers.filter((customer) => customer.agreements.length).length;
  const paid = customers.reduce((sum, customer) => sum + customer.paid, 0);
  const emailReady = customers.filter((customer) => customer.marketingStatus === "subscribed" && customer.email).length;
  const visible = visibleCustomers();
  if (!visible.some((customer) => customer.key === selectedKey)) selectedKey = visible[0]?.key || "";
  const selected = visible.find((customer) => customer.key === selectedKey);
  root.innerHTML = `<div class="customers-layout">${renderList()}${renderDetail(selected)}</div><details class="directory-totals" ${showTotals ? "open" : ""}><summary>Directory totals</summary><div class="customers-kpis">${kpi("Total customers", customers.length, "Unique CRM contacts")}${kpi("Rental customers", renters, "With an agreement")}${kpi("Repeat customers", repeat, "More than one agreement")}${kpi("Payments recorded", money(paid), "Across customer invoices")}</div><div class="customer-marketing-overview"><div><span>Email marketing readiness</span><strong>${emailReady} contact${emailReady === 1 ? "" : "s"} opted in</strong><p>Only customers with a recorded opt-in and an email address qualify for future campaigns.</p></div><button type="button" data-customer-email-ready>View eligible contacts <span aria-hidden="true">→</span></button></div></details>`;
}

function openRecord(type, id) {
  const section = type === "quote" ? "requests" : type === "invoice" ? "invoices" : "agreements";
  document.querySelector(`[data-crm-section="${section}"]`)?.click();
  window.dispatchEvent(new CustomEvent(`prestige:open-${type}`, { detail: { id } }));
}

async function saveNotes(form) {
  const customer = customers.find((item) => item.key === form.elements.customer_key.value);
  if (!customer) return;
  const status = form.querySelector("[data-customer-note-status]");
  const button = form.querySelector('button[type="submit"]');
  const notes = form.elements.notes.value.trim();
  button.disabled = true;
  status.textContent = "Saving…";
  try {
    let saved;
    if (customer.id) {
      const result = await supabase.from("crm_customers").update({ notes }).eq("id", customer.id).select().single();
      if (result.error) throw result.error;
      saved = result.data;
    } else {
      const parts = customer.name.split(/\s+/).filter(Boolean);
      const result = await supabase.from("crm_customers").insert({ first_name: parts.shift() || "", last_name: parts.join(" "), email: customer.email, phone: customer.phone, company: customer.company, lead_source: customer.leadSource, notes }).select().single();
      if (result.error) throw result.error;
      saved = result.data;
    }
    status.textContent = "Notes saved.";
    await load(true, `customer:${saved.id}`);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}


async function saveMarketing(form) {
  const customer = customers.find((item) => item.key === form.elements.customer_key.value);
  if (!customer) return;
  const status = form.elements.marketing_status.value;
  const email = form.elements.marketing_email.value.trim();
  const source = form.elements.marketing_source.value.trim();
  const tags = [...new Set(form.elements.marketing_tags.value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
  const message = form.querySelector("[data-customer-marketing-message]");
  const button = form.querySelector('button[type="submit"]');
  if (email && !form.elements.marketing_email.checkValidity()) { message.textContent = "Enter a valid email address."; form.elements.marketing_email.focus(); return; }
  if (status === "subscribed" && !email) { message.textContent = "Add an email address before recording an opt-in."; form.elements.marketing_email.focus(); return; }
  if (status === "subscribed" && !source) { message.textContent = "Record how this customer opted in."; form.elements.marketing_source.focus(); return; }
  if (customer.marketingStatus === "unsubscribed" && status === "unknown") { message.textContent = "Keep this contact opted out until they give new permission."; return; }
  if (status === "subscribed" && emailKey(email) !== emailKey(customer.email) && customer.marketingStatus === "subscribed") { message.textContent = "Save the new address as Not recorded, then record its own opt-in."; return; }
  if (status === "subscribed" && customer.marketingStatus === "unsubscribed" && source === customer.marketingSource) { message.textContent = "Record a new opt-in source before resubscribing."; form.elements.marketing_source.focus(); return; }
  const now = new Date().toISOString();
  const fields = {
    email,
    marketing_consent_status: status,
    marketing_consent_source: source,
    marketing_consent_at: status === "subscribed" ? (customer.marketingStatus === "subscribed" ? customer.marketingConsentAt || now : now) : null,
    marketing_unsubscribed_at: status === "unsubscribed" ? (customer.marketingStatus === "unsubscribed" ? customer.marketingUnsubscribedAt || now : now) : null,
    marketing_tags: tags,
  };
  button.disabled = true;
  message.textContent = "Saving…";
  try {
    let result;
    if (customer.id) result = await supabase.from("crm_customers").update(fields).eq("id", customer.id).select().single();
    else {
      const parts = customer.name.split(/\s+/).filter(Boolean);
      result = await supabase.from("crm_customers").insert({
        first_name: parts.shift() || "", last_name: parts.join(" "),
        phone: customer.phone, company: customer.company, lead_source: customer.leadSource,
        notes: customer.notes, ...fields,
      }).select().single();
    }
    if (result.error) throw result.error;
    await load(true, `customer:${result.data.id}`);
    root.querySelector("[data-customer-marketing-message]").textContent = "Preferences saved.";
  } catch (error) {
    message.textContent = /marketing_consent_status|marketing_tags|schema cache/i.test(error.message) ? "Marketing fields need the customer-marketing-readiness SQL update." : error.message;
  } finally { button.disabled = false; }
}

root?.addEventListener("click", (event) => {
  if (event.target.closest("[data-customer-retry]")) return load(true);
  if (event.target.closest("[data-customer-email-ready]")) { view = "email_ready"; return render(); }
  const viewButton = event.target.closest("[data-customer-view]");
  if (viewButton) { view = viewButton.dataset.customerView; return render(); }
  const customerButton = event.target.closest("[data-customer-key]");
  if (customerButton) { selectedKey = customerButton.dataset.customerKey; render();
    const profile = root.querySelector(".customer-profile");
    if (window.matchMedia("(max-width: 700px)").matches) { profile?.focus({preventScroll:true}); profile?.scrollIntoView({block:"start"}); }
    else root.querySelector('[data-customer-key][aria-pressed="true"]')?.focus({preventScroll:true});
    return;
  }
  if (event.target.closest("[data-customer-create-quote]")) {
    const customer = customers.find(item => item.key === selectedKey);
    if (!customer) return;
    const names = customer.name.split(/\s+/);
    document.querySelector('[data-crm-section="requests"]').click();
    window.dispatchEvent(new CustomEvent("prestige:new-customer-quote", {detail:{
      customer_id:customer.id || "", first_name:customer.firstName || names.shift(), last_name:customer.lastName || (customer.firstName ? "" : names.join(" ")),
      phone:customer.phone, email:customer.email, company:customer.company
    }}));
    return;
  }
  const recordButton = event.target.closest("[data-customer-record]");
  if (recordButton) openRecord(recordButton.dataset.customerRecord, recordButton.dataset.recordId);
});

root?.addEventListener("toggle", event => {
  if (event.target.matches(".directory-totals") && event.target.isConnected) showTotals = event.target.open;
}, true);

root?.addEventListener("input", (event) => {
  if (!event.target.matches("[data-customer-search]")) return;
  searchTerm = event.target.value;
  const cursor = event.target.selectionStart;
  render();
  const next = root.querySelector("[data-customer-search]");
  next?.focus();
  next?.setSelectionRange(cursor, cursor);
});

root?.addEventListener("submit", (event) => {
  if (event.target.matches("[data-customer-marketing-form]")) { event.preventDefault(); saveMarketing(event.target); return; }
  if (event.target.matches("[data-customer-notes-form]")) { event.preventDefault(); saveNotes(event.target); }
});

navButton?.addEventListener("click", () => load());
refreshButton?.addEventListener("click", () => load(true, selectedKey));
supabase.auth.onAuthStateChange((event, session) => {
  if (!session) { loaded = false; customers = []; selectedKey = ""; }
  else if (event === "SIGNED_IN" && !loaded && document.querySelector('[data-section-panel="customers"]')?.classList.contains("active")) load();
});
setTimeout(() => {
  if (!loaded && document.querySelector('[data-section-panel="customers"]')?.classList.contains("active")) load();
}, 800);

registerSection("customers", load);

window.addEventListener("prestige:open-customer", async ({detail}) => {
  if (!detail?.id) return;
  await load();
  const customer = customers.find(row => String(row.id) === String(detail.id));
  if (!customer) return;
  view = "all"; searchTerm = ""; selectedKey = customer.key; render();
  root.querySelector(".customer-profile")?.scrollIntoView({block:"start"});
});
const newDialog = document.querySelector("[data-customer-create-dialog]");
const newForm = newDialog.querySelector("form");
const newStatus = newForm.querySelector("[role=status]");
const addButton = document.querySelector("[data-new-customer]");
addButton.addEventListener("click", () => {
  newForm.reset(); newStatus.textContent = ""; newDialog.showModal(); newForm.elements.first_name.focus();
});
newDialog.querySelector("[data-cancel-new-customer]").onclick = () => newDialog.close();
newForm.addEventListener("submit", async event => {
  event.preventDefault();
  const values = Object.fromEntries([...new FormData(newForm)].map(([key,value]) => [key,String(value).trim()]));
  if (!values.first_name || !(values.email || phoneKey(values.phone))) {
    newStatus.textContent = "Enter a first name and at least one contact method.";
    return;
  }
  const submit = newForm.querySelector("[type=submit]");
  if (submit.disabled) return;
  submit.disabled = true;
  newStatus.textContent = "Saving customer…";
  try {
    const {data,error} = await supabase.from("crm_customers").insert(values).select("id").single();
    if (error) throw error;
    searchTerm = ""; view = "all";
    await load(true, "customer:" + data.id);
    newDialog.close();
    root.querySelector(".customer-profile")?.focus();
  } catch(error) {
    newStatus.textContent = error.code === "23505" ? "A customer already uses that email or phone. Find them in the directory." : "Could not save this customer. " + error.message;
  } finally { submit.disabled = false; }
});
