const DRAFT_KEY = "kds_exotics_admin_car_drafts";
const DELETED_KEY = "kds_exotics_admin_deleted_car_slugs";
const REFRESH_KEY = "kds_exotics_fleet_refresh";
const MAX_LISTING_PHOTOS = 3;

export const ADMIN_CAR_DRAFTS_KEY = DRAFT_KEY;
export const ADMIN_DELETED_CARS_KEY = DELETED_KEY;
export const ADMIN_FLEET_REFRESH_KEY = REFRESH_KEY;

export function slugifyVehicle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function readCarDrafts() {
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function readDeletedCarSlugs() {
  try {
    return JSON.parse(window.localStorage.getItem(DELETED_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeDeletedCarSlugs(slugs) {
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...new Set(slugs.filter(Boolean))]));
}

export function writeCarDraft(draft) {
  const drafts = readCarDrafts();
  const slug = draft.slug || slugifyVehicle(draft.name);
  const nextDraft = { ...draft, slug, updated_at: new Date().toISOString() };
  const index = drafts.findIndex((item) => item.slug === slug);

  if (index >= 0) {
    drafts[index] = nextDraft;
  } else {
    drafts.push(nextDraft);
  }

  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  writeDeletedCarSlugs(readDeletedCarSlugs().filter((item) => item !== slug));
  return nextDraft;
}

export function deleteCarDraft(slugValue) {
  const slug = slugifyVehicle(slugValue);
  if (!slug) return;

  const drafts = readCarDrafts().filter((item) => slugifyVehicle(item.slug || item.name) !== slug);
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  writeDeletedCarSlugs([...readDeletedCarSlugs(), slug]);
}

export function toPublicCar(car) {
  const gallery = (car.gallery?.length ? car.gallery : [car.image_url || car.image].filter(Boolean)).slice(0, MAX_LISTING_PHOTOS);
  const image = gallery[0] || car.image_url || car.image || "/assets/kds-hero.png";

  return {
    ...car,
    slug: car.slug || slugifyVehicle(car.name),
    categoryLabel: car.categoryLabel || car.category_label,
    category_label: car.category_label || car.categoryLabel,
    image,
    image_url: car.image_url || image,
    gallery,
  };
}

export function mergeCarDrafts(baseFleet) {
  const drafts = readCarDrafts().map(toPublicCar);
  const deletedSlugs = new Set(readDeletedCarSlugs());
  const draftBySlug = new Map(drafts.map((draft) => [draft.slug, draft]));
  const used = new Set();
  const merged = baseFleet
    .filter((car) => !deletedSlugs.has(car.slug || slugifyVehicle(car.name)))
    .map((car) => {
      const slug = car.slug || slugifyVehicle(car.name);
      const draft = draftBySlug.get(slug);
      if (!draft) return toPublicCar(car);
      used.add(slug);
      return toPublicCar({ ...car, ...draft });
    });

  drafts.forEach((draft) => {
    if (!used.has(draft.slug) && !deletedSlugs.has(draft.slug)) merged.push(toPublicCar(draft));
  });

  return merged;
}

export function signalFleetRefresh() {
  window.localStorage.setItem(REFRESH_KEY, new Date().toISOString());
}
