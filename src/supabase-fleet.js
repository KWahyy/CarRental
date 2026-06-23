import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const configured = Boolean(SUPABASE_URL && SUPABASE_URL.startsWith("https://"));
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

function mapCar(row) {
  const photos = [...(row.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
  const gallery = photos.map((photo) => photo.url).filter(Boolean);
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
  };
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
    console.warn("Could not load Supabase vehicle:", error.message);
    return null;
  }

  return mapCar(data);
}
