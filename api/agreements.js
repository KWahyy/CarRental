import crypto from "node:crypto";
import { clean, db, json, readBody, requireEmployee, serverConfig, setCors } from "./_invoice-core.js";
import { addAgreementEvent, agreementId, getAgreement, normalizeAgreement } from "./_agreement-core.js";
import { assertVehicleAvailable } from "./_fleet-core.js";
import { DEFAULT_IMPORTANT_TERMS, DEFAULT_MASTER_AGREEMENT } from "./_agreement-template.js";

function publicUrl(req, token) {
  const origin = clean(req.headers.origin, 300);
  if (["http://localhost:4173", "http://127.0.0.1:4173", "https://prestigeluxor.com", "https://www.prestigeluxor.com"].includes(origin)) return `${origin}/agreement?token=${encodeURIComponent(token)}`;
  const host = clean(req.headers.host, 300) || "www.prestigeluxor.com";
  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/agreement?token=${encodeURIComponent(token)}`;
}

function emailEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function sendAgreementEmail(agreement, url) {
  if (!agreement.customer_email) return { delivered: false, reason: "No customer email is saved. Copy the secure link instead." };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { delivered: false, reason: "Email delivery is not configured. Copy the secure link instead." };
  const signed = agreement.status === "signed";
  const subject = signed ? `${agreement.agreement_number} · Your signed Prestige Luxor agreement` : `${agreement.agreement_number} · Review and sign your Prestige Luxor agreement`;
  const action = signed ? "View signed agreement" : "Review and sign";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.QUOTE_FROM_EMAIL || "Prestige Luxor <onboarding@resend.dev>",
      to: [agreement.customer_email],
      subject,
      html: `<div style="background:#080808;padding:32px 14px;font-family:Arial,sans-serif;color:#fff"><div style="max-width:640px;margin:auto;border:1px solid #353535;background:#111;padding:40px"><p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#aaa">Prestige Luxor · ${emailEscape(agreement.agreement_number)}</p><h1 style="font-size:34px;line-height:1.1;margin:20px 0">${signed ? "Your signed agreement is ready." : "Your rental agreement is ready."}</h1><p style="color:#ccc;line-height:1.6">${emailEscape(agreement.vehicle_name)}<br>${emailEscape(agreement.customer_name)}</p><a href="${emailEscape(url)}" style="display:inline-block;margin-top:24px;background:#fff;color:#080808;padding:16px 24px;text-decoration:none;font-weight:800">${action}</a><p style="margin-top:34px;color:#777;font-size:12px">This private link is unique to your rental. Prestige Luxor · (949) 620-0024</p></div></div>`,
      text: `${subject}\n\n${agreement.vehicle_name}\n${url}\n\nPrestige Luxor · (949) 620-0024`,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || "Agreement email could not be delivered."), { status: 502 });
  return { delivered: true, id: data.id };
}

async function recordVehicleMileage(agreement, mileage, source, userId, token) {
  if (!agreement.vehicle_id || mileage == null) return;
  const now = new Date().toISOString();
  await Promise.all([
    db(`cars?id=eq.${encodeURIComponent(agreement.vehicle_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ current_mileage: mileage, mileage_source: source, mileage_updated_at: now, current_location: source === "rental_checkout" ? "Customer" : "Prestige Luxor facility", location_updated_at: now }) }, token),
    db("vehicle_mileage_history", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ car_id: agreement.vehicle_id, agreement_id: agreement.id, mileage, source, recorded_by: userId }) }, token).catch(() => null),
  ]);
}

async function deleteSignedPdf(path, token) {
  if (!path) return;
  const { url, key } = serverConfig();
  const safePath = String(path).split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/rental-documents/${safePath}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) throw Object.assign(new Error("The signed PDF could not be removed. The agreement was not deleted."), { status: 502 });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const { user, profile, token } = await requireEmployee(req);
    if (req.method === "GET") {
      const id = clean(req.query?.id, 80);
      if (id) {
        const agreement = await getAgreement(agreementId(id), token);
        const events = await db(`rental_agreement_events?agreement_id=eq.${encodeURIComponent(agreement.id)}&select=*&order=created_at.desc`, {}, token).catch(() => []);
        return json(res, 200, { agreement, events, role: profile.role, public_url: agreement.access_token ? publicUrl(req, agreement.access_token) : "" });
      }
      return json(res, 200, { agreements: await db("rental_agreements?select=*&order=created_at.desc&limit=500", {}, token), role: profile.role });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const action = clean(body.action, 50);
      if (!action) {
        const template = (await db("agreement_templates?template_key=eq.master&select=*&limit=1", {}, token).catch(() => []))?.[0];
        const payload = { ...normalizeAgreement({ ...body, terms: body.terms || template?.body || DEFAULT_MASTER_AGREEMENT, important_terms: body.important_terms || template?.important_terms || DEFAULT_IMPORTANT_TERMS, template_version: body.template_version || template?.version || 1 }), access_token: crypto.randomBytes(24).toString("hex"), created_by: user.id };
        if (!payload.customer_name || !payload.vehicle_name) throw Object.assign(new Error("Customer and vehicle are required."), { status: 400 });
        if (payload.vehicle_id && (payload.rental_start_at || payload.rental_start) && (payload.rental_end_at || payload.rental_end)) await assertVehicleAvailable(payload.vehicle_id, payload.rental_start_at || `${payload.rental_start}T00:00:00`, payload.rental_end_at || `${payload.rental_end}T23:59:59`, token);
        const rows = await db("rental_agreements", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }, token);
        await addAgreementEvent(rows[0].id, "created", "Agreement draft created.", user.id, token);
        return json(res, 201, { agreement: rows[0], public_url: publicUrl(req, rows[0].access_token) });
      }
      const id = agreementId(body.id);
      const current = await getAgreement(id, token);
      let patch = {}; let detail = "Agreement updated.";
      if (action === "send") {
        let sendable = current;
        if (!sendable.access_token) {
          const generated = crypto.randomBytes(24).toString("hex");
          sendable = (await db(`rental_agreements?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ access_token: generated }) }, token))[0];
        }
        const url = publicUrl(req, sendable.access_token);
        const delivery = await sendAgreementEmail(sendable, url);
        await addAgreementEvent(id, sendable.status === "signed" ? "resent" : "sent", delivery.delivered ? `Agreement emailed to ${sendable.customer_email}.` : delivery.reason, user.id, token, delivery);
        return json(res, 200, { agreement: sendable, public_url: url, delivery });
      } else if (action === "sign") {
        if (!clean(body.signature_name, 180) || !String(body.signature_data || "").startsWith("data:image/png;base64,")) throw Object.assign(new Error("Signature name and drawn signature are required."), { status: 400 });
        patch = { status: "signed", signature_name: clean(body.signature_name, 180), signature_data: clean(body.signature_data, 300000), signed_at: new Date().toISOString() }; detail = "Customer signature captured.";
      } else if (action === "pickup") {
        if (!current.signed_at) throw Object.assign(new Error("Capture the customer signature before pickup."), { status: 409 });
        if (body.pickup_mileage === "" || body.pickup_mileage == null || !clean(body.pickup_fuel, 40)) throw Object.assign(new Error("Pickup mileage and fuel level are required."), { status: 400 });
        patch = { status: "vehicle_out", pickup_mileage: Math.max(Math.round(Number(body.pickup_mileage) || 0), 0), pickup_fuel: clean(body.pickup_fuel, 40), pickup_notes: clean(body.pickup_notes, 3000), pickup_photo_paths: Array.isArray(body.pickup_photo_paths) ? body.pickup_photo_paths : current.pickup_photo_paths, picked_up_at: new Date().toISOString() }; detail = "Vehicle released to customer.";
      } else if (action === "return") {
        if (current.status !== "vehicle_out") throw Object.assign(new Error("The vehicle must be checked out before return."), { status: 409 });
        if (body.return_mileage === "" || body.return_mileage == null || !clean(body.return_fuel, 40)) throw Object.assign(new Error("Return mileage and fuel level are required."), { status: 400 });
        patch = { status: "returned", return_mileage: Math.max(Math.round(Number(body.return_mileage) || 0), 0), return_fuel: clean(body.return_fuel, 40), return_notes: clean(body.return_notes, 3000), return_photo_paths: Array.isArray(body.return_photo_paths) ? body.return_photo_paths : current.return_photo_paths, mileage_charge: Math.max(Number(body.mileage_charge) || 0, 0), fuel_charge: Math.max(Number(body.fuel_charge) || 0, 0), tolls_charge: Math.max(Number(body.tolls_charge) || 0, 0), damage_charge: Math.max(Number(body.damage_charge) || 0, 0), other_charge: Math.max(Number(body.other_charge) || 0, 0), other_charge_label: clean(body.other_charge_label, 100) || "Other", returned_at: new Date().toISOString() }; detail = "Vehicle return recorded.";
      } else if (action === "resolve_deposit") {
        if (!["owner", "manager"].includes(profile.role)) throw Object.assign(new Error("A manager or owner must resolve the deposit."), { status: 403 });
        const deduction = Math.min(Math.max(Number(body.deposit_deduction) || 0, 0), Number(current.refundable_deposit || 0));
        patch = { status: "completed", deposit_deduction: deduction, deposit_status: deduction <= 0 ? "released" : deduction < Number(current.refundable_deposit || 0) ? "partially_deducted" : "deducted", deposit_resolution_note: clean(body.deposit_resolution_note, 1200), deposit_resolved_at: new Date().toISOString() }; detail = deduction ? `Deposit resolved with $${deduction.toFixed(2)} deduction.` : "Deposit released in full.";
      } else throw Object.assign(new Error("Unknown agreement action."), { status: 400 });
      const rows = await db(`rental_agreements?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }, token);
      if (action === "pickup") await recordVehicleMileage(rows[0], patch.pickup_mileage, "rental_checkout", user.id, token);
      if (action === "return") await recordVehicleMileage(rows[0], patch.return_mileage, "rental_checkin", user.id, token);
      await addAgreementEvent(id, action, detail, user.id, token);
      return json(res, 200, { agreement: rows[0] });
    }
    if (req.method === "PATCH") {
      const body = await readBody(req); const id = agreementId(body.id); const current = await getAgreement(id, token);
      if (["signed", "vehicle_out", "returned", "completed", "cancelled"].includes(current.status)) throw Object.assign(new Error("Signed or closed agreements are locked. Create a replacement agreement if the rental details changed."), { status: 409 });
      const payload = normalizeAgreement({ ...current, ...body });
      if (payload.vehicle_id && (payload.rental_start_at || payload.rental_start) && (payload.rental_end_at || payload.rental_end)) await assertVehicleAvailable(payload.vehicle_id, payload.rental_start_at || `${payload.rental_start}T00:00:00`, payload.rental_end_at || `${payload.rental_end}T23:59:59`, token, { excludeAgreementId: id });
      const rows = await db(`rental_agreements?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }, token);
      await addAgreementEvent(id, "updated", "Agreement details updated.", user.id, token);
      return json(res, 200, { agreement: rows[0] });
    }
    if (req.method === "DELETE") {
      if (profile.role !== "owner") throw Object.assign(new Error("Only the owner can delete an agreement."), { status: 403 });
      const id = agreementId(req.query?.id); const current = await getAgreement(id, token);
      if (current.status !== "draft" && clean(req.query?.confirm, 20) !== "DELETE") throw Object.assign(new Error("Type DELETE to permanently remove a signed or completed agreement."), { status: 409 });
      await deleteSignedPdf(current.signed_pdf_path, token);
      await db(`rental_agreements?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, token);
      return json(res, 200, { deleted: true, status: current.status });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS"); return json(res, 405, { error: "Method not allowed." });
  } catch (error) { return json(res, error.status || 500, { error: error.message || "Agreement request failed." }); }
}
