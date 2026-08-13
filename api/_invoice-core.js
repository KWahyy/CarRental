const MAX_LENGTH = 5000;
const PUBLIC_SUPABASE_URL = "https://vqkuggjlpmzqgyouaryt.supabase.co";
const PUBLIC_SUPABASE_KEY = "sb_publishable_dntxPFRlTI9cmzRby1UGPg_5fG1HFoP";
const authCache = new Map();
const employeeCache = new Map();
const AUTH_CACHE_MS = 60_000;

function cacheGet(cache, key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) { cache.delete(key); return null; }
  return entry.value;
}

function cacheSet(cache, key, value) {
  if (cache.size >= 100) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + AUTH_CACHE_MS });
  return value;
}

export const BUSINESS = {
  name: "Prestige Luxor",
  address: "212 Technology Dr Unit K, Irvine, CA 92618",
  phone: "(949) 620-0024",
  email: "Contact@prestigeluxor.com",
  website: "prestigeluxor.com",
};

export const DEFAULT_TERMS = "Full payment is due by the due date to confirm the reservation. The refundable security deposit is subject to inspection and deductions for excess mileage, fuel, tolls, late return, damage, or other charges permitted by the signed rental agreement. A valid driver license, proof of insurance, and driver approval are required. Changes and cancellations are governed by the signed rental agreement. This invoice does not replace the rental agreement.";

export function clean(value, max = MAX_LENGTH) {
  return String(value ?? "").trim().slice(0, max);
}

export function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(number, 0) : 0;
}

export function integer(value, fallback = 1) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(number, 1) : fallback;
}

export function calculateTotals(input = {}) {
  const dailyRate = money(input.daily_rate);
  const rentalDays = integer(input.rental_days);
  const deliveryFee = money(input.delivery_fee);
  const addonsTotal = money(input.addons_total);
  const insuranceFee = money(input.insurance_fee);
  const mileageFee = money(input.mileage_fee);
  const fuelFee = money(input.fuel_fee);
  const tollsFee = money(input.tolls_fee);
  const damageFee = money(input.damage_fee);
  const otherFee = money(input.other_fee);
  const discount = money(input.discount);
  const refundableDeposit = money(input.refundable_deposit);
  const amountPaid = money(input.amount_paid);
  const subtotal = Math.max(dailyRate * rentalDays + deliveryFee + addonsTotal + insuranceFee + mileageFee + fuelFee + tollsFee + damageFee + otherFee - discount, 0);
  const depositMethod = ["charge", "authorization_hold"].includes(input.deposit_method) ? input.deposit_method : "charge";
  const total = subtotal + (depositMethod === "charge" ? refundableDeposit : 0);
  return {
    daily_rate: dailyRate,
    rental_days: rentalDays,
    delivery_fee: deliveryFee,
    addons_total: addonsTotal,
    insurance_fee: insuranceFee,
    mileage_fee: mileageFee,
    fuel_fee: fuelFee,
    tolls_fee: tollsFee,
    damage_fee: damageFee,
    other_fee: otherFee,
    discount,
    refundable_deposit: refundableDeposit,
    deposit_method: depositMethod,
    subtotal,
    total,
    amount_paid: amountPaid,
    balance_due: Math.max(total - amountPaid, 0),
  };
}

export function normalizeInvoice(input = {}) {
  const totals = calculateTotals(input);
  return {
    source_type: ["manual", "quote", "booking"].includes(input.source_type) ? input.source_type : "manual",
    source_id: clean(input.source_id, 120) || null,
    status: ["draft", "finalized", "sent", "due", "partially_paid", "paid", "overdue", "refunded", "void"].includes(input.status) ? input.status : "draft",
    issue_date: clean(input.issue_date, 20) || new Date().toISOString().slice(0, 10),
    due_date: clean(input.due_date, 20) || null,
    valid_through: clean(input.valid_through, 20) || null,
    customer_name: clean(input.customer_name, 180),
    customer_email: clean(input.customer_email, 240),
    customer_phone: clean(input.customer_phone, 80),
    customer_address: clean(input.customer_address, 500),
    vehicle_name: clean(input.vehicle_name, 240),
    rental_start: clean(input.rental_start, 20) || null,
    rental_end: clean(input.rental_end, 20) || null,
    mileage_allowance: clean(input.mileage_allowance, 120) || "100 miles/day",
    overage_rate: clean(input.overage_rate, 120),
    other_label: clean(input.other_label, 120) || "Other charge",
    payment_method: ["stripe", "cash", "wire", "zelle", "other"].includes(input.payment_method) ? input.payment_method : "stripe",
    payment_reference: clean(input.payment_reference, 240),
    deposit_hold_status: ["not_applicable", "pending", "authorized", "released", "captured", "cancelled"].includes(input.deposit_hold_status)
      ? input.deposit_hold_status
      : totals.deposit_method === "authorization_hold" ? "pending" : "not_applicable",
    notes: clean(input.notes),
    terms: clean(input.terms) || DEFAULT_TERMS,
    ...totals,
  };
}

export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function setCors(req, res) {
  const origin = clean(req.headers.origin, 240);
  const allowed = ["https://prestigeluxor.com", "https://www.prestigeluxor.com", "http://localhost:4173", "http://127.0.0.1:4173"];
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
}

function usableSecret(value) {
  return Boolean(value && value !== "[SENSITIVE]");
}

export function serverConfig({ requireService = false } = {}) {
  const configuredUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = usableSecret(configuredUrl) ? configuredUrl : PUBLIC_SUPABASE_URL;
  const configuredServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;
  const serviceKey = usableSecret(configuredServiceKey) ? configuredServiceKey : "";
  if (requireService && !serviceKey) throw new Error("Supabase server credentials are missing.");
  return { url: url.replace(/\/$/, ""), key: serviceKey || PUBLIC_SUPABASE_KEY, serviceKey };
}

export async function requireUser(req) {
  const token = clean(req.headers.authorization, 3000).replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Sign in required."), { status: 401 });
  const cached = cacheGet(authCache, token);
  if (cached) return { user: cached, token };
  const { url, key } = serverConfig();
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw Object.assign(new Error("Your admin session has expired."), { status: 401 });
  return { user: cacheSet(authCache, token, await response.json()), token };
}

export async function requireEmployee(req, allowedRoles = ["owner", "manager", "staff"]) {
  const { user, token } = await requireUser(req);
  let profile = cacheGet(employeeCache, token);
  if (!profile) {
    const profiles = await db(`admin_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,display_name,role&limit=1`, {}, token);
    profile = profiles?.[0];
    if (profile) cacheSet(employeeCache, token, profile);
  }
  if (!profile || !allowedRoles.includes(profile.role)) {
    throw Object.assign(new Error("You do not have permission to use invoices."), { status: 403 });
  }
  return { user, profile, token };
}

export async function db(path, options = {}, userToken = "") {
  const { url, key, serviceKey } = serverConfig();
  if (!userToken && !serviceKey) throw new Error("Supabase server credentials are missing.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${userToken || key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw Object.assign(new Error(data?.message || data?.hint || "Database request failed."), { status: response.status, detail: data });
  return data;
}

export async function addEvent(invoiceId, eventType, detail, userId, metadata = {}, userToken = "") {
  return db("invoice_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ invoice_id: invoiceId, event_type: eventType, detail: clean(detail, 800), metadata, created_by: userId || null }),
  }, userToken);
}
