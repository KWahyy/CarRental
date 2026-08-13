import crypto from "node:crypto";
import { addEvent, clean, db, json } from "./_invoice-core.js";
import { convertQuote } from "./quotes.js";

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function verifySignature(payload, header, secret) {
  const parts = String(header || "").split(",").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload.toString("utf8")}`).digest("hex");
  return signatures.some((signature) => {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

async function findInvoice(object) {
  const metadata = object?.metadata || {};
  const id = clean(metadata.invoice_id, 80);
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (rows?.[0]) return rows[0];
  }
  const number = clean(metadata.invoice_number, 80);
  if (number) {
    const rows = await db(`invoices?invoice_number=eq.${encodeURIComponent(number)}&select=*&limit=1`);
    if (rows?.[0]) return rows[0];
  }
  const paymentIntentId = object?.object === "payment_intent" ? object.id : object?.payment_intent;
  if (paymentIntentId) {
    const rows = await db(`invoices?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=*&limit=1`);
    if (rows?.[0]) return rows[0];
  }
  return null;
}

async function findQuote(object) {
  const metadata = object?.metadata || {};
  const id = clean(metadata.quote_id, 80);
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const rows = await db(`quotes?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (rows?.[0]) return rows[0];
  }
  const paymentIntentId = object?.object === "payment_intent" ? object.id : object?.payment_intent;
  if (paymentIntentId) {
    const rows = await db(`quotes?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=*&limit=1`).catch(() => []);
    if (rows?.[0]) return rows[0];
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return json(res, 503, { error: "Stripe webhook is not configured." });
    const payload = await rawBody(req);
    if (!verifySignature(payload, req.headers["stripe-signature"], secret)) return json(res, 400, { error: "Invalid Stripe signature." });
    const event = JSON.parse(payload.toString("utf8"));
    const object = event.data?.object;
    const quote = await findQuote(object);
    if (quote && ["checkout.session.completed", "payment_intent.succeeded"].includes(event.type)) {
      if (quote.reservation_id) return json(res, 200, { received: true, matched: true, type: "quote", duplicate: true });
      if (event.type === "checkout.session.completed" && object.payment_status && object.payment_status !== "paid") {
        return json(res, 200, { received: true, matched: true, type: "quote", payment_pending: true });
      }
      const amount = Number(object.amount_total || object.amount_received || object.amount || 0) / 100;
      const paid = Math.min(Math.max(amount, Number(quote.deposit_paid_amount || 0)), Number(quote.rental_total || 0));
      const paymentIntentId = object.object === "payment_intent" ? object.id : object.payment_intent;
      const updated = await db(`quotes?id=eq.${encodeURIComponent(quote.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "accepted",
          accepted_at: quote.accepted_at || new Date().toISOString(),
          deposit_paid_amount: paid,
          deposit_paid_at: new Date().toISOString(),
          stripe_checkout_session_id: object.object === "checkout.session" ? object.id : quote.stripe_checkout_session_id,
          stripe_payment_intent_id: paymentIntentId || quote.stripe_payment_intent_id,
        }),
      });
      await db("quote_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ quote_id: quote.id, event_type: "deposit_paid", detail: `Stripe reservation payment received: $${paid.toFixed(2)}.`, metadata: { stripe_event_id: event.id, payment_intent_id: paymentIntentId } }),
      });
      const conversion = paid >= Number(updated[0].amount_required || 0) ? await convertQuote(updated[0], null, "") : null;
      return json(res, 200, { received: true, matched: true, type: "quote", converted: Boolean(conversion) });
    }
    const invoice = await findInvoice(object);
    if (!invoice) return json(res, 200, { received: true, matched: false });

    if (event.type === "payment_intent.succeeded") {
      const amount = Number(object.amount_received || object.amount || 0) / 100;
      const paid = Math.min(amount, Number(invoice.total || 0));
      await db(`invoices?id=eq.${encodeURIComponent(invoice.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          stripe_payment_intent_id: object.id,
          amount_paid: paid,
          payment_method: "stripe",
          payment_reference: object.id,
          status: paid >= Number(invoice.total || 0) ? "paid" : "partially_paid",
          paid_at: paid >= Number(invoice.total || 0) ? new Date().toISOString() : null,
        }),
      });
      await addEvent(invoice.id, "stripe_payment_succeeded", `Stripe payment received: $${paid.toFixed(2)}.`, null, { stripe_event_id: event.id, payment_intent_id: object.id });
    } else if (event.type === "payment_intent.amount_capturable_updated" && invoice.deposit_method === "authorization_hold") {
      await db(`invoices?id=eq.${encodeURIComponent(invoice.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ stripe_payment_intent_id: object.id, deposit_hold_status: "authorized" }),
      });
      await addEvent(invoice.id, "deposit_hold_authorized", "Stripe security-deposit hold authorized.", null, { stripe_event_id: event.id, payment_intent_id: object.id });
    } else if (event.type === "payment_intent.canceled" && invoice.deposit_method === "authorization_hold") {
      await db(`invoices?id=eq.${encodeURIComponent(invoice.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ deposit_hold_status: "released", deposit_released_at: new Date().toISOString() }),
      });
      await addEvent(invoice.id, "deposit_hold_released", "Stripe security-deposit hold released.", null, { stripe_event_id: event.id, payment_intent_id: object.id });
    } else if (event.type === "charge.refunded" && Number(object.amount_refunded || 0) >= Number(object.amount || 0)) {
      await db(`invoices?id=eq.${encodeURIComponent(invoice.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "refunded", amount_paid: 0 }),
      });
      await addEvent(invoice.id, "stripe_payment_refunded", "Stripe payment refunded.", null, { stripe_event_id: event.id, charge_id: object.id });
    }

    return json(res, 200, { received: true, matched: true });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Stripe webhook failed." });
  }
}
