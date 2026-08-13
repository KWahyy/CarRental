import { addEvent, clean, db, json, normalizeInvoice, readBody, requireEmployee, setCors } from "./_invoice-core.js";

function invoiceId(value) {
  const id = clean(value, 80);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error("A valid invoice is required."), { status: 400 });
  return id;
}

async function getInvoice(id, token) {
  const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, token);
  if (!rows?.[0]) throw Object.assign(new Error("Invoice not found."), { status: 404 });
  return rows[0];
}

function invoicePayload(body) {
  const normalized = normalizeInvoice(body);
  if (!normalized.customer_name) throw Object.assign(new Error("Customer name is required."), { status: 400 });
  if (!normalized.vehicle_name) throw Object.assign(new Error("Vehicle is required."), { status: 400 });
  return normalized;
}

async function cancelStripeHold(paymentIntentId) {
  if (!paymentIntentId) return false;
  const key = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error("Stripe credentials are required to release this hold."), { status: 503 });
  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": "2026-06-24.dahlia",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ cancellation_reason: "requested_by_customer" }),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error?.message || "Stripe could not release the hold."), { status: response.status });
  return true;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { user, profile, token } = await requireEmployee(req);

    if (req.method === "GET") {
      const id = clean(req.query?.id, 80);
      if (id) return json(res, 200, { invoice: await getInvoice(invoiceId(id), token), role: profile.role });
      const invoices = await db("invoices?select=*&order=created_at.desc&limit=500", {}, token);
      return json(res, 200, { invoices, role: profile.role });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const action = clean(body.action, 40);

      if (!action) {
        const payload = { ...invoicePayload(body), created_by: user.id };
        const rows = await db("invoices", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        }, token);
        await addEvent(rows[0].id, "created", `Draft created by ${profile.display_name || user.email || profile.role}.`, user.id, { source_type: payload.source_type }, token);
        return json(res, 201, { invoice: rows[0] });
      }

      const id = invoiceId(body.id);
      const invoice = await getInvoice(id, token);

      if (action === "finalize") {
        if (invoice.status !== "draft") throw Object.assign(new Error("Only draft invoices can be finalized."), { status: 409 });
        const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}&status=eq.draft`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "finalized", finalized_at: new Date().toISOString(), finalized_by: user.id, locked_at: new Date().toISOString() }),
        }, token);
        await addEvent(id, "finalized", "Invoice finalized and locked.", user.id, {}, token);
        return json(res, 200, { invoice: rows[0] });
      }

      if (action === "record_payment") {
        if (!['owner', 'manager'].includes(profile.role)) throw Object.assign(new Error("A manager or owner must record payments."), { status: 403 });
        if (invoice.status === "void") throw Object.assign(new Error("A voided invoice cannot receive a payment."), { status: 409 });
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) throw Object.assign(new Error("Enter a valid payment amount."), { status: 400 });
        const paid = Math.min(amount, Number(invoice.total || 0));
        const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            amount_paid: paid,
            payment_method: clean(body.payment_method, 40) || "stripe",
            payment_reference: clean(body.payment_reference, 240),
            status: paid >= Number(invoice.total || 0) ? "paid" : paid > 0 ? "partially_paid" : "finalized",
            paid_at: paid >= Number(invoice.total || 0) ? new Date().toISOString() : null,
          }),
        }, token);
        await addEvent(id, "payment_recorded", `Payment recorded: $${paid.toFixed(2)}.`, user.id, { method: clean(body.payment_method, 40), reference: clean(body.payment_reference, 240) }, token);
        return json(res, 200, { invoice: rows[0] });
      }

      if (action === "release_hold") {
        if (!['owner', 'manager'].includes(profile.role)) throw Object.assign(new Error("A manager or owner must release a deposit hold."), { status: 403 });
        if (invoice.deposit_method !== "authorization_hold") throw Object.assign(new Error("This invoice does not use an authorization hold."), { status: 409 });
        const releasedInStripe = await cancelStripeHold(invoice.stripe_payment_intent_id);
        const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ deposit_hold_status: "released", deposit_released_at: new Date().toISOString(), deposit_released_by: user.id }),
        }, token);
        await addEvent(id, "deposit_hold_released", releasedInStripe ? "Refundable security-deposit hold released in Stripe." : "Refundable security-deposit hold marked released.", user.id, {}, token);
        return json(res, 200, { invoice: rows[0] });
      }

      if (action === "void") {
        if (profile.role !== "owner") throw Object.assign(new Error("Only the owner can void invoices."), { status: 403 });
        if (invoice.status === "paid") throw Object.assign(new Error("A paid invoice cannot be voided."), { status: 409 });
        const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "void", locked_at: invoice.locked_at || new Date().toISOString() }),
        }, token);
        await addEvent(id, "voided", "Invoice voided by owner.", user.id, {}, token);
        return json(res, 200, { invoice: rows[0] });
      }

      throw Object.assign(new Error("Unknown invoice action."), { status: 400 });
    }

    if (req.method === "PATCH") {
      const body = await readBody(req);
      const id = invoiceId(body.id);
      const current = await getInvoice(id, token);
      if (current.status === "void") throw Object.assign(new Error("Voided invoices cannot be edited."), { status: 409 });
      const payload = invoicePayload({ ...current, ...body, status: current.status });
      const rows = await db(`invoices?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      }, token);
      await addEvent(id, "updated", "Invoice updated.", user.id, {}, token);
      return json(res, 200, { invoice: rows[0] });
    }

    if (req.method === "DELETE") {
      if (profile.role !== "owner") throw Object.assign(new Error("Only the owner can delete draft invoices."), { status: 403 });
      const id = invoiceId(req.query?.id);
      const current = await getInvoice(id, token);
      if (current.status !== "draft") throw Object.assign(new Error("Only draft invoices can be deleted."), { status: 409 });
      await db(`invoices?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, token);
      return json(res, 200, { deleted: true, role: profile.role });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Invoice request failed." });
  }
}
