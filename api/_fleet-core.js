import { clean, db } from "./_invoice-core.js";

export const ACTIVE_AGREEMENT_STATUSES = ["draft", "signed", "vehicle_out", "returned"];
export const BLOCK_TYPES = ["manual_hold", "maintenance", "partner_unavailable", "owner_use", "photoshoot", "other"];

export function validUuid(value) {
  const id = clean(value, 80);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  const a = new Date(aStart).getTime(), b = new Date(aEnd).getTime(), c = new Date(bStart).getTime(), d = new Date(bEnd).getTime();
  return [a, b, c, d].every(Number.isFinite) && a < d && b > c;
}

export async function vehicleAvailability(vehicleId, startAt, endAt, token = "", { excludeAgreementId = "" } = {}) {
  const id = validUuid(vehicleId);
  if (!id) throw Object.assign(new Error("Select a fleet vehicle."), { status: 400 });
  const vehicles = await db(`cars?id=eq.${encodeURIComponent(id)}&select=id,name,is_active,operational_status&limit=1`, {}, token);
  const vehicle = vehicles?.[0];
  if (!vehicle) throw Object.assign(new Error("Vehicle not found."), { status: 404 });
  if (!vehicle.is_active || vehicle.operational_status === "inactive") return { available: false, status: "inactive", vehicle, conflicts: [{ type: "inactive", label: "Vehicle is archived or inactive." }] };
  if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) throw Object.assign(new Error("Choose a valid start and end date."), { status: 400 });

  const [agreementsById, legacyAgreements, blocks] = await Promise.all([
    db(`rental_agreements?vehicle_id=eq.${encodeURIComponent(id)}&status=in.(${ACTIVE_AGREEMENT_STATUSES.join(",")})&select=id,agreement_number,status,customer_name,rental_start,rental_end,rental_start_at,rental_end_at`, {}, token),
    db(`rental_agreements?vehicle_id=is.null&vehicle_name=eq.${encodeURIComponent(vehicle.name)}&status=in.(${ACTIVE_AGREEMENT_STATUSES.join(",")})&select=id,agreement_number,status,customer_name,rental_start,rental_end,rental_start_at,rental_end_at`, {}, token).catch(() => []),
    db(`vehicle_blocks?car_id=eq.${encodeURIComponent(id)}&end_at=gt.${encodeURIComponent(startAt)}&start_at=lt.${encodeURIComponent(endAt)}&select=*`, {}, token).catch(() => []),
  ]);
  const agreements = [...new Map([...(agreementsById || []), ...(legacyAgreements || [])].map((row) => [row.id, row])).values()];
  const agreementConflicts = (agreements || []).filter((row) => String(row.id) !== String(excludeAgreementId) && overlaps(row.rental_start_at || `${row.rental_start}T00:00:00`, row.rental_end_at || `${row.rental_end}T23:59:59`, startAt, endAt)).map((row) => ({ type: "reservation", label: `${row.agreement_number} · ${row.customer_name}`, record: row }));
  const blockConflicts = (blocks || []).map((row) => ({ type: row.block_type, label: row.reason || row.block_type.replaceAll("_", " "), record: row }));
  const operationalConflict = ["maintenance", "on_hold", "partner_unavailable"].includes(vehicle.operational_status)
    ? [{ type: vehicle.operational_status, label: `Vehicle status: ${vehicle.operational_status.replaceAll("_", " ")}.` }]
    : [];
  const conflicts = [...agreementConflicts, ...blockConflicts, ...operationalConflict];
  return { available: conflicts.length === 0, status: conflicts[0]?.type || "available", vehicle, conflicts };
}

export async function assertVehicleAvailable(vehicleId, startAt, endAt, token = "", options = {}) {
  const result = await vehicleAvailability(vehicleId, startAt, endAt, token, options);
  if (!result.available) throw Object.assign(new Error(`${result.vehicle.name} is unavailable: ${result.conflicts[0].label}`), { status: 409, conflict: result.conflicts[0] });
  return result;
}

export function dateRange(period = "month", customStart = "", customEnd = "") {
  const now = new Date(); let start = new Date(now); let end = new Date(now);
  if (period === "last_month") { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (period === "ytd") { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear() + 1, 0, 1); }
  else if (period === "custom" && customStart && customEnd) { start = new Date(`${customStart}T00:00:00`); end = new Date(`${customEnd}T23:59:59`); }
  else { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
  return { start: start.toISOString(), end: end.toISOString() };
}

export function agreementRevenue(row) {
  if (["cancelled", "draft"].includes(row.status)) return 0;
  return Math.max(Number(row.quote_total || row.rental_total || 0), 0);
}

export function internalCosts(row) {
  const extras = Array.isArray(row.internal_costs) ? row.internal_costs.reduce((sum, item) => sum + Math.max(Number(item.amount || 0), 0), 0) : 0;
  return Math.max(Number(row.partner_cost || 0), 0) + extras;
}

export function deriveVehicleMetrics(vehicle, agreements = [], blocks = [], maintenance = [], documents = [], expenses = [], now = new Date(), financialAgreements = agreements) {
  const currentAgreement = agreements.find((row) => ["signed", "vehicle_out"].includes(row.status) && overlaps(row.rental_start_at || `${row.rental_start}T00:00:00`, row.rental_end_at || `${row.rental_end}T23:59:59`, now.toISOString(), new Date(now.getTime() + 1000).toISOString()));
  const upcoming = agreements.filter((row) => !["cancelled", "completed"].includes(row.status) && new Date(row.rental_start_at || row.rental_start) > now).sort((a, b) => new Date(a.rental_start_at || a.rental_start) - new Date(b.rental_start_at || b.rental_start))[0] || null;
  const activeBlock = blocks.find((row) => overlaps(row.start_at, row.end_at, now.toISOString(), new Date(now.getTime() + 1000).toISOString()));
  let status = "available";
  if (!vehicle.is_active || vehicle.operational_status === "inactive") status = "inactive";
  else if (currentAgreement?.status === "vehicle_out") status = "vehicle_out";
  else if (currentAgreement) status = "reserved";
  else if (activeBlock?.block_type === "maintenance" || vehicle.operational_status === "maintenance") status = "maintenance";
  else if (activeBlock?.block_type === "partner_unavailable" || vehicle.operational_status === "partner_unavailable") status = "partner_unavailable";
  else if (activeBlock || vehicle.operational_status === "on_hold") status = "on_hold";
  const revenue = financialAgreements.reduce((sum, row) => sum + agreementRevenue(row), 0);
  const reservationCosts = financialAgreements.reduce((sum, row) => sum + internalCosts(row), 0) + expenses.filter((row) => row.expense_scope === "reservation").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const generalExpenses = expenses.filter((row) => row.expense_scope === "general").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const grossProfit = revenue - reservationCosts;
  const completedBookings = financialAgreements.filter((row) => ["signed", "vehicle_out", "returned", "completed"].includes(row.status)).length;
  const documentWarning = documents.filter((row) => row.expiration_date).sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date))[0] || null;
  const maintenanceWarning = maintenance.filter((row) => row.status !== "cancelled" && (row.next_service_date || row.next_service_mileage)).sort((a, b) => new Date(a.next_service_date || "2999-12-31") - new Date(b.next_service_date || "2999-12-31"))[0] || null;
  return { status, current_agreement: currentAgreement || null, next_reservation: upcoming, revenue, reservation_costs: reservationCosts, general_expenses: generalExpenses, gross_profit: grossProfit, net_profit: grossProfit - generalExpenses, bookings: completedBookings, average_booking_value: completedBookings ? revenue / completedBookings : 0, document_warning: documentWarning, maintenance_warning: maintenanceWarning };
}
