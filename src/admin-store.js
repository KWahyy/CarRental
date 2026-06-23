const DRAFT_KEY = "kds_exotics_admin_car_drafts";

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
  return nextDraft;
}

export function toPublicCar(car) {
  const gallery = car.gallery?.length ? car.gallery : [car.image_url || car.image].filter(Boolean);
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
  const draftBySlug = new Map(drafts.map((draft) => [draft.slug, draft]));
  const used = new Set();
  const merged = baseFleet.map((car) => {
    const slug = car.slug || slugifyVehicle(car.name);
    const draft = draftBySlug.get(slug);
    if (!draft) return toPublicCar(car);
    used.add(slug);
    return toPublicCar({ ...car, ...draft });
  });

  drafts.forEach((draft) => {
    if (!used.has(draft.slug)) merged.push(toPublicCar(draft));
  });

  return merged;
}
