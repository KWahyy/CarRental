import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../src/supabase-config.js";

if (!SUPABASE_URL?.startsWith("https://") || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Supabase configuration is required.");
}

const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
};

async function readTable(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

const [cars, specials] = await Promise.all([
  readTable("cars?select=id,slug,name,image_url,is_active,updated_at,car_photos(position,url)&order=name.asc"),
  readTable("monthly_specials?select=month,car_slugs,updated_at&order=month.desc"),
]);

const errors = [];
const activeCars = cars.filter((car) => car.is_active);
const activeBySlug = new Map(activeCars.map((car) => [car.slug, car]));

for (const car of activeCars) {
  const photos = [...(car.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
  const positions = photos.map((photo) => Number(photo.position));
  if (new Set(positions).size !== positions.length) errors.push(`${car.slug}: duplicate photo positions`);
  if (photos[0]?.url && photos[0].url !== car.image_url) errors.push(`${car.slug}: image_url does not match Photo 1`);
  if (!photos.length && car.image_url) errors.push(`${car.slug}: image_url exists without a car_photos row`);
}

for (const special of specials) {
  const slugs = Array.isArray(special.car_slugs) ? special.car_slugs : [];
  for (const slug of slugs) {
    if (!activeBySlug.has(slug)) errors.push(`${special.month}: monthly special references inactive or missing ${slug}`);
  }
}

const target = activeBySlug.get("2022-lamborghini-huracan");
const targetPhotos = [...(target?.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
const targetSpecials = specials.filter((special) => special.car_slugs?.includes("2022-lamborghini-huracan"));

console.log(
  JSON.stringify(
    {
      ok: errors.length === 0,
      activeCars: activeCars.length,
      monthlySpecials: specials.length,
      target: target
        ? {
            slug: target.slug,
            updatedAt: target.updated_at,
            mainImageMatchesPhoto1: target.image_url === targetPhotos[0]?.url,
            photoCount: targetPhotos.length,
            selectedMonths: targetSpecials.map((special) => special.month),
          }
        : null,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
