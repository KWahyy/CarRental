import { ADMIN_FLEET_REFRESH_KEY } from "./admin-store.js?v=gallery-hq-20260710";
import { fleet as websiteFleet, formatPrice } from "./fleet-data.js?v=gallery-hq-20260710";
import { isSupabaseFleetConfigured, loadFleetFromSupabase } from "./supabase-fleet.js?v=gallery-hq-20260710";

const grid = document.querySelector("[data-fleet-grid]");
const countLabel = document.querySelector("[data-fleet-count]");
const filterNote = document.querySelector("[data-fleet-filter-note]");
const filterControl = document.querySelector("[data-filter-control]");
const filterToggle = document.querySelector("[data-filter-toggle]");
const filterPanel = document.querySelector("[data-filter-panel]");
const activeFilterLabel = document.querySelector("[data-active-filter]");
const typeFilters = document.querySelector("[data-type-filters]");
const brandFilters = document.querySelector("[data-brand-filters]");
const searchInput = document.querySelector("[data-fleet-search]");
const clearSearchButton = document.querySelector("[data-clear-search]");
const sortSelect = document.querySelector("[data-fleet-sort]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const header = document.querySelector("[data-header]");

let baseFleet = websiteFleet.slice();
let cars = baseFleet.slice();
let activeFilter = "all";
let searchQuery = "";
let sortMode = "featured";
const CLOUD_FLEET_TIMEOUT_MS = 3500;

function withTimeout(promise, ms, fallback = null) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = window.setTimeout(() => resolve(fallback), ms);
  });

  return Promise.race([
    promise.finally(() => window.clearTimeout(timeoutId)),
    timeout,
  ]);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function brandFor(car) {
  return car.make || car.name.split(" ")[1] || "Other";
}

function bodyTypeFor(car) {
  const name = car.name.toLowerCase();
  const feature = [car.color, car.category, car.categoryLabel, car.summary].join(" ").toLowerCase();
  const joined = `${name} ${feature}`;

  if (joined.includes("convertible") || joined.includes("spyder") || joined.includes("spider") || joined.includes("gtc") || joined.includes("dawn") || joined.includes("portofino") || joined.includes("open-air")) return "Convertible";
  if (joined.includes("cybertruck") || joined.includes("f150")) return "Truck";
  if (joined.includes("suv") || joined.includes("g-wagon") || joined.includes("g wagon") || joined.includes("gls") || joined.includes("gle") || joined.includes("g63") || joined.includes("escalade") || joined.includes("urus") || joined.includes("defender") || joined.includes("range rover") || joined.includes("land rover") || joined.includes("cullinan") || joined.includes("macan")) return "SUV";
  if (joined.includes("sedan") || joined.includes("m3") || joined.includes("m5") || joined.includes("c63") || joined.includes("s63") || joined.includes("panamera") || joined.includes("model s")) return "Sedan";
  return "Coupe";
}

function filterLabel(filter) {
  if (filter === "all") return "All cars";
  if (filter.startsWith("brand:")) return filter.replace("brand:", "");
  if (filter.startsWith("type:")) return filter.replace("type:", "");
  return filter;
}

function vehicleDisplay(car) {
  const brand = brandFor(car);
  const model = car.model || car.name.replace(/^\d{4}\s+/, "").replace(brand, "").trim();

  return { brand, model };
}

function matchesFilter(car) {
  if (activeFilter === "all") return true;
  if (activeFilter.startsWith("brand:")) return brandFor(car) === activeFilter.replace("brand:", "");
  if (activeFilter.startsWith("type:")) return bodyTypeFor(car) === activeFilter.replace("type:", "");
  return true;
}

function searchableText(car) {
  return [car.name, car.make, car.model, car.color, car.category, car.categoryLabel, bodyTypeFor(car)]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesSearch(car) {
  return !searchQuery || searchableText(car).includes(searchQuery);
}

function sortedCars(source) {
  const next = source.slice();
  if (sortMode === "price-low") return next.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (sortMode === "price-high") return next.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (sortMode === "name") return next.sort((a, b) => a.name.localeCompare(b.name));
  return next;
}

function carImage(car) {
  return car.image || car.image_url || car.gallery?.[0] || "/assets/kds-hero.png";
}

function mediaBackgroundStyle(car) {
  return `--media-image: url('${carImage(car).replace(/'/g, "%27")}')`;
}

function renderFilterButtons() {
  const typeOrder = ["Coupe", "Convertible", "SUV", "Sedan", "Truck"];
  const types = typeOrder.filter((type) => cars.some((car) => bodyTypeFor(car) === type));
  const brands = [...new Set(cars.map(brandFor))].sort((a, b) => a.localeCompare(b));

  typeFilters.innerHTML = [
    { value: "all", label: "All" },
    ...types.map((type) => ({ value: `type:${type}`, label: type })),
  ]
    .map((item) => {
      const count = item.value === "all" ? cars.length : cars.filter((car) => bodyTypeFor(car) === item.label).length;
      return `<button class="${activeFilter === item.value ? "active" : ""}" type="button" data-filter="${item.value}">${item.label}<small>${count}</small></button>`;
    })
    .join("");

  brandFilters.innerHTML = brands
    .map((brand) => {
      const count = cars.filter((car) => brandFor(car) === brand).length;
      const value = `brand:${brand}`;
      return `<button class="${activeFilter === value ? "active" : ""}" type="button" data-filter="${value}">${brand}<small>${count}</small></button>`;
    })
    .join("");
}

function renderCards() {
  const visibleCars = sortedCars(cars.filter(matchesFilter).filter(matchesSearch));
  const label = filterLabel(activeFilter);
  const resultContext = [label !== "All cars" ? label : "", searchInput.value.trim() ? `Search: “${searchInput.value.trim()}”` : ""]
    .filter(Boolean)
    .join(" · ");

  countLabel.textContent = `${visibleCars.length} ${visibleCars.length === 1 ? "vehicle" : "vehicles"}`;
  filterNote.textContent = resultContext || "All cars";
  activeFilterLabel.textContent = label;
  clearSearchButton.hidden = !searchInput.value;

  grid.innerHTML = visibleCars.length ? visibleCars
    .map((car) => {
      const slug = car.slug || slugify(car.name);
      const { brand, model } = vehicleDisplay(car);

      return `
        <article class="showroom-card">
          <a class="showroom-card-media" href="/cars/${slug}.html" aria-label="View ${car.name}" style="${mediaBackgroundStyle(car)}">
            <img src="${carImage(car)}" alt="${car.name}" width="760" height="520" loading="lazy" onerror="this.onerror=null;this.src='/assets/kds-hero.png';" />
          </a>
          <div class="showroom-card-body">
            <div>
              <span>${brand}</span>
              <h2>${model}</h2>
            </div>
            <strong>${formatPrice(car.price)}<small>/day</small></strong>
          </div>
          <div class="showroom-card-actions">
            <a href="/cars/${slug}.html">View details</a>
            <a href="/?vehicle=${encodeURIComponent(car.name)}#quote">Request quote</a>
          </div>
        </article>
      `;
    })
    .join("") : `
      <div class="fleet-empty-state">
        <strong>No vehicles found</strong>
        <p>Try a different make, model, color, or filter.</p>
        <button type="button" data-reset-fleet>Show all vehicles</button>
      </div>
    `;
}

function renderFleet() {
  cars = baseFleet.slice();
  if (activeFilter !== "all" && !cars.some(matchesFilter)) activeFilter = "all";
  renderFilterButtons();
  renderCards();
}

function renderFleetLoading() {
  activeFilter = "all";
  countLabel.textContent = "Loading fleet";
  filterNote.textContent = "Cloud fleet";
  activeFilterLabel.textContent = "Loading";
  typeFilters.innerHTML = "";
  brandFilters.innerHTML = "";
  grid.innerHTML = Array.from({ length: 6 }, () => {
    return `
      <article class="showroom-card showroom-card-loading" aria-hidden="true">
        <div class="showroom-card-skeleton-media"></div>
        <div class="showroom-card-body">
          <div>
            <span class="showroom-card-skeleton-line showroom-card-skeleton-brand"></span>
            <h2 class="showroom-card-skeleton-line showroom-card-skeleton-title"></h2>
          </div>
          <strong class="showroom-card-skeleton-line showroom-card-skeleton-price"></strong>
        </div>
        <div class="showroom-card-actions">
          <span class="showroom-card-skeleton-pill"></span>
          <span class="showroom-card-skeleton-pill"></span>
        </div>
      </article>
    `;
  }).join("");
}

function closeFilters() {
  filterPanel.hidden = true;
  filterToggle.setAttribute("aria-expanded", "false");
}

function openFilters() {
  filterPanel.hidden = false;
  filterToggle.setAttribute("aria-expanded", "true");
}

filterToggle.addEventListener("click", () => {
  if (filterPanel.hidden) openFilters();
  else closeFilters();
});

filterPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  renderFleet();
  closeFilters();
});

function syncFleetSearch() {
  searchQuery = searchInput.value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  renderCards();
}

searchInput.addEventListener("input", syncFleetSearch);
searchInput.addEventListener("search", syncFleetSearch);

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  searchQuery = "";
  searchInput.focus();
  renderCards();
});

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  renderCards();
});

grid.addEventListener("click", (event) => {
  if (!event.target.closest("[data-reset-fleet]")) return;
  activeFilter = "all";
  searchInput.value = "";
  searchQuery = "";
  sortSelect.value = "featured";
  sortMode = "featured";
  renderFleet();
});

document.addEventListener("click", (event) => {
  if (filterPanel.hidden || filterControl.contains(event.target)) return;
  closeFilters();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFilters();
});

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

window.addEventListener(
  "scroll",
  () => {
    header.classList.toggle("scrolled", window.scrollY > 12);
  },
  { passive: true },
);

window.addEventListener("storage", (event) => {
  if (event.key !== ADMIN_FLEET_REFRESH_KEY) return;
  hydrateSupabaseFleet();
});

async function hydrateSupabaseFleet() {
  const remoteFleet = await withTimeout(loadFleetFromSupabase(), CLOUD_FLEET_TIMEOUT_MS, null);
  if (!Array.isArray(remoteFleet)) return false;
  // Supabase is the inventory source of truth. Bundled data only supplies
  // media for matching inventory records; it never adds extra vehicles.
  const bundledBySlug = new Map(websiteFleet.map((car) => [car.slug || slugify(car.name), car]));
  baseFleet = remoteFleet.map((car) => {
    const bundled = bundledBySlug.get(car.slug || slugify(car.name));
    if (!bundled?.gallery?.length) return car;
    return { ...car, image: bundled.image, gallery: bundled.gallery };
  });
  renderFleet();
  return true;
}

async function initFleetPage() {
  if (!isSupabaseFleetConfigured) {
    renderFleet();
    return;
  }

  renderFleetLoading();
  try {
    const hydrated = await hydrateSupabaseFleet();
    if (!hydrated) {
      baseFleet = [];
      renderFleet();
    }
  } catch (error) {
    console.warn("Could not initialize cloud fleet:", error);
    baseFleet = [];
    renderFleet();
  }
}

initFleetPage();
