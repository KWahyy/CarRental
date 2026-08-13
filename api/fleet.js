import { clean, db, json, readBody, requireEmployee, setCors } from "./_invoice-core.js";
import { BLOCK_TYPES, dateRange, deriveVehicleMetrics, validUuid, vehicleAvailability } from "./_fleet-core.js";

const amount = (value) => Math.max(Number(value) || 0, 0);
const whole = (value) => value === "" || value == null ? null : Math.max(Math.round(Number(value) || 0), 0);
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 20)) ? clean(value, 20) : null;
const iso = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;
const fleetCache = new Map();
const FLEET_CACHE_MS = 20_000;

function slugify(value) {
  return clean(value, 240).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function vehiclePayload(input, current = {}) {
  const merged = { ...current, ...input };
  const year = whole(merged.year) || whole(String(merged.name || "").match(/\b(19|20)\d{2}\b/)?.[0]);
  const make = clean(merged.make, 100), model = clean(merged.model, 120), trim = clean(merged.trim, 140);
  const name = clean(merged.name, 240) || [year, make, model, trim].filter(Boolean).join(" ");
  return {
    slug: clean(current.slug, 140) || slugify(merged.slug || name), name, year, make, model, trim,
    category: clean(merged.category, 80) || "exotic", category_label: clean(merged.category_label, 100) || clean(merged.category, 80) || "Exotic",
    price: Math.round(amount(merged.price)), weekend_rate: merged.weekend_rate === "" ? null : amount(merged.weekend_rate), weekly_rate: merged.weekly_rate === "" ? null : amount(merged.weekly_rate), hourly_rate: merged.hourly_rate === "" ? null : amount(merged.hourly_rate), event_rate: merged.event_rate === "" ? null : amount(merged.event_rate),
    mileage: clean(merged.mileage, 120) || `${whole(merged.included_mileage) || 100} miles/day`, included_mileage: whole(merged.included_mileage), extra_mileage_rate: amount(merged.extra_mileage_rate), security_deposit: amount(merged.security_deposit), minimum_rental_days: whole(merged.minimum_rental_days) || 1, delivery_base_fee: amount(merged.delivery_base_fee),
    seats: whole(merged.seats) || 2, color: clean(merged.color, 120), interior_color: clean(merged.interior_color, 120), summary: clean(merged.summary, 3000), internal_nickname: clean(merged.internal_nickname, 180),
    vin: clean(merged.vin, 80).toUpperCase(), license_plate: clean(merged.license_plate, 40).toUpperCase(), registration_state: clean(merged.registration_state, 40) || "CA", internal_fleet_id: clean(merged.internal_fleet_id, 80).toUpperCase(),
    ownership_type: merged.ownership_type === "partner" ? "partner" : "prestige", operational_status: ["available", "maintenance", "on_hold", "partner_unavailable", "inactive"].includes(merged.operational_status) ? merged.operational_status : "available",
    current_mileage: whole(merged.current_mileage), mileage_source: clean(merged.mileage_source, 80) || "manual", mileage_updated_at: merged.current_mileage !== current.current_mileage ? new Date().toISOString() : current.mileage_updated_at,
    current_location: clean(merged.current_location, 180) || "Prestige Luxor facility", location_notes: clean(merged.location_notes, 1200), location_updated_at: merged.current_location !== current.current_location || merged.location_notes !== current.location_notes ? new Date().toISOString() : current.location_updated_at,
    registration_expiration: date(merged.registration_expiration), insurance_provider: clean(merged.insurance_provider, 180), insurance_policy_number: clean(merged.insurance_policy_number, 160), insurance_expiration: date(merged.insurance_expiration),
    is_active: merged.is_active !== false && merged.operational_status !== "inactive", is_featured: merged.is_featured !== false,
    image_url: clean(merged.image_url, 1200) || null, tags: Array.isArray(merged.tags) ? merged.tags.slice(0, 30) : [], details: Array.isArray(merged.details) ? merged.details.slice(0, 30) : [],
  };
}

function partnerPayload(input, carId) {
  return { car_id: carId, partner_name: clean(input.partner_name, 180), partner_phone: clean(input.partner_phone, 80), partner_identifier: clean(input.partner_identifier, 120), partner_notes: clean(input.partner_notes, 2000), partner_daily_cost: amount(input.partner_daily_cost), weekend_cost: input.weekend_cost === "" ? null : amount(input.weekend_cost), weekly_cost: input.weekly_cost === "" ? null : amount(input.weekly_cost), minimum_partner_charge: amount(input.minimum_partner_charge), delivery_cost: amount(input.delivery_cost), other_partner_fees: amount(input.other_partner_fees), updated_at: new Date().toISOString() };
}

async function addActivity(carId, action, detail, userId, metadata, token) {
  return db("vehicle_activity", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ car_id: carId, action: clean(action, 100), detail: clean(detail, 1000), metadata: metadata || {}, created_by: userId }) }, token).catch(() => null);
}

function coreVehiclePayload(payload) {
  return {
    slug: payload.slug, name: payload.name, make: payload.make, model: payload.model,
    category: payload.category, category_label: payload.category_label, price: payload.price,
    mileage: payload.mileage, seats: payload.seats, color: payload.color, summary: payload.summary,
    image_url: payload.image_url, tags: payload.tags, details: payload.details,
    is_active: payload.is_active, is_featured: payload.is_featured,
  };
}

function optionalVehiclePayload(payload) {
  const core = new Set(Object.keys(coreVehiclePayload(payload)));
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !core.has(key)));
}

async function saveOptionalVehicleFields(carId, payload, token) {
  const rows = await db(`cars?id=eq.${carId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(optionalVehiclePayload(payload)) }, token).catch(() => []);
  return rows?.[0] || null;
}

async function savePartner(carId, input, token) {
  const core = { car_id: carId, partner_name: clean(input.partner_name, 180), partner_phone: clean(input.partner_phone, 80), updated_at: new Date().toISOString() };
  await db("car_partners", { method: "POST", headers: { Prefer: "return=minimal,resolution=merge-duplicates" }, body: JSON.stringify(core) }, token);
  const extended = partnerPayload(input, carId);
  delete extended.partner_name; delete extended.partner_phone; delete extended.updated_at;
  await db(`car_partners?car_id=eq.${carId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(extended) }, token).catch(() => null);
}

async function loadFleet(token, period, customStart, customEnd) {
  const range = dateRange(period, customStart, customEnd);
  const [cars, partners, photos, agreements, blocks, expenses, maintenance, documents] = await Promise.all([
    db("cars?select=*&order=name.asc&limit=1000", {}, token), db("car_partners?select=*&limit=1000", {}, token).catch(() => []), db("car_photos?select=*&order=position.asc&limit=5000", {}, token),
    db("rental_agreements?select=*&limit=5000", {}, token),
    db("vehicle_blocks?select=*&order=start_at.asc&limit=5000", {}, token).catch(() => []), db(`vehicle_expenses?select=*&expense_date=gte.${range.start.slice(0,10)}&expense_date=lte.${range.end.slice(0,10)}&limit=5000`, {}, token).catch(() => []),
    db("vehicle_maintenance?select=*&order=service_date.desc&limit=5000", {}, token).catch(() => []), db("vehicle_documents?select=*&order=expiration_date.asc&limit=5000", {}, token).catch(() => []),
  ]);
  const byCar = (rows, key = "car_id") => rows.reduce((map, row) => (map.get(row[key])?.push(row) || map.set(row[key], [row]), map), new Map());
  const partnerMap = new Map(partners.map((row) => [row.car_id, row])); const photoMap = byCar(photos), agreementMap = byCar(agreements, "vehicle_id"), blockMap = byCar(blocks), expenseMap = byCar(expenses), maintenanceMap = byCar(maintenance), documentMap = byCar(documents);
  return {
    period: { ...range, key: period || "month" },
    vehicles: cars.map((car) => {
      const partnerRecord = partnerMap.get(car.id) || null;
      const carAgreements = agreementMap.get(car.id) || [];
      const periodAgreements = carAgreements.filter((row) => {
        const start = row.rental_start_at || `${row.rental_start}T00:00:00`;
        const end = row.rental_end_at || `${row.rental_end}T23:59:59`;
        return new Date(start) < new Date(range.end) && new Date(end) > new Date(range.start);
      });
      const normalizedCar = { ...car, ownership_type: car.ownership_type || (partnerRecord ? "partner" : "prestige"), operational_status: car.operational_status || "available" };
      return { ...normalizedCar, partner: partnerRecord, photos: photoMap.get(car.id) || [], agreements: carAgreements, blocks: blockMap.get(car.id) || [], expenses: expenseMap.get(car.id) || [], maintenance: maintenanceMap.get(car.id) || [], documents: documentMap.get(car.id) || [], metrics: deriveVehicleMetrics(normalizedCar, carAgreements, blockMap.get(car.id) || [], maintenanceMap.get(car.id) || [], documentMap.get(car.id) || [], expenseMap.get(car.id) || [], new Date(), periodAgreements) };
    }),
  };
}

async function cachedFleet(token, period, customStart, customEnd) {
  const key = `${period}|${customStart}|${customEnd}`;
  const cached = fleetCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await loadFleet(token, period, customStart, customEnd);
  fleetCache.set(key, { value, expiresAt: Date.now() + FLEET_CACHE_MS });
  return value;
}

export default async function handler(req, res) {
  setCors(req, res); if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const { user, profile, token } = await requireEmployee(req);
    if (req.method === "GET") {
      if (req.query?.availability === "1") return json(res, 200, await vehicleAvailability(req.query.vehicle_id, req.query.start_at, req.query.end_at, token, { excludeAgreementId: req.query.exclude_agreement_id }));
      const fleet = await cachedFleet(token, clean(req.query?.period, 30) || "month", clean(req.query?.start, 20), clean(req.query?.end, 20));
      const id = validUuid(req.query?.id); const vehicle = id ? fleet.vehicles.find((row) => row.id === id) : null;
      if (id && !vehicle) throw Object.assign(new Error("Vehicle not found."), { status: 404 });
      let activity = [], mileage = [];
      if (id) [activity, mileage] = await Promise.all([
        db(`vehicle_activity?car_id=eq.${id}&select=*&order=created_at.desc&limit=300`, {}, token).catch(() => []),
        db(`vehicle_mileage_history?car_id=eq.${id}&select=*&order=recorded_at.desc&limit=300`, {}, token).catch(() => []),
      ]);
      return json(res, 200, id ? { vehicle, activity, mileage, role: profile.role, period: fleet.period } : { ...fleet, role: profile.role });
    }
    const body = await readBody(req); const action = clean(body.action, 60); fleetCache.clear();
    if (req.method === "POST" && (!action || action === "vehicle")) {
      const payload = vehiclePayload(body);
      if (!payload.name || !payload.make || !payload.model) throw Object.assign(new Error("Year, make, model, and vehicle name are required."), { status: 400 });
      const rows = await db("cars", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(coreVehiclePayload(payload)) }, token); let car = rows[0];
      car = (await saveOptionalVehicleFields(car.id, payload, token)) || car;
      if (body.ownership_type === "partner") await savePartner(car.id, body, token);
      if (payload.current_mileage != null) await db("vehicle_mileage_history", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ car_id: car.id, mileage: payload.current_mileage, source: "vehicle_added", recorded_by: user.id }) }, token).catch(() => null);
      await addActivity(car.id, "vehicle_added", `${car.name} added to the fleet.`, user.id, {}, token); return json(res, 201, { vehicle: car });
    }
    const carId = validUuid(body.car_id || body.id); if (!carId) throw Object.assign(new Error("Select a valid vehicle."), { status: 400 });
    if (req.method === "PATCH" && (!action || action === "vehicle")) {
      const current = (await db(`cars?id=eq.${carId}&select=*&limit=1`, {}, token))?.[0]; if (!current) throw Object.assign(new Error("Vehicle not found."), { status: 404 });
      const payload = vehiclePayload(body, current); const rows = await db(`cars?id=eq.${carId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(coreVehiclePayload(payload)) }, token); let saved = rows[0];
      saved = (await saveOptionalVehicleFields(carId, payload, token)) || saved;
      if (body.ownership_type === "partner") await savePartner(carId, body, token); else await db(`car_partners?car_id=eq.${carId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, token);
      if (payload.current_mileage != null && payload.current_mileage !== current.current_mileage) await db("vehicle_mileage_history", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ car_id: carId, mileage: payload.current_mileage, source: payload.mileage_source, recorded_by: user.id }) }, token).catch(() => null);
      await addActivity(carId, "vehicle_updated", `${saved.name} details updated.`, user.id, {}, token); return json(res, 200, { vehicle: saved });
    }
    if (req.method === "POST") {
      if (action === "photos") {
        const photos = (Array.isArray(body.photos) ? body.photos : []).slice(0, 30).map((item, index) => ({ car_id: carId, position: index + 1, url: clean(item.url || item, 1200) })).filter((row) => row.url);
        await db(`car_photos?car_id=eq.${carId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, token); if (photos.length) await db("car_photos", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(photos) }, token);
        await addActivity(carId, "photos_updated", `${photos.length} vehicle photos saved.`, user.id, {}, token); return json(res, 200, { photos });
      }
      if (action === "block") {
        const type = BLOCK_TYPES.includes(body.block_type) ? body.block_type : "manual_hold", startAt = iso(body.start_at), endAt = iso(body.end_at); if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) throw Object.assign(new Error("Choose a valid blocked date range."), { status: 400 });
        const rows = await db("vehicle_blocks", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ car_id: carId, block_type: type, start_at: startAt, end_at: endAt, reason: clean(body.reason, 180), notes: clean(body.notes, 2000), created_by: user.id }) }, token); await addActivity(carId, "dates_blocked", `${clean(body.reason,180) || type} · ${startAt.slice(0,10)} to ${endAt.slice(0,10)}.`, user.id, {}, token); return json(res, 201, { block: rows[0] });
      }
      if (action === "expense") {
        const payload = { car_id: carId, agreement_id: validUuid(body.agreement_id), expense_scope: body.expense_scope === "reservation" ? "reservation" : "general", category: ["maintenance","repair","tires","detail","fuel","registration","insurance","transportation","parking","tolls","other"].includes(body.category) ? body.category : "other", amount: amount(body.amount), expense_date: date(body.expense_date) || new Date().toISOString().slice(0,10), vendor: clean(body.vendor,180), notes: clean(body.notes,2000), receipt_path: clean(body.receipt_path,1000) || null, created_by:user.id };
        const rows = await db("vehicle_expenses", { method:"POST", headers:{Prefer:"return=representation"}, body:JSON.stringify(payload) }, token); await addActivity(carId,"expense_added",`${payload.category} expense: $${payload.amount.toFixed(2)}.`,user.id,{},token); return json(res,201,{expense:rows[0]});
      }
      if (action === "maintenance") {
        const payload = { car_id:carId, service_type:clean(body.service_type,100)||"Other", service_date:date(body.service_date)||new Date().toISOString().slice(0,10), mileage:whole(body.mileage), vendor:clean(body.vendor,180), cost:amount(body.cost), notes:clean(body.notes,3000), receipt_path:clean(body.receipt_path,1000)||null, next_service_date:date(body.next_service_date), next_service_mileage:whole(body.next_service_mileage), unavailable_start:iso(body.unavailable_start), unavailable_end:iso(body.unavailable_end), status:["scheduled","in_service","completed","cancelled"].includes(body.status)?body.status:"completed", created_by:user.id };
        const rows=await db("vehicle_maintenance",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)},token); const record=rows[0]; if(payload.unavailable_start&&payload.unavailable_end) await db("vehicle_blocks",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({car_id:carId,block_type:"maintenance",start_at:payload.unavailable_start,end_at:payload.unavailable_end,reason:payload.service_type,notes:payload.notes,maintenance_id:record.id,created_by:user.id})},token); if(payload.cost>0) await db("vehicle_expenses",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({car_id:carId,expense_scope:"general",category:"maintenance",amount:payload.cost,expense_date:payload.service_date,vendor:payload.vendor,notes:`Maintenance: ${payload.service_type}${payload.notes?` · ${payload.notes}`:""}`,created_by:user.id})},token); await addActivity(carId,"maintenance_added",`${payload.service_type} · $${payload.cost.toFixed(2)}.`,user.id,{},token); return json(res,201,{maintenance:record});
      }
      if (action === "document") {
        const type=["registration","insurance","lease_loan","partner_agreement","inspection","other"].includes(body.document_type)?body.document_type:"other"; const payload={car_id:carId,document_type:type,file_path:clean(body.file_path,1000)||null,file_name:clean(body.file_name,240),effective_date:date(body.effective_date),expiration_date:date(body.expiration_date),notes:clean(body.notes,2000),created_by:user.id}; const rows=await db("vehicle_documents",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)},token); await addActivity(carId,"document_uploaded",`${type.replaceAll("_"," ")} document saved.`,user.id,{},token); return json(res,201,{document:rows[0]});
      }
      if (action === "mileage") {
        const mileage=whole(body.mileage); if(mileage==null) throw Object.assign(new Error("Enter the current mileage."),{status:400}); await db(`cars?id=eq.${carId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({current_mileage:mileage,mileage_source:clean(body.source,80)||"manual",mileage_updated_at:new Date().toISOString()})},token); const rows=await db("vehicle_mileage_history",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({car_id:carId,agreement_id:validUuid(body.agreement_id),mileage,source:clean(body.source,80)||"manual",recorded_by:user.id})},token); await addActivity(carId,"mileage_updated",`Mileage updated to ${mileage.toLocaleString()} mi.`,user.id,{},token); return json(res,201,{mileage:rows[0]});
      }
      if (action === "archive") { await db(`cars?id=eq.${carId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({is_active:false,operational_status:"inactive"})},token); await addActivity(carId,"vehicle_archived","Vehicle archived; history preserved.",user.id,{},token); return json(res,200,{archived:true}); }
    }
    if (req.method === "DELETE") {
      const table = { block:"vehicle_blocks", expense:"vehicle_expenses", maintenance:"vehicle_maintenance", document:"vehicle_documents" }[clean(req.query?.type,30)]; const id=validUuid(req.query?.id); if(!table||!id) throw Object.assign(new Error("Select a valid fleet record."),{status:400}); await db(`${table}?id=eq.${id}&car_id=eq.${carId}`,{method:"DELETE",headers:{Prefer:"return=minimal"}},token); await addActivity(carId,"record_removed",`${clean(req.query?.type,30)} record removed.`,user.id,{},token); return json(res,200,{deleted:true});
    }
    res.setHeader("Allow","GET, POST, PATCH, DELETE, OPTIONS"); return json(res,405,{error:"Method not allowed."});
  } catch (error) { return json(res,error.status||500,{error:error.message||"Fleet request failed.",conflict:error.conflict||null}); }
}
