import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { mergeCarDrafts, slugifyVehicle, writeCarDraft } from "./admin-store.js";
import { fleet } from "./fleet-data.js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_STORAGE_BUCKET, SUPABASE_URL } from "./supabase-config.js";

const loginView = document.querySelector("[data-login-view]");
const adminView = document.querySelector("[data-admin-view]");
const loginForm = document.querySelector("[data-login-form]");
const loginStatus = document.querySelector("[data-login-status]");
const adminStatus = document.querySelector("[data-admin-status]");
const configWarning = document.querySelector("[data-config-warning]");
const signOutButton = document.querySelector("[data-sign-out]");
const seedButton = document.querySelector("[data-seed-fleet]");
const newCarButton = document.querySelector("[data-new-car]");
const carList = document.querySelector("[data-car-list]");
const carCount = document.querySelector("[data-car-count]");
const carForm = document.querySelector("[data-car-form]");
const editorTitle = document.querySelector("[data-editor-title]");
const editorPreview = document.querySelector("[data-editor-preview]");
const editorPrice = document.querySelector("[data-editor-price]");
const editorMeta = document.querySelector("[data-editor-meta]");
const photoList = document.querySelector("[data-photo-list]");
const addPhotoButton = document.querySelector("[data-add-photo]");
const availabilityInput = document.querySelector("[data-availability-date]");
const availabilityList = document.querySelector("[data-availability-list]");

const configured = Boolean(SUPABASE_URL && SUPABASE_URL.startsWith("https://"));
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

let cars = [];
let selectedCarId = null;
let photos = [];
let availableDates = [];
let draggedPhotoIndex = null;

function isLocalCarId(id) {
  return String(id || "").startsWith("local:");
}

function setStatus(node, message, tone = "") {
  node.textContent = message;
  node.dataset.tone = tone;
}

function friendlyError(error) {
  const message = error?.message || String(error);
  if (message.includes("schema cache") || message.includes("public.cars") || message.includes("relation")) {
    return "Database setup needed. The current website cars are shown here. Run supabase/schema.sql in Supabase, then click Sync current fleet.";
  }
  if (message.includes("row-level security")) {
    return "Supabase permission setup needs attention. Re-run supabase/schema.sql, then try again.";
  }
  return message;
}

function slugify(value) {
  return slugifyVehicle(value);
}

function linesToArray(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function seatsFor(vehicle) {
  if (vehicle.seats) return vehicle.seats;
  if (vehicle.category?.includes("suv")) return 5;
  if (vehicle.name?.includes("M3")) return 5;
  if (vehicle.name?.includes("M4")) return 4;
  return 2;
}

function normalizeLocalCar(car) {
  return {
    id: `local:${car.slug}`,
    slug: car.slug,
    name: car.name,
    make: car.make,
    model: car.model,
    category: car.category,
    category_label: car.categoryLabel,
    price: car.price,
    mileage: car.mileage,
    color: car.color,
    summary: car.summary,
    seats: seatsFor(car),
    image_url: car.image,
    gallery: car.gallery,
    tags: car.tags,
    details: car.details,
    is_active: true,
    is_featured: true,
    source: "website",
  };
}

function localFleetCars() {
  return mergeCarDrafts(fleet).map((car) =>
    normalizeLocalCar({
      ...car,
      categoryLabel: car.categoryLabel || car.category_label,
    }),
  );
}

function emptyCar() {
  return {
    id: "",
    slug: "",
    name: "",
    make: "",
    model: "",
    category: "supercar",
    category_label: "Supercar",
    price: 0,
    mileage: "100 miles/day",
    seats: 2,
    color: "",
    summary: "",
    tags: [],
    details: [],
    is_active: true,
    is_featured: true,
  };
}

function selectedCar() {
  return cars.find((car) => String(car.id) === String(selectedCarId)) || null;
}

function carImage(car) {
  return car?.image_url || car?.gallery?.[0] || "/assets/kds-hero.png";
}

function previewUrl(photo) {
  return photo?.previewUrl || photo?.url || "/assets/kds-hero.png";
}

function normalizePhotoOrder() {
  photos = photos.map((photo, index) => ({ ...photo, position: index + 1 }));
}

function updatePhotoPreview() {
  editorPreview.src = previewUrl(photos[0]);
}

function reorderPhotos(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || !photos[fromIndex] || !photos[toIndex]) return;
  const [movedPhoto] = photos.splice(fromIndex, 1);
  photos.splice(toIndex, 0, movedPhoto);
  normalizePhotoOrder();
  renderPhotos();
  updatePhotoPreview();
}

function requireConfig() {
  if (configured) return true;
  configWarning.hidden = false;
  setStatus(adminStatus, "Missing Supabase Project URL. Add it to src/supabase-config.js.", "error");
  return false;
}

async function runQuery(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function showAdmin(isAdmin) {
  loginView.hidden = isAdmin;
  adminView.hidden = !isAdmin;
}

function renderCarList() {
  const localCount = cars.filter((car) => isLocalCarId(car.id)).length;
  carCount.textContent = localCount
    ? `${cars.length} website ${cars.length === 1 ? "car" : "cars"}`
    : `${cars.length} ${cars.length === 1 ? "car" : "cars"}`;
  carList.innerHTML = cars
    .map(
      (car) => `
        <button class="admin-car-button ${String(car.id) === String(selectedCarId) ? "active" : ""}" type="button" data-car-id="${car.id}">
          <img class="admin-car-thumb" src="${carImage(car)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/assets/kds-hero.png';" />
          <span>${isLocalCarId(car.id) ? "Website fleet" : car.make || "Vehicle"}</span>
          <strong>${car.name}</strong>
          <small>$${Number(car.price || 0).toLocaleString()}/day</small>
        </button>
      `,
    )
    .join("");
}

function renderPhotos() {
  normalizePhotoOrder();
  photoList.innerHTML = photos
    .map(
      (photo, index) => `
        <article class="photo-editor-row" data-photo-index="${index}" draggable="true">
          <button class="photo-drag-handle" type="button" aria-label="Drag photo ${index + 1} to reorder">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 6h8M8 12h8M8 18h8" /></svg>
          </button>
          <div class="photo-number">${index + 1}</div>
          <img src="${previewUrl(photo)}" alt="" onerror="this.onerror=null;this.src='/assets/kds-hero.png';" />
          <label>
            Image URL
            <input data-photo-url value="${photo.url || ""}" placeholder="https://..." />
          </label>
          <label>
            Upload
            <input data-photo-upload type="file" accept="image/*" />
          </label>
          <div class="photo-order-actions" aria-label="Photo order controls">
            <button class="ghost-button compact" type="button" data-move-photo="-1" ${index === 0 ? "disabled" : ""} aria-label="Move photo ${index + 1} up">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6" /></svg>
            </button>
            <button class="ghost-button compact" type="button" data-move-photo="1" ${index === photos.length - 1 ? "disabled" : ""} aria-label="Move photo ${index + 1} down">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
          <button class="ghost-button compact" type="button" data-remove-photo>Remove</button>
        </article>
      `,
    )
    .join("");
  updatePhotoPreview();
}

function renderAvailability() {
  availabilityList.innerHTML = availableDates.length
    ? availableDates
        .sort()
        .map(
          (date) => `
            <button class="availability-chip" type="button" data-remove-date="${date}" aria-label="Remove ${date}">
              ${date}
            </button>
          `,
        )
        .join("")
    : `<p class="admin-empty">No available dates selected yet.</p>`;
}

function fillForm(car) {
  carForm.elements.id.value = car.id || "";
  carForm.elements.name.value = car.name || "";
  carForm.elements.slug.value = car.slug || "";
  carForm.elements.make.value = car.make || "";
  carForm.elements.model.value = car.model || "";
  carForm.elements.category.value = car.category || "";
  carForm.elements.category_label.value = car.category_label || "";
  carForm.elements.price.value = car.price || 0;
  carForm.elements.mileage.value = car.mileage || "";
  carForm.elements.seats.value = car.seats || seatsFor(car);
  carForm.elements.color.value = car.color || "";
  carForm.elements.summary.value = car.summary || "";
  carForm.elements.tags.value = arrayToLines(car.tags);
  carForm.elements.details.value = arrayToLines(car.details);
  editorTitle.textContent = car.name || "New car";
  editorPreview.src = carImage(car);
  editorPreview.alt = car.name ? `${car.name} preview` : "";
  editorPrice.textContent = `$${Number(car.price || 0).toLocaleString()}/day`;
  editorMeta.textContent = [car.category_label, `${car.seats || seatsFor(car)} seats`, car.mileage].filter(Boolean).join(" / ");
}

async function selectCar(carId) {
  selectedCarId = carId;
  const car = selectedCar() || emptyCar();
  fillForm(car);
  renderCarList();

  if (!car.id) {
    photos = [{ position: 1, url: "" }];
    availableDates = [];
    renderPhotos();
    renderAvailability();
    return;
  }

  if (isLocalCarId(car.id) || !requireConfig()) {
    const gallery = car.gallery?.length ? car.gallery : [car.image_url].filter(Boolean);
    photos = gallery.map((url, index) => ({ position: index + 1, url }));
    availableDates = [];
    renderPhotos();
    renderAvailability();
    setStatus(adminStatus, "This car is loaded from the website fleet. Save it or sync the fleet to publish it into Supabase.", "");
    return;
  }

  const [photoRows, dateRows] = await Promise.all([
    runQuery(supabase.from("car_photos").select("*").eq("car_id", car.id).order("position")),
    runQuery(supabase.from("car_available_dates").select("date").eq("car_id", car.id).order("date")),
  ]);

  photos = photoRows.length ? photoRows.map((row) => ({ id: row.id, position: row.position, url: row.url })) : [{ position: 1, url: car.image_url || "" }];
  availableDates = dateRows.map((row) => row.date);
  renderPhotos();
  renderAvailability();
}

async function loadCars() {
  if (!requireConfig()) return;

  try {
    cars = await runQuery(supabase.from("cars").select("*").order("name"));
  } catch (error) {
    cars = localFleetCars();
    selectedCarId = cars[0]?.id || null;
    renderCarList();
    if (selectedCarId) await selectCar(selectedCarId);
    setStatus(adminStatus, friendlyError(error), "error");
    return;
  }

  if (!cars.length) {
    cars = localFleetCars();
    selectedCarId = cars[0]?.id || null;
    renderCarList();
    if (selectedCarId) await selectCar(selectedCarId);
    setStatus(adminStatus, "Showing the current website fleet. Click Sync current fleet to save these cars into Supabase.", "");
    return;
  }

  if (cars.length && !selectedCarId) selectedCarId = cars[0].id;
  renderCarList();
  if (selectedCarId) await selectCar(selectedCarId);
}

async function uploadPhoto(file, slug, position) {
  const safeName = `${slug || "vehicle"}/${String(position).padStart(2, "0")}-${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-")}`;
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(safeName, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(safeName).data.publicUrl;
}

async function savePhotos(carId, slug) {
  const nextPhotos = [];

  normalizePhotoOrder();
  for (const [index, photo] of photos.entries()) {
    const position = index + 1;
    const url = photo.file ? await uploadPhoto(photo.file, slug, position) : photo.url?.trim();
    if (url) nextPhotos.push({ car_id: carId, position, url });
  }

  await runQuery(supabase.from("car_photos").delete().eq("car_id", carId));
  if (nextPhotos.length) await runQuery(supabase.from("car_photos").insert(nextPhotos));
  return nextPhotos;
}

function currentPhotoUrls() {
  normalizePhotoOrder();
  return photos.map((photo) => photo.previewUrl || photo.url).filter(Boolean);
}

function buildCarPayloadFromForm() {
  const formData = new FormData(carForm);
  const slug = formData.get("slug").trim() || slugify(formData.get("name"));

  return {
    slug,
    name: formData.get("name").trim(),
    make: formData.get("make").trim(),
    model: formData.get("model").trim(),
    category: formData.get("category").trim(),
    category_label: formData.get("category_label").trim(),
    categoryLabel: formData.get("category_label").trim(),
    price: Number(formData.get("price")),
    mileage: formData.get("mileage").trim(),
    seats: Number(formData.get("seats")),
    color: formData.get("color").trim(),
    summary: formData.get("summary").trim(),
    tags: linesToArray(formData.get("tags")),
    details: linesToArray(formData.get("details")),
    gallery: currentPhotoUrls(),
    image: currentPhotoUrls()[0] || "/assets/kds-hero.png",
    image_url: currentPhotoUrls()[0] || "/assets/kds-hero.png",
    is_active: true,
    is_featured: true,
  };
}

async function saveLocalDraft() {
  const draft = writeCarDraft(buildCarPayloadFromForm());
  cars = localFleetCars();
  selectedCarId = `local:${draft.slug}`;
  renderCarList();
  await selectCar(selectedCarId);
  setStatus(adminStatus, "Saved locally. Your changes are visible in this browser. Run database setup when you are ready to publish to Supabase.", "success");
}

async function saveAvailability(carId) {
  await runQuery(supabase.from("car_available_dates").delete().eq("car_id", carId));
  if (availableDates.length) {
    await runQuery(
      supabase.from("car_available_dates").insert(availableDates.map((date) => ({ car_id: carId, date }))),
    );
  }
}

async function saveCar(event) {
  event.preventDefault();
  if (!requireConfig()) {
    await saveLocalDraft();
    return;
  }

  try {
    const formData = new FormData(carForm);
    const id = formData.get("id");
    const savedId = id && !isLocalCarId(id) ? id : "";
    const { categoryLabel, gallery, image, ...carPayload } = buildCarPayloadFromForm();

    setStatus(adminStatus, "Saving car...");
    const saved = savedId
      ? await runQuery(supabase.from("cars").update(carPayload).eq("id", savedId).select().single())
      : await runQuery(supabase.from("cars").insert(carPayload).select().single());

    const savedPhotos = await savePhotos(saved.id, carPayload.slug);
    await saveAvailability(saved.id);
    if (savedPhotos[0]?.url) {
      await runQuery(supabase.from("cars").update({ image_url: savedPhotos[0].url }).eq("id", saved.id));
    }

    selectedCarId = saved.id;
    await loadCars();
    setStatus(adminStatus, "Saved to Supabase.", "success");
  } catch (error) {
    if (friendlyError(error).startsWith("Database setup needed")) {
      await saveLocalDraft();
    } else {
      setStatus(adminStatus, friendlyError(error), "error");
    }
  }
}

async function seedFleet() {
  if (!requireConfig()) return;
  try {
    setStatus(adminStatus, "Syncing current website fleet...");

    for (const localCar of fleet) {
      const { gallery, id, source, ...carPayload } = normalizeLocalCar(localCar);
      const saved = await runQuery(supabase.from("cars").upsert(carPayload, { onConflict: "slug" }).select().single());
      const photoRows = localCar.gallery.map((url, index) => ({ car_id: saved.id, position: index + 1, url }));
      await runQuery(supabase.from("car_photos").delete().eq("car_id", saved.id));
      if (photoRows.length) await runQuery(supabase.from("car_photos").insert(photoRows));
      if (photoRows[0]?.url) await runQuery(supabase.from("cars").update({ image_url: photoRows[0].url }).eq("id", saved.id));
    }

    selectedCarId = null;
    await loadCars();
    setStatus(adminStatus, "Current website fleet synced into Supabase.", "success");
  } catch (error) {
    setStatus(adminStatus, friendlyError(error), "error");
  }
}

async function init() {
  configWarning.hidden = configured;

  if (!configured) {
    showAdmin(false);
    loginStatus.textContent = "Supabase Project URL is missing. Add it before logging in.";
    return;
  }

  const { data } = await supabase.auth.getSession();
  showAdmin(Boolean(data.session));
  if (data.session) await loadCars();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configured) {
    setStatus(loginStatus, "Add your Supabase Project URL first.", "error");
    return;
  }

  const formData = new FormData(loginForm);
  setStatus(loginStatus, "Signing in...");
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) {
    setStatus(loginStatus, error.message, "error");
    return;
  }

  setStatus(loginStatus, "");
  showAdmin(true);
  await loadCars();
});

signOutButton.addEventListener("click", async () => {
  await supabase?.auth.signOut();
  showAdmin(false);
});

newCarButton.addEventListener("click", () => {
  selectedCarId = null;
  photos = [{ position: 1, url: "" }];
  availableDates = [];
  fillForm(emptyCar());
  renderCarList();
  renderPhotos();
  renderAvailability();
});

carList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-car-id]");
  if (button) selectCar(button.dataset.carId);
});

carForm.elements.name.addEventListener("input", () => {
  if (!carForm.elements.id.value) carForm.elements.slug.value = slugify(carForm.elements.name.value);
});

addPhotoButton.addEventListener("click", () => {
  photos.push({ position: photos.length + 1, url: "" });
  renderPhotos();
});

photoList.addEventListener("click", (event) => {
  const moveButton = event.target.closest("[data-move-photo]");
  if (moveButton) {
    const row = moveButton.closest("[data-photo-index]");
    const fromIndex = Number(row.dataset.photoIndex);
    reorderPhotos(fromIndex, fromIndex + Number(moveButton.dataset.movePhoto));
    return;
  }

  if (!event.target.matches("[data-remove-photo]")) return;
  const row = event.target.closest("[data-photo-index]");
  photos.splice(Number(row.dataset.photoIndex), 1);
  normalizePhotoOrder();
  renderPhotos();
});

photoList.addEventListener("input", (event) => {
  if (!event.target.matches("[data-photo-url]")) return;
  const row = event.target.closest("[data-photo-index]");
  photos[Number(row.dataset.photoIndex)].url = event.target.value;
  if (Number(row.dataset.photoIndex) === 0) updatePhotoPreview();
});

photoList.addEventListener("change", (event) => {
  if (!event.target.matches("[data-photo-upload]")) return;
  const row = event.target.closest("[data-photo-index]");
  const index = Number(row.dataset.photoIndex);
  const file = event.target.files[0];
  if (!file) return;

  photos[index].file = file;
  photos[index].previewUrl = URL.createObjectURL(file);
  renderPhotos();
});

photoList.addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (!row) return;

  draggedPhotoIndex = Number(row.dataset.photoIndex);
  row.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(draggedPhotoIndex));
});

photoList.addEventListener("dragover", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (!row || draggedPhotoIndex === null) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  photoList.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target"));
  row.classList.add("drop-target");
});

photoList.addEventListener("dragleave", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (row && !row.contains(event.relatedTarget)) row.classList.remove("drop-target");
});

photoList.addEventListener("drop", (event) => {
  const row = event.target.closest("[data-photo-index]");
  if (!row || draggedPhotoIndex === null) return;

  event.preventDefault();
  reorderPhotos(draggedPhotoIndex, Number(row.dataset.photoIndex));
  draggedPhotoIndex = null;
});

photoList.addEventListener("dragend", () => {
  draggedPhotoIndex = null;
  photoList.querySelectorAll(".dragging, .drop-target").forEach((item) => item.classList.remove("dragging", "drop-target"));
});

availabilityInput.addEventListener("change", () => {
  if (!availabilityInput.value || availableDates.includes(availabilityInput.value)) return;
  availableDates.push(availabilityInput.value);
  availabilityInput.value = "";
  renderAvailability();
});

availabilityList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-date]");
  if (!button) return;
  availableDates = availableDates.filter((date) => date !== button.dataset.removeDate);
  renderAvailability();
});

carForm.addEventListener("submit", saveCar);
seedButton.addEventListener("click", seedFleet);

init();
