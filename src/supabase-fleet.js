import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const configured = Boolean(SUPABASE_URL && SUPABASE_URL.startsWith("https://"));
let supabasePromise = null;
const MAX_LISTING_PHOTOS = 3;
const ANALYTICS_SESSION_KEY = "prestige_luxor_fleet_analytics_session";
const VEHICLE_SLUG_ALIASES = Object.freeze({ porschepanamera: "porsche-panamera" });

export const isSupabaseFleetConfigured = configured;

async function getSupabase() {
  if (!configured) return null;
  if (!supabasePromise) {
    supabasePromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY))
      .catch((error) => {
        supabasePromise = null;
        throw error;
      });
  }
  return supabasePromise;
}

function mapCar(row) {
  const photos = [...(row.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
  const gallery = photos.map((photo) => photo.url).filter(Boolean).slice(0, MAX_LISTING_PHOTOS);
  const image = gallery[0] || row.image_url || "/assets/prestige-luxor-hero.png";

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
    updatedAt: row.updated_at || "",
  };
}

export function cacheSafeFleetImageUrl(url, updatedAt = "") {
  const source = String(url || "");
  if (!source || !updatedAt || !source.includes("/storage/v1/object/public/")) return source;

  try {
    const parsed = new URL(source, window.location.origin);
    parsed.searchParams.set("v", String(Date.parse(updatedAt) || updatedAt));
    return parsed.href;
  } catch {
    return source;
  }
}

export function optimizedFleetImageUrl(url, { width = 900, height = 675, quality = 78, updatedAt = "" } = {}) {
  const source = cacheSafeFleetImageUrl(url, updatedAt);
  if (!source) return source;

  if (source.includes("/storage/v1/object/public/")) {
    try {
      const parsed = new URL(source, window.location.origin);
      parsed.pathname = parsed.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      parsed.searchParams.set("width", String(width));
      parsed.searchParams.set("height", String(height));
      parsed.searchParams.set("resize", "cover");
      parsed.searchParams.set("quality", String(quality));
      return parsed.href;
    } catch {
      return source;
    }
  }

  const [path, query = ""] = source.split("?");
  let optimized = "";
  if (/^\/assets\/fleet\/[^/]+\.(jpe?g|png)$/i.test(path)) {
    optimized = path.replace("/assets/fleet/", "/assets/fleet-optimized/").replace(/\.(jpe?g|png)$/i, ".webp");
  } else if (/^\/assets\/fleet-galleries\/.+\.(jpe?g|png)$/i.test(path)) {
    optimized = path.replace("/assets/fleet-galleries/", "/assets/fleet-galleries-optimized/").replace(/\.(jpe?g|png)$/i, ".webp");
  } else if (path === "/assets/prestige-luxor-hero.png") {
    optimized = "/assets/optimized/prestige-luxor-hero.webp";
  }
  return optimized ? `${optimized}${query ? `?${query}` : ""}` : source;
}

function escapeImageAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function fleetImageSources(url, options = {}) {
  const fallback = cacheSafeFleetImageUrl(url, options.updatedAt || "") || "/assets/prestige-luxor-hero.png";
  const optimized = optimizedFleetImageUrl(fallback, options) || fallback;
  return { optimized, fallback };
}

export function fleetPictureMarkup(url, {
  alt = "",
  width = 900,
  height = 675,
  quality = 78,
  updatedAt = "",
  loading = "lazy",
  fetchPriority = "",
  pictureClass = "",
  imageClass = "",
  preferOriginalLocal = false,
} = {}) {
  const { optimized, fallback } = fleetImageSources(url, { width, height, quality, updatedAt });
  const isLocalGallery = /^\/assets\/fleet-galleries\//i.test(fallback.split("?")[0]);
  const displaySource = preferOriginalLocal && isLocalGallery ? fallback : optimized;
  const sourceType = /\.webp(?:\?|$)/i.test(displaySource) ? ' type="image/webp"' : "";
  const loadingAttribute = loading === "eager" || loading === "lazy" ? ` loading="${loading}"` : "";
  const priorityAttribute = ["high", "low", "auto"].includes(fetchPriority) ? ` fetchpriority="${fetchPriority}"` : "";
  const pictureClassAttribute = pictureClass ? ` class="${escapeImageAttribute(pictureClass)}"` : "";
  const imageClassAttribute = imageClass ? ` class="${escapeImageAttribute(imageClass)}"` : "";
  return `<picture${pictureClassAttribute}><source srcset="${escapeImageAttribute(displaySource)}"${sourceType} /><img${imageClassAttribute} src="${escapeImageAttribute(fallback)}" alt="${escapeImageAttribute(alt)}" width="${Number(width)}" height="${Number(height)}"${loadingAttribute} decoding="async"${priorityAttribute} /></picture>`;
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
  const supabase = await getSupabase();
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
  const supabase = await getSupabase();
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

  return data.filter((row) => !VEHICLE_SLUG_ALIASES[row.slug]).map(mapCar);
}

export async function loadVehicleFromSupabase(slug) {
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("cars")
    .select("*, car_photos(position, url)")
    .eq("slug", VEHICLE_SLUG_ALIASES[slug] || slug)
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
  const supabase = await getSupabase();
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
