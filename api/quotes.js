import { clean, db, json, readBody, requireEmployee, setCors } from "./_invoice-core.js";
import { addQuoteEvent, calculateQuoteTotals, expireQuotes, getQuote, normalizeQuote, quoteId, quoteUrl } from "./_quote-core.js";
import { assertVehicleAvailable } from "./_fleet-core.js";

const LOST_REASONS = ["Price", "Vehicle unavailable", "Customer stopped responding", "Chose competitor", "Dates changed", "Insurance issue", "Age requirement", "Deposit requirement", "Other"];

function customerName(customer) {
  return [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim();
}

function dateOnly(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

function rentalDays(start, end) {
  const delta = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(delta) ? Math.max(Math.ceil(delta / 86400000), 1) : 1;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  const a = new Date(aStart).getTime(), b = new Date(aEnd).getTime(), c = new Date(bStart).getTime(), d = new Date(bEnd).getTime();
  return [a, b, c, d].every(Number.isFinite) && a < d && b > c;
}

async function vehicleRecord(id, token) {
  const rows = await db(`cars?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, token);
  if (!rows?.[0]) throw Object.assign(new Error("Select a vehicle from the active fleet."), { status: 400 });
  const partners = await db(`car_partners?car_id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, token).catch(() => []);
  return { ...rows[0], partner: partners?.[0] || null };
}

async function ensureAvailable(vehicle, startAt, endAt, token, excludeReservationId = "") {
  if (!vehicle?.id || !startAt || !endAt) return;
  await assertVehicleAvailable(vehicle.id, startAt, endAt, token, { excludeAgreementId: excludeReservationId });
}

async function findOrCreateCustomer(payload, userId, token) {
  if (payload.customer_id) {
    const rows = await db(`crm_customers?id=eq.${encodeURIComponent(payload.customer_id)}&select=*&limit=1`, {}, token);
    if (rows?.[0]) return rows[0];
  }
  const email = clean(payload.customer_email, 240).toLowerCase();
  const phone = clean(payload.customer_phone, 80);
  const clauses = [];
  if (email) clauses.push(`email.eq.${encodeURIComponent(email)}`);
  if (phone) clauses.push(`phone.eq.${encodeURIComponent(phone)}`);
  if (clauses.length) {
    const existing = await db(`crm_customers?or=(${clauses.join(",")})&select=*&limit=1`, {}, token);
    if (existing?.[0]) return existing[0];
  }
  const rows = await db("crm_customers", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      first_name: clean(payload.customer_first_name, 100), last_name: clean(payload.customer_last_name, 100),
      phone, email, company: clean(payload.customer_company, 180), lead_source: clean(payload.lead_source, 100),
      notes: clean(payload.customer_notes, 3000), created_by: userId,
    }),
  }, token);
  return rows[0];
}

async function preparedPayload(body, userId, token, current = {}) {
  const normalized = normalizeQuote(body, current);
  if (!normalized.vehicle_id || !normalized.start_at || !normalized.end_at) throw Object.assign(new Error("Vehicle, start, and end are required."), { status: 400 });
  if (new Date(normalized.end_at) <= new Date(normalized.start_at)) throw Object.assign(new Error("Rental end must be after rental start."), { status: 400 });
  const [customer, vehicle] = await Promise.all([findOrCreateCustomer(normalized, userId, token), vehicleRecord(normalized.vehicle_id, token)]);
  if (!customerName(customer)) throw Object.assign(new Error("Customer name is required."), { status: 400 });
  if (!customer.phone && !customer.email) throw Object.assign(new Error("Add a phone number or email for the customer."), { status: 400 });
  await ensureAvailable(vehicle, normalized.start_at, normalized.end_at, token, current.reservation_id);
  const { customer_notes: _customerNotes, ...quotePayload } = normalized;
  return {
    ...quotePayload,
    customer_id: customer.id,
    customer_first_name: customer.first_name || normalized.customer_first_name,
    customer_last_name: customer.last_name || normalized.customer_last_name,
    customer_phone: customer.phone || normalized.customer_phone,
    customer_email: customer.email || normalized.customer_email,
    customer_company: customer.company || normalized.customer_company,
    vehicle_name: vehicle.name,
    vehicle_image_url: vehicle.image_url || "",
    ownership_type: vehicle.partner?.partner_name ? "partner" : "prestige",
  };
}

function emailEscape(value, max = 5000) {
  return clean(value, max)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailUrl(value) {
  try {
    const url = new URL(clean(value, 1000));
    return ["http:", "https:"].includes(url.protocol) ? emailEscape(url.href, 1000) : "https://www.prestigeluxor.com";
  } catch {
    return "https://www.prestigeluxor.com";
  }
}

function emailDate(value, options = {}) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "To be confirmed" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...options });
}

function emailMoney(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export function quoteEmailHtml(quote, publicUrl) {
  const firstName = emailEscape(quote.customer_first_name || "there", 100);
  const quoteNumber = emailEscape(quote.quote_number || "Private quote", 80);
  const vehicle = emailEscape(quote.vehicle_name || "Vehicle to be confirmed", 240);
  const startDate = emailEscape(emailDate(quote.start_at), 80);
  const endDate = emailEscape(emailDate(quote.end_at), 80);
  const total = emailEscape(emailMoney(quote.rental_total), 80);
  const amountRequired = Number(quote.amount_required || 0);
  const requiredLabel = amountRequired > 0 ? emailEscape(emailMoney(amountRequired), 80) : "Confirmed on acceptance";
  const secureUrl = emailUrl(publicUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${quoteNumber} · Prestige Luxor</title>
    <style>
      @media only screen and (max-width:620px) {
        .email-shell { padding:0 !important; }
        .email-card { border-left:0 !important; border-right:0 !important; }
        .email-pad { padding-left:22px !important; padding-right:22px !important; }
        .email-title { font-size:32px !important; line-height:37px !important; }
        .detail-cell { display:block !important; width:100% !important; padding:0 0 18px !important; }
        .summary-label, .summary-value { display:block !important; width:100% !important; text-align:left !important; }
        .summary-value { padding-top:5px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#070707;color:#ffffff;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your ${vehicle} quote is ready to review.</div>
    <div class="email-shell" style="background:#070707;padding:32px 14px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr><td align="center">
          <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:660px;border-collapse:separate;background:#111111;border:1px solid #343434;">
            <tr>
              <td class="email-pad" style="padding:24px 32px;border-bottom:1px solid #343434;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle"><a href="https://www.prestigeluxor.com" style="text-decoration:none;"><img src="https://www.prestigeluxor.com/assets/prestige-luxor-logo-light.png" width="1684" alt="Prestige Luxor" style="display:block;width:158px;height:auto;border:0;"></a></td>
                    <td align="right" valign="middle"><span style="display:inline-block;border:1px solid #5a5a5a;padding:8px 11px;color:#ffffff;font-size:10px;line-height:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">${quoteNumber}</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:46px 32px 38px;">
                <div style="color:#a7a7a7;font-size:11px;line-height:16px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Private rental proposal</div>
                <h1 class="email-title" style="margin:13px 0 0;color:#ffffff;font-size:42px;line-height:47px;letter-spacing:-1px;">${firstName}, your quote<br>is ready.</h1>
                <p style="margin:18px 0 0;max-width:520px;color:#b8b8b8;font-size:16px;line-height:26px;">Review the vehicle, rental details, pricing, and reservation terms prepared for you by Prestige Luxor.</p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:0 32px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#191919;border:1px solid #3b3b3b;">
                  <tr><td style="padding:24px 24px 22px;">
                    <div style="color:#929292;font-size:10px;line-height:15px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Selected vehicle</div>
                    <div style="margin-top:7px;color:#ffffff;font-size:25px;line-height:31px;font-weight:800;">${vehicle}</div>
                  </td></tr>
                  <tr><td style="padding:0 24px;"><div style="height:1px;background:#3b3b3b;"></div></td></tr>
                  <tr><td style="padding:22px 24px 5px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="detail-cell" width="50%" valign="top" style="padding:0 12px 18px 0;"><div style="color:#929292;font-size:10px;line-height:15px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;">Rental starts</div><div style="margin-top:5px;color:#ffffff;font-size:16px;line-height:23px;font-weight:700;">${startDate}</div></td>
                        <td class="detail-cell" width="50%" valign="top" style="padding:0 0 18px 12px;"><div style="color:#929292;font-size:10px;line-height:15px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;">Rental ends</div><div style="margin-top:5px;color:#ffffff;font-size:16px;line-height:23px;font-weight:700;">${endDate}</div></td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:0 32px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #3b3b3b;border-bottom:1px solid #3b3b3b;">
                  <tr><td class="summary-label" width="50%" style="padding:20px 0;color:#a5a5a5;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">Rental total</td><td class="summary-value" width="50%" align="right" style="padding:20px 0;color:#ffffff;font-size:27px;line-height:32px;font-weight:800;">${total}</td></tr>
                  <tr><td class="summary-label" width="50%" style="padding:0 0 20px;color:#a5a5a5;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">Required to reserve</td><td class="summary-value" width="50%" align="right" style="padding:0 0 20px;color:#ffffff;font-size:15px;line-height:22px;font-weight:700;">${requiredLabel}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:0 32px 42px;">
                <a href="${secureUrl}" style="display:block;background:#ffffff;border:1px solid #ffffff;padding:17px 20px;color:#080808;font-size:13px;line-height:18px;font-weight:900;letter-spacing:1px;text-align:center;text-decoration:none;text-transform:uppercase;">Review &amp; accept quote</a>
                <p style="margin:18px 0 0;color:#868686;font-size:12px;line-height:19px;text-align:center;">This private link is unique to your quote. Vehicle availability is confirmed when the required reservation payment is received.</p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:22px 32px;background:#0a0a0a;border-top:1px solid #343434;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr><td style="color:#777777;font-size:11px;line-height:18px;">Prestige Luxor · Los Angeles &amp; Orange County</td><td align="right" style="font-size:11px;line-height:18px;"><a href="tel:+19496200024" style="color:#ffffff;text-decoration:none;">(949) 620-0024</a></td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </div>
  </body>
</html>`;
}

export function quoteEmailText(quote, publicUrl) {
  return [
    `Prestige Luxor private quote · ${clean(quote.quote_number, 80)}`,
    "",
    `${clean(quote.customer_first_name, 100) || "Your quote"}, your quote is ready.`,
    `Vehicle: ${clean(quote.vehicle_name, 240) || "To be confirmed"}`,
    `Rental dates: ${emailDate(quote.start_at)} – ${emailDate(quote.end_at)}`,
    `Rental total: ${emailMoney(quote.rental_total)}`,
    `Required to reserve: ${Number(quote.amount_required || 0) > 0 ? emailMoney(quote.amount_required) : "Confirmed on acceptance"}`,
    "",
    `Review and accept your quote: ${clean(publicUrl, 1000)}`,
    "",
    "This private link is unique to your quote. Vehicle availability is confirmed when the required reservation payment is received.",
    "Prestige Luxor · (949) 620-0024",
  ].join("\n");
}

async function sendQuoteEmail(quote, publicUrl) {
  if (!quote.customer_email) return { delivered: false, reason: "No customer email; copy the secure link to send manually." };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { delivered: false, reason: "Email delivery is not configured; copy the secure link to send manually." };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.QUOTE_FROM_EMAIL || "Prestige Luxor <onboarding@resend.dev>",
      to: [quote.customer_email],
      subject: `${quote.quote_number} · Your Prestige Luxor quote`,
      html: quoteEmailHtml(quote, publicUrl),
      text: quoteEmailText(quote, publicUrl),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || "Quote email could not be delivered."), { status: 502 });
  return { delivered: true, id: data.id };
}

async function createRevision(current, userId, token) {
  await db("quote_revisions", {
    method: "POST", headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({ quote_id: current.id, revision: current.revision, rental_total: current.rental_total, snapshot: current, created_by: userId }),
  }, token);
}

export async function convertQuote(quote, userId, token) {
  if (quote.reservation_id) {
    const reservation = await db(`rental_agreements?id=eq.${encodeURIComponent(quote.reservation_id)}&select=*&limit=1`, {}, token);
    return { quote, reservation: reservation?.[0] || null, invoice: quote.invoice_id ? (await db(`invoices?id=eq.${encodeURIComponent(quote.invoice_id)}&select=*&limit=1`, {}, token))?.[0] : null, existing: true };
  }
  if (!["accepted", "deposit_pending"].includes(quote.status)) throw Object.assign(new Error("Accept the quote before converting it to a reservation."), { status: 409 });
  if (Number(quote.amount_required || 0) > Number(quote.deposit_paid_amount || 0)) throw Object.assign(new Error("Record the required reservation payment before conversion."), { status: 409 });
  const vehicle = await vehicleRecord(quote.vehicle_id, token);
  await ensureAvailable(vehicle, quote.start_at, quote.end_at, token);
  const days = rentalDays(quote.start_at, quote.end_at);
  const totals = calculateQuoteTotals(quote);
  const baseAmount = quote.rate_type === "flat" ? Number(quote.rate_amount || 0) : Number(quote.rate_amount || 0) * Number(quote.duration_value || 1);
  const delivery = (quote.line_items || []).filter((item) => /delivery|pickup/i.test(item.description || "")).reduce((sum, item) => sum + Number(item.amount || Number(item.quantity || 0) * Number(item.rate || 0)), 0);
  const otherItems = (quote.line_items || []).reduce((sum, item) => sum + Number(item.amount || Number(item.quantity || 0) * Number(item.rate || 0)), 0) - delivery;
  let invoice = (await db(`invoices?quote_id=eq.${encodeURIComponent(quote.id)}&select=*&limit=1`, {}, token))?.[0];
  if (!invoice) {
    const rows = await db("invoices", {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
        quote_id: quote.id, source_type: "quote", source_id: quote.id, status: Number(quote.deposit_paid_amount) >= Number(quote.rental_total) ? "paid" : Number(quote.deposit_paid_amount) > 0 ? "partially_paid" : "finalized",
        issue_date: new Date().toISOString().slice(0, 10), due_date: dateOnly(quote.start_at), valid_through: dateOnly(quote.expires_at),
        customer_name: [quote.customer_first_name, quote.customer_last_name].filter(Boolean).join(" "), customer_email: quote.customer_email, customer_phone: quote.customer_phone,
        vehicle_name: quote.vehicle_name, rental_start: dateOnly(quote.start_at), rental_end: dateOnly(quote.end_at), rental_days: days,
        daily_rate: baseAmount / days, delivery_fee: delivery, addons_total: otherItems + Number(quote.tax_amount || 0), discount: quote.discount_amount,
        refundable_deposit: quote.security_deposit, deposit_method: "authorization_hold", amount_paid: quote.deposit_paid_amount,
        notes: `Converted from ${quote.quote_number}.\n${quote.customer_message || ""}`.trim(), created_by: userId,
      })
    }, token);
    invoice = rows[0];
  }
  let reservation = (await db(`rental_agreements?quote_id=eq.${encodeURIComponent(quote.id)}&select=*&limit=1`, {}, token))?.[0];
  if (!reservation) {
    const rows = await db("rental_agreements", {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
        quote_id: quote.id, source_type: "invoice", source_id: invoice.id, status: "draft", vehicle_id: quote.vehicle_id,
        customer_name: [quote.customer_first_name, quote.customer_last_name].filter(Boolean).join(" "), customer_email: quote.customer_email, customer_phone: quote.customer_phone,
        driver_name: [quote.customer_first_name, quote.customer_last_name].filter(Boolean).join(" "), vehicle_name: quote.vehicle_name,
        rental_start: dateOnly(quote.start_at), rental_end: dateOnly(quote.end_at), rental_start_at: quote.start_at, rental_end_at: quote.end_at,
        rental_days: days, daily_rate: baseAmount / days, quote_total: totals.rental_total, line_items: quote.line_items,
        discount_amount: quote.discount_amount, tax_amount: quote.tax_amount, amount_required: quote.amount_required,
        refundable_deposit: quote.security_deposit, amount_paid: quote.deposit_paid_amount, payment_status: Number(quote.deposit_paid_amount) >= Number(quote.rental_total) ? "paid" : Number(quote.deposit_paid_amount) > 0 ? "partial" : "unpaid",
        payment_method: quote.stripe_payment_intent_id ? "stripe" : "other", payment_reference: quote.stripe_payment_intent_id || "",
        deposit_status: Number(quote.security_deposit) ? "pending" : "not_required", partner_cost: quote.partner_cost, internal_costs: quote.internal_costs,
        lead_source: quote.lead_source, assigned_user_id: quote.assigned_user_id, internal_notes: quote.internal_notes, created_by: userId,
      })
    }, token);
    reservation = rows[0];
  }
  const convertedAt = new Date().toISOString();
  const updated = await db(`quotes?id=eq.${encodeURIComponent(quote.id)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "converted", invoice_id: invoice.id, reservation_id: reservation.id, converted_at: convertedAt, updated_by: userId }),
  }, token);
  await addQuoteEvent(quote.id, "converted", `Converted to reservation ${reservation.agreement_number}.`, userId, { invoice_id: invoice.id, reservation_id: reservation.id }, token);
  return { quote: updated[0], invoice, reservation, existing: false };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const { user, profile, token } = await requireEmployee(req);
    await expireQuotes(token);
    if (req.method === "GET") {
      const id = clean(req.query?.id, 80);
      if (id) {
        const quote = await getQuote(id, token);
        const [events, revisions] = await Promise.all([
          db(`quote_events?quote_id=eq.${encodeURIComponent(quote.id)}&select=*&order=created_at.asc`, {}, token),
          db(`quote_revisions?quote_id=eq.${encodeURIComponent(quote.id)}&select=*&order=revision.asc`, {}, token),
        ]);
        return json(res, 200, { quote: { ...quote, public_url: quoteUrl(req, quote.access_token) }, events, revisions, role: profile.role });
      }
      const [quotes, customers, leads, cars, partners, employees, reservations, blocks] = await Promise.all([
        db("quotes?select=*&order=created_at.desc&limit=500", {}, token), db("crm_customers?select=*&order=updated_at.desc&limit=500", {}, token),
        db("quote_requests?select=*&order=created_at.desc&limit=500", {}, token), db("cars?select=*&is_active=eq.true&order=name.asc&limit=500", {}, token),
        db("car_partners?select=*&limit=500", {}, token).catch(() => []), db("admin_profiles?select=user_id,display_name,role&order=display_name.asc", {}, token),
        db("rental_agreements?select=id,agreement_number,quote_id,vehicle_id,vehicle_name,rental_start,rental_end,rental_start_at,rental_end_at,status&status=in.(draft,signed,vehicle_out,returned)&limit=500", {}, token),
        db("vehicle_blocks?select=id,car_id,block_type,reason,start_at,end_at&limit=1000", {}, token).catch(() => []),
      ]);
      return json(res, 200, { quotes: quotes.map((quote) => ({ ...quote, public_url: quoteUrl(req, quote.access_token) })), customers, leads, cars, partners, employees, reservations, blocks, role: profile.role });
    }
    const body = await readBody(req);
    if (req.method === "POST") {
      const action = clean(body.action, 60);
      if (!action) {
        const payload = await preparedPayload(body, user.id, token);
        const rows = await db("quotes", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...payload, created_by: user.id, updated_by: user.id }) }, token);
        await addQuoteEvent(rows[0].id, "created", "Quote draft created.", user.id, {}, token);
        return json(res, 201, { quote: { ...rows[0], public_url: quoteUrl(req, rows[0].access_token) } });
      }
      if (action === "duplicate") {
        const current = await getQuote(body.id, token);
        const { customer_notes: _customerNotes, ...copy } = normalizeQuote({ ...current, status: "draft", follow_up_at: null, lost_reason: "", deposit_paid_amount: 0 });
        const rows = await db("quotes", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...copy, created_by: user.id, updated_by: user.id }) }, token);
        await addQuoteEvent(rows[0].id, "created", `Duplicated from ${current.quote_number}.`, user.id, { source_quote_id: current.id }, token);
        return json(res, 201, { quote: { ...rows[0], public_url: quoteUrl(req, rows[0].access_token) } });
      }
      const id = quoteId(body.id);
      const current = await getQuote(id, token);
      if (action === "send") {
        if (current.status === "converted") throw Object.assign(new Error("Converted quotes cannot be resent."), { status: 409 });
        const publicUrl = quoteUrl(req, current.access_token);
        const delivery = await sendQuoteEmail(current, publicUrl);
        const now = new Date().toISOString();
        const rows = await db(`quotes?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "sent", sent_at: now, updated_by: user.id }) }, token);
        await addQuoteEvent(id, current.sent_at ? "resent" : "sent", delivery.delivered ? `Quote emailed to ${current.customer_email}.` : delivery.reason, user.id, delivery, token);
        return json(res, 200, { quote: { ...rows[0], public_url: publicUrl }, delivery });
      }
      if (action === "follow_up") {
        const followUpAt = body.follow_up_at ? new Date(body.follow_up_at).toISOString() : null;
        const rows = await db(`quotes?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: followUpAt ? "follow_up" : current.status, follow_up_at: followUpAt, updated_by: user.id }) }, token);
        await addQuoteEvent(id, "follow_up", followUpAt ? `Follow-up scheduled for ${new Date(followUpAt).toLocaleString("en-US")}.` : "Follow-up cleared.", user.id, {}, token);
        const conversion = totalPaid >= Number(rows[0].amount_required || 0) ? await convertQuote(rows[0], user.id, token) : null;
        return json(res, 200, { quote: conversion?.quote || rows[0], conversion });
      }
      if (action === "record_payment") {
        const paid = Math.min(Math.max(Number(body.amount) || 0, 0), Number(current.rental_total || 0));
        if (!paid) throw Object.assign(new Error("Enter the reservation payment received."), { status: 400 });
        const totalPaid = Math.min(Number(current.deposit_paid_amount || 0) + paid, Number(current.rental_total || 0));
        const rows = await db(`quotes?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "accepted", deposit_paid_amount: totalPaid, deposit_paid_at: new Date().toISOString(), accepted_at: current.accepted_at || new Date().toISOString(), updated_by: user.id }) }, token);
        await addQuoteEvent(id, "deposit_paid", `Reservation payment recorded: $${paid.toFixed(2)}.`, user.id, { method: clean(body.method, 50) || "manual", reference: clean(body.reference, 240) }, token);
        const conversion = next === "accepted" && Number(rows[0].amount_required || 0) <= Number(rows[0].deposit_paid_amount || 0) ? await convertQuote(rows[0], user.id, token) : null;
        return json(res, 200, { quote: conversion?.quote || rows[0], conversion });
      }
      if (action === "status") {
        const next = clean(body.status, 40);
        if (!["accepted", "declined", "cancelled"].includes(next)) throw Object.assign(new Error("Unsupported status change."), { status: 400 });
        const lostReason = next === "declined" ? clean(body.lost_reason, 120) : "";
        if (next === "declined" && !LOST_REASONS.includes(lostReason)) throw Object.assign(new Error("Choose why the quote was lost."), { status: 400 });
        const rows = await db(`quotes?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: next === "accepted" && Number(current.amount_required || 0) > Number(current.deposit_paid_amount || 0) ? "deposit_pending" : next, accepted_at: next === "accepted" ? new Date().toISOString() : current.accepted_at, lost_reason: lostReason, updated_by: user.id }) }, token);
        await addQuoteEvent(id, next, next === "declined" ? `Quote declined: ${lostReason}.` : `Quote marked ${next}.`, user.id, { lost_reason: lostReason }, token);
        return json(res, 200, { quote: rows[0] });
      }
      if (action === "convert") return json(res, 200, await convertQuote(current, user.id, token));
      throw Object.assign(new Error("Unknown quote action."), { status: 400 });
    }
    if (req.method === "PATCH") {
      const current = await getQuote(body.id, token);
      if (["converted", "cancelled"].includes(current.status)) throw Object.assign(new Error("This quote can no longer be edited."), { status: 409 });
      const payload = await preparedPayload(body, user.id, token, current);
      const materiallyChanged = Number(payload.rental_total) !== Number(current.rental_total) || JSON.stringify(payload.line_items) !== JSON.stringify(current.line_items) || payload.start_at !== current.start_at || payload.end_at !== current.end_at || payload.vehicle_id !== current.vehicle_id;
      if (materiallyChanged && current.sent_at) await createRevision(current, user.id, token);
      const rows = await db(`quotes?id=eq.${encodeURIComponent(current.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...payload, revision: materiallyChanged && current.sent_at ? Number(current.revision || 1) + 1 : current.revision, previous_total: materiallyChanged && current.sent_at ? current.rental_total : current.previous_total, updated_by: user.id }) }, token);
      await addQuoteEvent(current.id, "updated", materiallyChanged && current.sent_at ? `Quote revised from $${Number(current.rental_total).toFixed(2)} to $${Number(rows[0].rental_total).toFixed(2)}.` : "Quote updated.", user.id, {}, token);
      return json(res, 200, { quote: { ...rows[0], public_url: quoteUrl(req, rows[0].access_token) } });
    }
    if (req.method === "DELETE") {
      const current = await getQuote(req.query?.id, token);
      if (current.status !== "draft") throw Object.assign(new Error("Only draft quotes can be deleted."), { status: 409 });
      await db(`quotes?id=eq.${encodeURIComponent(current.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, token);
      return json(res, 200, { deleted: true });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Quote request failed.", conflict: error.conflict || null });
  }
}
