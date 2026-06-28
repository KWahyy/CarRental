import { ADMIN_FLEET_REFRESH_KEY } from "./admin-store.js?v=cloud-no-flash-20260626";
import { fleet, formatPrice, getVehicle } from "./fleet-data.js?v=cloud-no-flash-20260626";
import { isSupabaseFleetConfigured, loadVehicleFromSupabase } from "./supabase-fleet.js?v=cloud-no-flash-20260626";

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

function engineForVehicle(vehicle) {
  const name = vehicle.name.toLowerCase();
  const make = vehicle.make.toLowerCase();
  if (name.includes("huracan") || name.includes("r8")) return "V10";
  if (name.includes("urus") || name.includes("g63") || name.includes("gle") || name.includes("escalade")) return "V8 / SUV";
  if (make.includes("ferrari") || make.includes("mclaren")) return "Twin-turbo V8";
  if (make.includes("bmw")) return "Twin-turbo I6";
  if (make.includes("porsche")) return "Turbo flat-six";
  if (make.includes("ford")) return "Twin-turbo V6";
  return "Performance";
}

function accelerationForVehicle(vehicle) {
  const name = vehicle.name.toLowerCase();
  const make = vehicle.make.toLowerCase();
  if (name.includes("huracan")) return "2.9 sec";
  if (make.includes("ferrari") || make.includes("mclaren") || name.includes("r8")) return "3.1 sec";
  if (name.includes("urus")) return "3.6 sec";
  if (make.includes("bmw")) return "3.8 sec";
  if (name.includes("g63") || name.includes("gle") || name.includes("escalade")) return "4.5 sec";
  return "Fast";
}

function typeForVehicle(vehicle) {
  const label = vehicle.categoryLabel || vehicle.category;
  const joined = `${vehicle.name} ${vehicle.category} ${vehicle.summary}`.toLowerCase();
  if (joined.includes("suv") || joined.includes("g63") || joined.includes("gle") || joined.includes("escalade") || joined.includes("urus")) return "SUV";
  if (joined.includes("convertible") || joined.includes("spider") || joined.includes("open-air")) return "Convertible";
  if (joined.includes("sedan") || joined.includes("m3")) return "Sedan";
  return label;
}

function renderGallery(gallery) {
  const mainImage = document.querySelector("[data-gallery-main]");
  const galleryThumbs = document.querySelector("[data-gallery-thumbs]");
  const previousButton = document.querySelector("[data-gallery-prev]");
  const nextButton = document.querySelector("[data-gallery-next]");
  let activeIndex = 0;

  function setActiveImage(index) {
    if (!gallery.length || !mainImage) return;
    activeIndex = (index + gallery.length) % gallery.length;
    mainImage.src = gallery[activeIndex];
    mainImage.alt = `${car.name} photo ${activeIndex + 1}`;
    document.querySelectorAll("[data-gallery-image]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.galleryIndex) === activeIndex);
    });
  }

  if (mainImage) {
    mainImage.removeAttribute("src");
    if (gallery.length) setActiveImage(0);
  }

  if (galleryThumbs) {
    galleryThumbs.innerHTML = gallery
      .slice(0, 3)
      .map(
        (image, index) => `
          <button class="vehicle-side-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-image="${image}" data-gallery-index="${index}" aria-label="Show photo ${index + 1} of ${car.name}">
            <img src="${image}" alt="" loading="lazy" width="460" height="300" />
          </button>
        `,
      )
      .join("");
  }

  document.querySelectorAll("[data-gallery-image]").forEach((button) => {
    button.addEventListener("click", () => setActiveImage(Number(button.dataset.galleryIndex)));
  });

  [previousButton, nextButton].forEach((button) => {
    if (!button) return;
    button.hidden = gallery.length < 2;
  });

  if (previousButton) previousButton.onclick = () => setActiveImage(activeIndex - 1);
  if (nextButton) nextButton.onclick = () => setActiveImage(activeIndex + 1);
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
  setText("[data-vehicle-engine]", engineForVehicle(car));
  setText("[data-vehicle-seats]", seatsForVehicle(car));
  setText("[data-vehicle-acceleration]", accelerationForVehicle(car));
  setText("[data-vehicle-type]", typeForVehicle(car));
  setAttr("[data-booking-link]", "href", `/?vehicle=${encodeURIComponent(car.name)}#booking`);

  const gallery = [...new Set([...(car.gallery || []), car.image].filter(Boolean))];
  renderGallery(gallery);

  const rates = car.tags.map(rateFromTag).filter(Boolean);
  const featureTags = car.tags.filter((tag) => !rateFromTag(tag));
  const tagsNode = document.querySelector("[data-vehicle-tags]");
  if (tagsNode) {
    tagsNode.innerHTML = `
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
  }
  const detailsNode = document.querySelector("[data-vehicle-details]");
  if (detailsNode) {
    detailsNode.innerHTML = car.details
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
  }

  const categoryRelated = vehicleFleet.filter((item) => item.slug !== car.slug && item.category.includes(car.category.split(" ")[0]));
  const fallbackRelated = vehicleFleet.filter((item) => item.slug !== car.slug && !categoryRelated.includes(item));
  const related = [...categoryRelated, ...fallbackRelated].slice(0, 3);
  const relatedNode = document.querySelector("[data-related]");
  if (relatedNode) {
    relatedNode.innerHTML = related
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
  }
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

function refreshVehicleFromBase({ allowStaticFallback = true } = {}) {
  vehicleFleet = baseVehicleFleet.slice();
  car = vehicleFleet.find((item) => item.slug === slug) || (allowStaticFallback ? getVehicle(slug) : null);
  renderVehicle();
}

async function hydrateRemoteVehicle() {
  const remoteCar = await loadVehicleFromSupabase(slug);
  if (!remoteCar) return false;

  baseVehicleFleet = baseVehicleFleet.some((item) => item.slug === remoteCar.slug)
    ? baseVehicleFleet.map((item) => (item.slug === remoteCar.slug ? remoteCar : item))
    : [...baseVehicleFleet, remoteCar];
  refreshVehicleFromBase({ allowStaticFallback: false });
  return true;
}

async function initVehicle() {
  let hydrated = false;
  if (isSupabaseFleetConfigured) {
    try {
      hydrated = await hydrateRemoteVehicle();
    } catch (error) {
      console.warn("Could not initialize cloud vehicle:", error);
    }
  }

  if (!hydrated) {
    if (isSupabaseFleetConfigured) {
      car = null;
      renderVehicle();
    } else {
      refreshVehicleFromBase({ allowStaticFallback: true });
    }
  }
  document.body.classList.remove("is-loading-vehicle");
}

initVehicle();

window.addEventListener("storage", (event) => {
  if (event.key !== ADMIN_FLEET_REFRESH_KEY) return;
  document.body.classList.add("is-loading-vehicle");
  hydrateRemoteVehicle()
    .then((hydrated) => {
      if (hydrated || !isSupabaseFleetConfigured) return;
      car = null;
      renderVehicle();
    })
    .catch((error) => {
      console.warn("Could not refresh cloud vehicle:", error);
      if (!isSupabaseFleetConfigured) refreshVehicleFromBase({ allowStaticFallback: true });
    })
    .finally(() => {
      document.body.classList.remove("is-loading-vehicle");
    });
});
