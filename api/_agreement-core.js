import { clean, db } from "./_invoice-core.js";

export const DEFAULT_AGREEMENT_TERMS = `The renter confirms the vehicle, rental dates, rates, mileage allowance, and refundable security deposit shown above. Only approved drivers may operate the vehicle. The vehicle must be returned on time, with the agreed fuel level and in the same condition, ordinary wear excepted. The renter authorizes Prestige Luxor to document pickup and return condition and to apply properly documented mileage, fuel, toll, late-return, damage, cleaning, or other agreed charges against the refundable deposit. This operational template must be reviewed and customized by qualified legal counsel before customer use.`;

export function agreementId(value) {
  const id = clean(value, 80);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error("A valid agreement is required."), { status: 400 });
  return id;
}

const amount = (value) => Math.max(Number(value) || 0, 0);
const whole = (value) => value === null || value === "" || value === undefined ? null : Math.max(Math.round(Number(value) || 0), 0);
const list = (value) => Array.isArray(value) ? value.map((item) => clean(item, 1000)).filter(Boolean).slice(0, 30) : [];

export function normalizeAgreement(input = {}) {
  const days = Math.max(parseInt(input.rental_days, 10) || 1, 1);
  return {
    source_type: ["invoice", "quote"].includes(input.source_type) ? input.source_type : "manual", source_id: clean(input.source_id, 120) || null,
    quote_id: /^[0-9a-f-]{36}$/i.test(clean(input.quote_id, 80)) ? clean(input.quote_id, 80) : null,
    vehicle_id: /^[0-9a-f-]{36}$/i.test(clean(input.vehicle_id, 80)) ? clean(input.vehicle_id, 80) : null,
    assigned_user_id: /^[0-9a-f-]{36}$/i.test(clean(input.assigned_user_id, 80)) ? clean(input.assigned_user_id, 80) : null,
    customer_name: clean(input.customer_name, 180), customer_email: clean(input.customer_email, 240), customer_phone: clean(input.customer_phone, 80), customer_address: clean(input.customer_address, 500),
    driver_name: clean(input.driver_name, 180), license_number: clean(input.license_number, 100), license_state: clean(input.license_state, 60), license_expiration: clean(input.license_expiration, 20) || null,
    insurance_provider: clean(input.insurance_provider, 180), policy_number: clean(input.policy_number, 120), insurance_expiration: clean(input.insurance_expiration, 20) || null,
    license_file_path: clean(input.license_file_path, 1000) || null, insurance_file_path: clean(input.insurance_file_path, 1000) || null,
    vehicle_name: clean(input.vehicle_name, 240), vehicle_vin: clean(input.vehicle_vin, 80), vehicle_plate: clean(input.vehicle_plate, 40),
    rental_start: clean(input.rental_start, 20) || null, rental_end: clean(input.rental_end, 20) || null,
    rental_start_at: clean(input.rental_start_at, 40) || null, rental_end_at: clean(input.rental_end_at, 40) || null, rental_days: days,
    daily_rate: amount(input.daily_rate), mileage_allowance: clean(input.mileage_allowance, 120) || "100 miles/day", overage_rate: amount(input.overage_rate),
    quote_total: amount(input.quote_total), line_items: Array.isArray(input.line_items) ? input.line_items : [], discount_amount: amount(input.discount_amount), tax_amount: amount(input.tax_amount), amount_required: amount(input.amount_required),
    partner_cost: amount(input.partner_cost), internal_costs: Array.isArray(input.internal_costs) ? input.internal_costs : [], lead_source: clean(input.lead_source, 100),
    refundable_deposit: amount(input.refundable_deposit), payment_status: ["unpaid", "partial", "paid", "refunded"].includes(input.payment_status) ? input.payment_status : "unpaid",
    amount_paid: amount(input.amount_paid), payment_method: clean(input.payment_method, 50) || "stripe", payment_reference: clean(input.payment_reference, 240),
    deposit_status: ["not_required", "pending", "held", "charged", "released", "partially_deducted", "deducted"].includes(input.deposit_status) ? input.deposit_status : amount(input.refundable_deposit) ? "pending" : "not_required",
    deposit_deduction: amount(input.deposit_deduction), deposit_resolution_note: clean(input.deposit_resolution_note, 1200),
    pickup_mileage: whole(input.pickup_mileage), pickup_fuel: clean(input.pickup_fuel, 40), pickup_notes: clean(input.pickup_notes, 3000), pickup_photo_paths: list(input.pickup_photo_paths),
    return_mileage: whole(input.return_mileage), return_fuel: clean(input.return_fuel, 40), return_notes: clean(input.return_notes, 3000), return_photo_paths: list(input.return_photo_paths),
    mileage_charge: amount(input.mileage_charge), fuel_charge: amount(input.fuel_charge), tolls_charge: amount(input.tolls_charge), damage_charge: amount(input.damage_charge), other_charge: amount(input.other_charge), other_charge_label: clean(input.other_charge_label, 100) || "Other",
    terms: clean(input.terms, 12000) || DEFAULT_AGREEMENT_TERMS, internal_notes: clean(input.internal_notes, 5000),
  };
}

export async function getAgreement(id, token) {
  const rows = await db(`rental_agreements?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, token);
  if (!rows?.[0]) throw Object.assign(new Error("Agreement not found."), { status: 404 });
  return rows[0];
}

export async function addAgreementEvent(id, eventType, detail, userId, token) {
  await db("rental_agreement_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ agreement_id: id, event_type: clean(eventType, 80), detail: clean(detail, 800), created_by: userId }) }, token);
}
