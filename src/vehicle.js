import { ADMIN_FLEET_REFRESH_KEY } from "./admin-store.js?v=cloud-save-20260624";
import { fleet, formatPrice, getVehicle } from "./fleet-data.js?v=cloud-save-20260624";
import { loadVehicleFromSupabase } from "./supabase-fleet.js?v=cloud-save-20260624";

const slug = document.body.dataset.vehicleSlug;
let baseVehicleFleet = fleet;
let vehicleFleet = baseVehicleFleet.slice();
let car = vehicleFleet.find((item) => item.slug === slug) || getVehicle(slug);
const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setAttr(selector, attribute, value) {
  const node = document.querySelector(selector);
  if (node) node.setAttribute(attribute, value);
}

function rateFromTag(tag) {
  const match = tag.match(/\$([\d,]+)(?:\.00)?\s+(.+)/);
  if (!match) return null;
  return {
    price: `$${match[1]}`,
    label: match[2],
  };
}

function seatsForVehicle(vehicle) {
  if (vehicle.category.includes("suv")) return "5 seats";
  if (vehicle.name.includes("M3")) return "5 seats";
  if (vehicle.name.includes("M4")) return "4 seats";
  return "2 seats";
}

function renderHeroMeta() {
  const summary = document.querySelector("[data-vehicle-summary]");
  if (!summary) return;

  const markup = `
      <div class="vehicle-hero-meta" data-vehicle-meta>
        <span>${car.categoryLabel}</span>
        <span>${seatsForVehicle(car)}</span>
        <span>${car.mileage}</span>
      </div>
    `;
  const existing = document.querySelector("[data-vehicle-meta]");
  if (existing) {
    existing.outerHTML = markup;
  } else {
    summary.insertAdjacentHTML("afterend", markup);
  }
}

function renderMediaBadge() {
  const media = document.querySelector(".vehicle-hero-media");
  if (!media) return;

  const markup = `
      <div class="vehicle-media-badge">
        <span>Start from</span>
        <strong>${formatPrice(car.price)}<small>/day</small></strong>
      </div>
    `;
  const existing = media.querySelector(".vehicle-media-badge");
  if (existing) {
    existing.outerHTML = markup;
  } else {
    media.insertAdjacentHTML("beforeend", markup);
  }
}

function renderVehicle() {
  if (!car) {
    document.querySelector("[data-vehicle-page]").innerHTML = `
      <section class="vehicle-empty">
        <p class="eyebrow">Vehicle not found</p>
        <h1>This car page is not available.</h1>
        <a class="primary-button" href="/#fleet">Back to fleet</a>
      </section>
    `;
    return;
  }

  document.title = `${car.name} | KD's Exotics`;
  setText("[data-vehicle-category]", car.categoryLabel);
  setText("[data-vehicle-title]", car.name);
  setText("[data-vehicle-summary]", car.summary);
  setText("[data-vehicle-price]", `${formatPrice(car.price)}/day`);
  setText("[data-vehicle-mileage]", car.mileage);
  setText("[data-vehicle-color]", car.color);
  setText("[data-vehicle-make]", car.make);
  setText("[data-vehicle-model]", car.model);
  setAttr("[data-booking-link]", "href", `/?vehicle=${encodeURIComponent(car.name)}#booking`);
  renderHeroMeta();
  renderMediaBadge();

  const mainImage = document.querySelector("[data-gallery-main]");
  const firstImage = car.gallery[0] || car.image;
  mainImage.src = firstImage;
  mainImage.alt = car.name;

  const gallerySection = document.querySelector(".vehicle-gallery-section");
  const galleryThumbs = document.querySelector("[data-gallery-thumbs]");
  if (car.gallery.length > 1) {
    if (gallerySection) gallerySection.hidden = false;
    galleryThumbs.innerHTML = car.gallery
      .map(
        (image, index) => `
          <button class="gallery-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-image="${image}" aria-label="Show photo ${index + 1} of ${car.name}">
            <img src="${image}" alt="" loading="lazy" width="220" height="165" />
          </button>
        `,
      )
      .join("");
  } else {
    galleryThumbs.innerHTML = "";
    if (gallerySection) gallerySection.hidden = true;
  }

  const rates = car.tags.map(rateFromTag).filter(Boolean);
  const featureTags = car.tags.filter((tag) => !rateFromTag(tag));
  document.querySelector("[data-vehicle-tags]").innerHTML = `
    <div class="vehicle-rate-cards">
      ${rates
        .map(
          (rate) => `
            <div class="vehicle-rate-card">
              <span>${rate.label}</span>
              <strong>${rate.price}<small>/day</small></strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="tag-row vehicle-feature-tags">
      ${featureTags.map((tag) => `<span>${tag}</span>`).join("")}
    </div>
  `;
  document.querySelector("[data-vehicle-details]").innerHTML = car.details
    .map(
      (detail) => `
        <li>
          <span class="detail-check" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5" /></svg>
          </span>
          ${detail}
        </li>
      `,
    )
    .join("");

  const categoryRelated = vehicleFleet.filter((item) => item.slug !== car.slug && item.category.includes(car.category.split(" ")[0]));
  const fallbackRelated = vehicleFleet.filter((item) => item.slug !== car.slug && !categoryRelated.includes(item));
  const related = [...categoryRelated, ...fallbackRelated].slice(0, 3);
  document.querySelector("[data-related]").innerHTML = related
    .map(
      (item) => `
        <a class="related-car" href="/cars/${item.slug}.html">
          <img src="${item.image}" alt="${item.name}" loading="lazy" width="360" height="270" />
          <span>${item.categoryLabel}</span>
          <strong>${item.name}</strong>
          <small>${formatPrice(item.price)}/day</small>
        </a>
      `,
    )
    .join("");

  document.querySelectorAll("[data-gallery-image]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-gallery-image]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      mainImage.src = button.dataset.galleryImage;
    });
  });
}

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    mobileMenu.classList.toggle("open");
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      mobileMenu.classList.remove("open");
    });
  });
}

window.addEventListener(
  "scroll",
  () => {
    header?.classList.toggle("scrolled", window.scrollY > 24);
  },
  { passive: true },
);

function refreshVehicleFromBase() {
  vehicleFleet = baseVehicleFleet.slice();
  car = vehicleFleet.find((item) => item.slug === slug) || getVehicle(slug);
  renderVehicle();
}

async function hydrateRemoteVehicle() {
  const remoteCar = await loadVehicleFromSupabase(slug);
  if (!remoteCar) return;

  baseVehicleFleet = baseVehicleFleet.some((item) => item.slug === remoteCar.slug)
    ? baseVehicleFleet.map((item) => (item.slug === remoteCar.slug ? remoteCar : item))
    : [...baseVehicleFleet, remoteCar];
  refreshVehicleFromBase();
}

async function initVehicle() {
  refreshVehicleFromBase();
  await hydrateRemoteVehicle();
}

initVehicle();

window.addEventListener("storage", (event) => {
  if (event.key !== ADMIN_FLEET_REFRESH_KEY) return;
  hydrateRemoteVehicle();
});
