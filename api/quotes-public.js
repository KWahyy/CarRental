import { clean, db, json, readBody, setCors } from "./_invoice-core.js";
import { addQuoteEvent, checkoutIdentifier, getPublicQuote, publicQuotePayload, quoteToken, quoteUrl } from "./_quote-core.js";
import { convertQuote } from "./quotes.js";

async function updateQuote(id, patch) {
  const rows = await db(`quotes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  return rows[0];
}

async function createCheckout(quote, req) {
  const key = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error("Online reservation payments are not configured yet. Contact Prestige Luxor to reserve this vehicle."), { status: 503 });
  const amountDue = Math.max(Math.min(Number(quote.amount_required || 0) - Number(quote.deposit_paid_amount || 0), Number(quote.remaining_balance || 0)), 0);
  if (amountDue <= 0) throw Object.assign(new Error("The required reservation payment has already been received."), { status: 409 });
  const publicUrl = quoteUrl(req, quote.access_token);
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${publicUrl}&payment=success`);
  form.set("cancel_url", `${publicUrl}&payment=cancelled`);
  form.set("client_reference_id", quote.quote_number);
  if (quote.customer_email) form.set("customer_email", quote.customer_email);
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][product_data][name]", `Reservation payment · ${quote.quote_number}`);
  form.set("line_items[0][price_data][product_data][description]", `${quote.vehicle_name} · credited toward rental total`);
  form.set("line_items[0][price_data][unit_amount]", String(Math.round(amountDue * 100)));
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[quote_id]", quote.id);
  form.set("metadata[quote_number]", quote.quote_number);
  form.set("metadata[payment_kind]", "reservation_payment");
  form.set("payment_intent_data[metadata][quote_id]", quote.id);
  form.set("payment_intent_data[metadata][quote_number]", quote.quote_number);
  form.set("payment_intent_data[metadata][payment_kind]", "reservation_payment");
  form.set("integration_identifier", checkoutIdentifier());
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2026-06-24.dahlia", "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = await response.json();
  if (!response.ok) throw Object.assign(new Error(session.error?.message || "Stripe checkout could not be created."), { status: response.status });
  await updateQuote(quote.id, { status: "deposit_pending", stripe_checkout_session_id: session.id, stripe_payment_intent_id: session.payment_intent || null, stripe_payment_url: session.url });
  await addQuoteEvent(quote.id, "payment_requested", `Reservation payment requested: $${amountDue.toFixed(2)}.`, null, { checkout_session_id: session.id, amount: amountDue });
  return session.url;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const body = req.method === "POST" ? await readBody(req) : {};
    const token = quoteToken(req.query?.token || body.token);
    let quote = await getPublicQuote(token);
    if (quote.expires_at && new Date(quote.expires_at) < new Date() && !["accepted", "converted", "declined", "cancelled"].includes(quote.status)) {
      quote = await updateQuote(quote.id, { status: "expired" });
      await addQuoteEvent(quote.id, "expired", "Quote expired automatically.");
    }
    if (req.method === "GET") {
      if (!quote.viewed_at && ["sent", "follow_up"].includes(quote.status)) {
        quote = await updateQuote(quote.id, { status: "viewed", viewed_at: new Date().toISOString() });
        await addQuoteEvent(quote.id, "viewed", "Customer opened the secure quote link.");
      }
      return json(res, 200, { quote: publicQuotePayload(quote) });
    }
    if (req.method === "POST") {
      const action = clean(body.action, 40);
      if (["expired", "declined", "cancelled"].includes(quote.status)) throw Object.assign(new Error("This quote is no longer available. Contact Prestige Luxor for an updated quote."), { status: 409 });
      if (action === "accept") {
        if (quote.status === "converted") return json(res, 200, { quote: publicQuotePayload(quote), already_converted: true });
        const acceptedAt = quote.accepted_at || new Date().toISOString();
        const needsPayment = Number(quote.amount_required || 0) > Number(quote.deposit_paid_amount || 0);
        quote = await updateQuote(quote.id, { status: needsPayment ? "deposit_pending" : "accepted", accepted_at: acceptedAt });
        await addQuoteEvent(quote.id, "accepted", "Customer accepted the quote.");
        if (!needsPayment) quote = (await convertQuote(quote, null, "")).quote;
        return json(res, 200, { quote: publicQuotePayload(quote) });
      }
      if (action === "checkout") {
        if (!quote.accepted_at) throw Object.assign(new Error("Accept the quote before paying the reservation amount."), { status: 409 });
        const url = await createCheckout(quote, req);
        return json(res, 200, { url });
      }
      throw Object.assign(new Error("Unknown quote action."), { status: 400 });
    }
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Quote could not be loaded." });
  }
}
