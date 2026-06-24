import { ADMIN_FLEET_REFRESH_KEY } from "./admin-store.js?v=cloud-save-20260624";
import { fleet as websiteFleet, formatPrice } from "./fleet-data.js?v=cloud-save-20260624";
import { loadFleetFromSupabase } from "./supabase-fleet.js?v=cloud-save-20260624";

const grid = document.querySelector("[data-fleet-grid]");
const countLabel = document.querySelector("[data-fleet-count]");
const filterNote = document.querySelector("[data-fleet-filter-note]");
const filterControl = document.querySelector("[data-filter-control]");
const filterToggle = document.querySelector("[data-filter-toggle]");
const filterPanel = document.querySelector("[data-filter-panel]");
const activeFilterLabel = document.querySelector("[data-active-filter]");
const typeFilters = document.querySelector("[data-type-filters]");
const brandFilters = document.querySelector("[data-brand-filters]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const header = document.querySelector("[data-header]");

let baseFleet = websiteFleet.slice();
let cars = baseFleet.slice();
let activeFilter = "all";

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

  if (feature.includes("convertible") || name.includes("spider")) return "Convertible";
  if (name.includes("gle") || name.includes("g63") || name.includes("escalade") || name.includes("urus")) return "SUV";
  if (name.includes("f150")) return "Truck";
  if (name.includes("m3")) return "Sedan";
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

function carImage(car) {
  return car.image || car.image_url || car.gallery?.[0] || "/assets/kds-hero.png";
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
  const visibleCars = cars.filter(matchesFilter);
  const label = filterLabel(activeFilter);

  countLabel.textContent = `${visibleCars.length} ${visibleCars.length === 1 ? "vehicle" : "vehicles"}`;
  filterNote.textContent = label;
  activeFilterLabel.textContent = label;

  grid.innerHTML = visibleCars
    .map((car) => {
      const slug = car.slug || slugify(car.name);
      const { brand, model } = vehicleDisplay(car);

      return `
        <article class="showroom-card">
          <a class="showroom-card-media" href="/cars/${slug}.html" aria-label="View ${car.name}">
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
    .join("");
}

function renderFleet() {
  cars = baseFleet.slice();
  if (activeFilter !== "all" && !cars.some(matchesFilter)) activeFilter = "all";
  renderFilterButtons();
  renderCards();
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

renderFleet();

async function hydrateSupabaseFleet() {
  const remoteFleet = await loadFleetFromSupabase();
  if (!remoteFleet) return;
  baseFleet = remoteFleet;
  renderFleet();
}

hydrateSupabaseFleet();
