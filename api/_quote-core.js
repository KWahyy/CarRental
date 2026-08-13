import crypto from "node:crypto";
import { clean, db } from "./_invoice-core.js";

export const QUOTE_STATUSES = ["draft", "sent", "viewed", "follow_up", "accepted", "deposit_pending", "converted", "declined", "expired", "cancelled"];
export const OPEN_QUOTE_STATUSES = ["draft", "sent", "viewed", "follow_up", "accepted", "deposit_pending"];

const amount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(number, 0) : 0;
};

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const uuid = (value) => {
  const id = clean(value, 80);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
};

export function quoteId(value) {
  const id = uuid(value);
  if (!id) throw Object.assign(new Error("A valid quote is required."), { status: 400 });
  return id;
}

export function quoteToken(value) {
  const token = clean(value, 120);
  if (!/^[a-f0-9]{48}$/i.test(token)) throw Object.assign(new Error("This quote link is invalid."), { status: 400 });
  return token;
}

export function normalizeLineItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).map((item) => {
    const quantity = Math.max(amount(item?.quantity), 0.01);
    const rate = amount(item?.rate);
    return {
      description: clean(item?.description, 160) || "Additional charge",
      quantity,
      rate,
      amount: Math.round(quantity * rate * 100) / 100,
      taxable: Boolean(item?.taxable),
    };
  });
}

export function normalizeInternalCosts(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item) => ({
    description: clean(item?.description, 160) || "Internal cost",
    amount: amount(item?.amount),
  }));
}

function calculatedDuration(startAt, endAt, rateType, explicitValue) {
  const start = startAt ? new Date(startAt).getTime() : NaN;
  const end = endAt ? new Date(endAt).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return Math.max(amount(explicitValue), 1);
  if (rateType === "hourly") return Math.max(Math.ceil((end - start) / 3600000), 1);
  if (rateType === "daily") return Math.max(Math.ceil((end - start) / 86400000), 1);
  return Math.max(amount(explicitValue), 1);
}

export function calculateQuoteTotals(input = {}) {
  const rateType = ["daily", "hourly", "flat", "custom"].includes(input.rate_type) ? input.rate_type : "daily";
  const durationValue = calculatedDuration(input.start_at, input.end_at, rateType, input.duration_value);
  const rateAmount = amount(input.rate_amount);
  const baseAmount = rateType === "flat" ? rateAmount : rateAmount * durationValue;
  const lineItems = normalizeLineItems(input.line_items);
  const lineTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const subtotal = Math.max(baseAmount + lineTotal, 0);
  const discountType = input.discount_type === "percentage" ? "percentage" : "fixed";
  const discountValue = amount(input.discount_value);
  const discountAmount = discountType === "percentage" ? subtotal * Math.min(discountValue, 100) / 100 : Math.min(discountValue, subtotal);
  const netBeforeTax = Math.max(subtotal - discountAmount, 0);
  const taxableBeforeDiscount = (input.rental_taxable ? baseAmount : 0) + lineItems.filter((item) => item.taxable).reduce((sum, item) => sum + item.amount, 0);
  const taxableAmount = subtotal > 0 ? taxableBeforeDiscount * (netBeforeTax / subtotal) : 0;
  const taxRate = amount(input.tax_rate);
  const taxAmount = input.tax_enabled ? taxableAmount * taxRate / 100 : 0;
  const rentalTotal = netBeforeTax + taxAmount;
  const amountRequiredType = input.amount_required_type === "percentage" ? "percentage" : "fixed";
  const amountRequiredValue = amount(input.amount_required_value);
  const amountRequired = Math.min(amountRequiredType === "percentage" ? rentalTotal * Math.min(amountRequiredValue, 100) / 100 : amountRequiredValue, rentalTotal);
  const depositPaidAmount = Math.min(amount(input.deposit_paid_amount), rentalTotal);
  const partnerCost = amount(input.partner_cost);
  const internalCosts = normalizeInternalCosts(input.internal_costs);
  const internalCostTotal = partnerCost + internalCosts.reduce((sum, item) => sum + item.amount, 0);
  const round = (number) => Math.round(number * 100) / 100;
  return {
    duration_type: rateType === "hourly" ? "hours" : rateType === "daily" ? "days" : "custom",
    duration_value: durationValue,
    rate_type: rateType,
    rate_amount: rateAmount,
    line_items: lineItems,
    subtotal: round(subtotal),
    discount_type: discountType,
    discount_value: discountValue,
    discount_amount: round(discountAmount),
    tax_rate: taxRate,
    taxable_amount: round(taxableAmount),
    tax_amount: round(taxAmount),
    rental_total: round(rentalTotal),
    amount_required_type: amountRequiredType,
    amount_required_value: amountRequiredValue,
    amount_required: round(amountRequired),
    deposit_paid_amount: round(depositPaidAmount),
    remaining_balance: round(Math.max(rentalTotal - depositPaidAmount, 0)),
    security_deposit: amount(input.security_deposit),
    partner_cost: partnerCost,
    internal_costs: internalCosts,
    internal_cost_total: round(internalCostTotal),
    expected_profit: round(rentalTotal - internalCostTotal),
  };
}

export function normalizeQuote(input = {}, current = {}) {
  const merged = { ...current, ...input };
  const totals = calculateQuoteTotals(merged);
  const status = QUOTE_STATUSES.includes(merged.status) ? merged.status : "draft";
  return {
    status,
    customer_id: uuid(merged.customer_id),
    lead_id: uuid(merged.lead_id),
    vehicle_id: uuid(merged.vehicle_id),
    assigned_user_id: uuid(merged.assigned_user_id),
    customer_first_name: clean(merged.customer_first_name, 100),
    customer_last_name: clean(merged.customer_last_name, 100),
    customer_phone: clean(merged.customer_phone, 80),
    customer_email: clean(merged.customer_email, 240).toLowerCase(),
    customer_company: clean(merged.customer_company, 180),
    customer_notes: clean(merged.customer_notes, 3000),
    lead_source: clean(merged.lead_source, 100),
    vehicle_name: clean(merged.vehicle_name, 240),
    vehicle_image_url: clean(merged.vehicle_image_url, 1200),
    ownership_type: merged.ownership_type === "partner" ? "partner" : "prestige",
    start_at: iso(merged.start_at),
    end_at: iso(merged.end_at),
    rental_taxable: Boolean(merged.rental_taxable),
    tax_enabled: Boolean(merged.tax_enabled),
    discount_label: clean(merged.discount_label, 120) || "Discount",
    expires_at: iso(merged.expires_at),
    follow_up_at: iso(merged.follow_up_at),
    internal_notes: clean(merged.internal_notes, 5000),
    customer_message: clean(merged.customer_message, 5000),
    lost_reason: clean(merged.lost_reason, 120),
    ...totals,
  };
}

export async function getQuote(id, token = "") {
  const rows = await db(`quotes?id=eq.${encodeURIComponent(quoteId(id))}&select=*&limit=1`, {}, token);
  if (!rows?.[0]) throw Object.assign(new Error("Quote not found."), { status: 404 });
  return rows[0];
}

export async function getPublicQuote(tokenValue) {
  const rows = await db(`quotes?access_token=eq.${encodeURIComponent(quoteToken(tokenValue))}&select=*&limit=1`);
  if (!rows?.[0]) throw Object.assign(new Error("Quote not found or no longer available."), { status: 404 });
  return rows[0];
}

export async function addQuoteEvent(id, eventType, detail, userId = null, metadata = {}, token = "") {
  await db("quote_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ quote_id: quoteId(id), event_type: clean(eventType, 80), detail: clean(detail, 800), metadata, created_by: userId }),
  }, token);
}

export async function expireQuotes(token = "") {
  const now = new Date().toISOString();
  const statuses = OPEN_QUOTE_STATUSES.filter((status) => status !== "accepted").join(",");
  await db(`quotes?expires_at=lt.${encodeURIComponent(now)}&status=in.(${statuses})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "expired" }),
  }, token).catch(() => {});
}

export function publicQuotePayload(quote) {
  return {
    quote_number: quote.quote_number,
    status: quote.status,
    customer_name: [quote.customer_first_name, quote.customer_last_name].filter(Boolean).join(" "),
    vehicle_name: quote.vehicle_name,
    vehicle_image_url: quote.vehicle_image_url,
    start_at: quote.start_at,
    end_at: quote.end_at,
    duration_type: quote.duration_type,
    duration_value: quote.duration_value,
    rate_type: quote.rate_type,
    rate_amount: quote.rate_amount,
    line_items: normalizeLineItems(quote.line_items),
    subtotal: quote.subtotal,
    discount_label: quote.discount_label,
    discount_amount: quote.discount_amount,
    tax_amount: quote.tax_amount,
    rental_total: quote.rental_total,
    amount_required: quote.amount_required,
    deposit_paid_amount: quote.deposit_paid_amount,
    remaining_balance: quote.remaining_balance,
    security_deposit: quote.security_deposit,
    expires_at: quote.expires_at,
    customer_message: quote.customer_message,
    sent_at: quote.sent_at,
    viewed_at: quote.viewed_at,
    accepted_at: quote.accepted_at,
    deposit_paid_at: quote.deposit_paid_at,
    converted_at: quote.converted_at,
    payment_url: quote.stripe_payment_url || "",
  };
}

export function quoteUrl(req, token) {
  const origin = clean(req.headers.origin, 300);
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) || ["https://prestigeluxor.com", "https://www.prestigeluxor.com"].includes(origin)) {
    return `${origin}/quote.html?token=${encodeURIComponent(token)}`;
  }
  const host = clean(req.headers.host, 300);
  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host || "www.prestigeluxor.com"}/quote.html?token=${encodeURIComponent(token)}`;
}

export function checkoutIdentifier() {
  return `prestige_quote_${crypto.randomBytes(4).toString("hex")}`;
}
