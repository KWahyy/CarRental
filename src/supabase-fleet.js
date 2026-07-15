import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const configured = Boolean(SUPABASE_URL && SUPABASE_URL.startsWith("https://"));
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
const MAX_LISTING_PHOTOS = 3;
const ANALYTICS_SESSION_KEY = "kds_fleet_analytics_session";

export const isSupabaseFleetConfigured = configured;

function mapCar(row) {
  const photos = [...(row.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
  const gallery = photos.map((photo) => photo.url).filter(Boolean).slice(0, MAX_LISTING_PHOTOS);
  const image = gallery[0] || row.image_url || "/assets/kds-hero.png";

  return {
    slug: row.slug,
    name: row.name,
    make: row.make,
    model: row.model,
    category: row.category,
    categoryLabel: row.category_label,
    price: row.price,
    mileage: row.mileage,
    color: row.color,
    summary: row.summary,
    seats: row.seats,
    image,
    gallery: gallery.length ? gallery : [image],
    tags: Array.isArray(row.tags) ? row.tags : [],
    details: Array.isArray(row.details) ? row.details : [],
    competitorPrice: row.competitor_price || null,
    competitorName: row.competitor_name || "",
    competitorUrl: row.competitor_url || "",
    competitorCheckedAt: row.competitor_checked_at || "",
  };
}

function analyticsSessionId() {
  try {
    let id = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    if (!id) {
      id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export async function recordFleetEvent(eventType, { carSlug = "", metadata = {} } = {}) {
  if (!supabase) return false;

  const { error } = await supabase.from("fleet_events").insert({
    event_type: eventType,
    car_slug: String(carSlug || "").slice(0, 120),
    session_id: analyticsSessionId().slice(0, 120),
    page_path: window.location.pathname.slice(0, 240),
    metadata,
  });

  if (error) {
    console.warn("Could not record fleet analytics:", error.message);
    return false;
  }
  return true;
}

export async function loadFleetFromSupabase() {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("cars")
    .select("*, car_photos(position, url)")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.warn("Could not load Supabase fleet:", error.message);
    return null;
  }

  return data.map(mapCar);
}

export async function loadVehicleFromSupabase(slug) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("cars")
    .select("*, car_photos(position, url)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.warn("Could not load Supabase vehicle:", error.message);
    throw error;
  }

  return mapCar(data);
}

export async function loadMonthlySpecialFromSupabase(month) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("monthly_specials")
    .select("month, headline, description, car_slugs")
    .eq("month", month)
    .maybeSingle();

  if (error) {
    console.warn("Could not load monthly special:", error.message);
    return null;
  }

  return data;
}
