import { clean, db, json, readBody, requireEmployee, setCors } from "./_invoice-core.js";
import { addAgreementEvent, agreementId, getAgreement, normalizeAgreement } from "./_agreement-core.js";
import { assertVehicleAvailable } from "./_fleet-core.js";

async function recordVehicleMileage(agreement, mileage, source, userId, token) {
  if (!agreement.vehicle_id || mileage == null) return;
  const now = new Date().toISOString();
  await Promise.all([
    db(`cars?id=eq.${encodeURIComponent(agreement.vehicle_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ current_mileage: mileage, mileage_source: source, mileage_updated_at: now, current_location: source === "rental_checkout" ? "Customer" : "Prestige Luxor facility", location_updated_at: now }) }, token),
    db("vehicle_mileage_history", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ car_id: agreement.vehicle_id, agreement_id: agreement.id, mileage, source, recorded_by: userId }) }, token).catch(() => null),
  ]);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const { user, profile, token } = await requireEmployee(req);
    if (req.method === "GET") {
      const id = clean(req.query?.id, 80);
      if (id) return json(res, 200, { agreement: await getAgreement(agreementId(id), token), role: profile.role });
      return json(res, 200, { agreements: await db("rental_agreements?select=*&order=created_at.desc&limit=500", {}, token), role: profile.role });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const action = clean(body.action, 50);
      if (!action) {
        const payload = { ...normalizeAgreement(body), created_by: user.id };
        if (!payload.customer_name || !payload.vehicle_name) throw Object.assign(new Error("Customer and vehicle are required."), { status: 400 });
        if (payload.vehicle_id && (payload.rental_start_at || payload.rental_start) && (payload.rental_end_at || payload.rental_end)) await assertVehicleAvailable(payload.vehicle_id, payload.rental_start_at || `${payload.rental_start}T00:00:00`, payload.rental_end_at || `${payload.rental_end}T23:59:59`, token);
        const rows = await db("rental_agreements", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }, token);
        await addAgreementEvent(rows[0].id, "created", "Agreement draft created.", user.id, token);
        return json(res, 201, { agreement: rows[0] });
      }
      const id = agreementId(body.id);
      const current = await getAgreement(id, token);
      let patch = {}; let detail = "Agreement updated.";
      if (action === "sign") {
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
      if (current.status === "cancelled") throw Object.assign(new Error("Cancelled agreements cannot be edited."), { status: 409 });
      const payload = normalizeAgreement({ ...current, ...body });
      if (payload.vehicle_id && (payload.rental_start_at || payload.rental_start) && (payload.rental_end_at || payload.rental_end)) await assertVehicleAvailable(payload.vehicle_id, payload.rental_start_at || `${payload.rental_start}T00:00:00`, payload.rental_end_at || `${payload.rental_end}T23:59:59`, token, { excludeAgreementId: id });
      const rows = await db(`rental_agreements?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }, token);
      await addAgreementEvent(id, "updated", "Agreement details updated.", user.id, token);
      return json(res, 200, { agreement: rows[0] });
    }
    if (req.method === "DELETE") {
      if (profile.role !== "owner") throw Object.assign(new Error("Only the owner can delete a draft agreement."), { status: 403 });
      const id = agreementId(req.query?.id); const current = await getAgreement(id, token);
      if (current.status !== "draft") throw Object.assign(new Error("Only draft agreements can be deleted."), { status: 409 });
      await db(`rental_agreements?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, token);
      return json(res, 200, { deleted: true });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS"); return json(res, 405, { error: "Method not allowed." });
  } catch (error) { return json(res, error.status || 500, { error: error.message || "Agreement request failed." }); }
}
