import { fleet as websiteFleet, formatPrice } from "./fleet-data.js?v=fleet-consistency-20260715";
import { fleetPictureMarkup, isSupabaseFleetConfigured, loadMonthlySpecialFromSupabase, optimizedFleetImageUrl, recordFleetEvent } from "./supabase-fleet.js?v=native-picture-flow-20260901";
import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260720";

const grid = document.querySelector("[data-fleet-grid]");
const popularGrid = document.querySelector("[data-popular-grid]");
const brandRail = document.querySelector("[data-brand-rail]");
const brandDots = document.querySelector("[data-fleet-brand-dots]");
const countLabel = document.querySelector("[data-fleet-count]");
const filterNote = document.querySelector("[data-fleet-filter-note]");
const filterControl = document.querySelector("[data-filter-control]");
const filterToggle = document.querySelector("[data-filter-toggle]");
const filterPanel = document.querySelector("[data-filter-panel]");
const filterBackdrop = document.querySelector("[data-filter-backdrop]");
const activeFilterLabel = document.querySelector("[data-active-filter]");
const typeFilters = document.querySelector("[data-type-filters]");
const brandFilters = document.querySelector("[data-brand-filters]");
const searchInput = document.querySelector("[data-fleet-search]");
const clearSearchButton = document.querySelector("[data-clear-search]");
const sortSelect = document.querySelector("[data-fleet-sort]");
const quickFilterButtons = [...document.querySelectorAll("[data-quick-filter]")];
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const header = document.querySelector("[data-header]");
const availabilityDrawer = document.querySelector("[data-availability-drawer]");
const availabilityForm = document.querySelector("[data-availability-form]");
const availabilityVehicle = document.querySelector("[data-availability-vehicle]");
const availabilityStatus = document.querySelector("[data-availability-status]");
const availabilityCloseButtons = [...document.querySelectorAll("[data-availability-close]")];

// Keep the filter sheet out of the toolbar's backdrop-filter containing block.
// This makes fixed positioning reliable on mobile and short desktop viewports.
document.body.append(filterBackdrop, filterPanel);

let baseFleet = websiteFleet.slice();
let cars = baseFleet.slice();
let activeType = "all";
let activeBrand = "all";
let quickFilter = "all";
let searchQuery = "";
let sortMode = "featured";
let monthlySpecialSlugs = new Set();
let popularSlugs = new Set();
let availabilityTrigger = null;
const seenCardImpressions = new Set();
let cardImpressionObserver = null;
const CRM_REQUESTS_KEY = "prestige-luxor-crm-requests";
const POPULAR_VEHICLE_SLUGS = [
  "2021-bmw-m3-comp",
  "2022-porsche-911-carrera",
  "2017-audi-r8",
  "2015-lamborghini-huracan-lp-610-4",
  "2022-lamborghini-huracan",
  "2016-ferrari-488-gtb",
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function trackFleetEvent(eventName, detail = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...detail });
  window.dispatchEvent(new CustomEvent(`prestige-luxor:${eventName}`, { detail }));
  document.documentElement.dataset.fleetEventCount = String(Number(document.documentElement.dataset.fleetEventCount || 0) + 1);
  document.documentElement.dataset.lastFleetEvent = eventName;

  const persistentType = {
    view_item_list: "fleet_page_view",
    card_impression: "card_impression",
    select_item: "vehicle_detail_click",
    availability_form_open: "availability_open",
    availability_request_submit: "availability_submit",
    availability_request_success: "availability_success",
  }[eventName];

  if (persistentType) {
    void recordFleetEvent(persistentType, {
      carSlug: detail.vehicle_slug || "",
      metadata: {
        vehicle: detail.vehicle || "",
        vehicle_count: detail.vehicle_count || undefined,
      },
    });
  }
}

function observeCardImpressions() {
  if (!("IntersectionObserver" in window)) return;
  cardImpressionObserver?.disconnect();
  cardImpressionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;
        const slug = entry.target.dataset.vehicleSlug || "";
        if (!slug || seenCardImpressions.has(slug)) return;
        seenCardImpressions.add(slug);
        trackFleetEvent("card_impression", {
          vehicle_slug: slug,
          vehicle: entry.target.dataset.vehicle || "Vehicle",
        });
        cardImpressionObserver.unobserve(entry.target);
      });
    },
    { threshold: [0.55] },
  );

  document.querySelectorAll(".showroom-card[data-vehicle-slug]").forEach((card) => {
    if (!seenCardImpressions.has(card.dataset.vehicleSlug)) cardImpressionObserver.observe(card);
  });
}

function vehicleSlug(car) {
  return car.slug || slugify(car.name);
}

function brandFor(car) {
  return car.make || car.name.split(" ")[1] || "Other";
}

const BRAND_LOGOS = {
  Audi: "/assets/brand-logos/audi.svg",
  Bentley: "/assets/brand-logos/bentley.svg",
  BMW: "/assets/brand-logos/bmw.svg",
  Cadillac: "/assets/brand-logos/cadillac.svg",
  Chevy: "/assets/brand-logos/chevrolet.svg",
  Chevrolet: "/assets/brand-logos/chevrolet.svg",
  Ferrari: "/assets/brand-logos/ferrari.svg",
  Ford: "/assets/brand-logos/ford.svg",
  Lamborghini: "/assets/brand-logos/lamborghini.svg",
  "Land Rover": "/assets/brand-logos/land-rover.svg",
  Lotus: "/assets/brand-logos/lotus.svg",
  McLaren: "/assets/brand-logos/mclaren.svg",
  Porsche: "/assets/brand-logos/porsche.svg",
  "Rolls-Royce": "/assets/brand-logos/rolls-royce.svg",
  Tesla: "/assets/brand-logos/tesla.svg",
};

function brandLogoMarkup(brand) {
  if (brand.startsWith("Mercedes")) {
    return `
      <svg aria-hidden="true" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27"></circle>
        <path d="M32 8.5V32L12.5 46M32 32l19.5 14"></path>
      </svg>`;
  }

  const logo = BRAND_LOGOS[brand];
  if (!logo) return `<span class="fleet-brand-fallback" aria-hidden="true">${escapeHtml(brand.slice(0, 2))}</span>`;
  return `<img src="${logo}" alt="" width="96" height="72" loading="lazy" />`;
}

function brandDisplayName(brand) {
  return brand === "Chevy" ? "Chevrolet" : brand;
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

function filterLabel() {
  const parts = [activeBrand !== "all" ? activeBrand : "", activeType !== "all" ? activeType : ""].filter(Boolean);
  return parts.join(" · ") || "All cars";
}

function vehicleDisplay(car) {
  const brand = brandFor(car);
  const model = car.model || car.name.replace(/^\d{4}\s+/, "").replace(brand, "").trim();

  return { brand, model };
}

function matchesFilter(car) {
  const matchesType = activeType === "all" || bodyTypeFor(car) === activeType;
  const matchesBrand = activeBrand === "all" || brandFor(car) === activeBrand;
  return matchesType && matchesBrand;
}

function quickFilterLabel(filter) {
  return {
    all: "All vehicles",
    popular: "Most popular",
    budget: "Under $500/day",
    convertible: "Convertibles",
    suv: "Luxury SUVs",
    special: "Monthly deals",
  }[filter] || "All vehicles";
}

function matchesQuickFilter(car) {
  if (quickFilter === "all") return true;
  if (quickFilter === "popular") return popularSlugs.has(vehicleSlug(car));
  if (quickFilter === "budget") return Number(car.price || 0) <= 500;
  if (quickFilter === "convertible") return bodyTypeFor(car) === "Convertible";
  if (quickFilter === "suv") return bodyTypeFor(car) === "SUV";
  if (quickFilter === "special") return monthlySpecialSlugs.has(vehicleSlug(car));
  return true;
}

function renderQuickFilters() {
  quickFilterButtons.forEach((button) => {
    const isActive = button.dataset.quickFilter === quickFilter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
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
  if (!searchQuery) return true;
  const haystack = searchableText(car);
  return searchQuery.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

function sortedCars(source) {
  const next = source.slice();
  if (sortMode === "price-low") return next.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (sortMode === "price-high") return next.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (sortMode === "name") return next.sort((a, b) => a.name.localeCompare(b.name));
  const popularRank = new Map(POPULAR_VEHICLE_SLUGS.map((slug, index) => [slug, index]));
  return next.sort((a, b) => {
    const aRank = popularRank.has(vehicleSlug(a)) ? popularRank.get(vehicleSlug(a)) : Number.MAX_SAFE_INTEGER;
    const bRank = popularRank.has(vehicleSlug(b)) ? popularRank.get(vehicleSlug(b)) : Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

function originalCarImage(car) {
  return car.image || car.image_url || car.gallery?.[0] || "/assets/prestige-luxor-hero.png";
}

function carImage(car) {
  return optimizedFleetImageUrl(originalCarImage(car), { width: 900, height: 675, quality: 76, updatedAt: car.updatedAt || car.updated_at });
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
    ...types.map((type) => ({ value: type, label: type })),
  ]
    .map((item) => {
      const count = item.value === "all" ? cars.length : cars.filter((car) => bodyTypeFor(car) === item.label).length;
      return `<button class="${activeType === item.value ? "active" : ""}" type="button" data-filter-type="${item.value}" aria-pressed="${activeType === item.value}">${item.label}<small>${count}</small></button>`;
    })
    .join("");

  brandFilters.innerHTML = [
    `<button class="${activeBrand === "all" ? "active" : ""}" type="button" data-filter-brand="all" aria-pressed="${activeBrand === "all"}">All brands<small>${cars.length}</small></button>`,
    ...brands.map((brand) => {
      const count = cars.filter((car) => brandFor(car) === brand).length;
      return `<button class="${activeBrand === brand ? "active" : ""}" type="button" data-filter-brand="${escapeHtml(brand)}" aria-pressed="${activeBrand === brand}">${escapeHtml(brand)}<small>${count}</small></button>`;
    }),
  ].join("");

  if (brandRail) {
    brandRail.innerHTML = brands.map((brand) => {
      const count = cars.filter((car) => brandFor(car) === brand).length;
      const isActive = activeBrand === brand;
      return `
        <button class="${isActive ? "active" : ""}" type="button" data-brand-shortcut="${escapeHtml(brand)}" aria-label="Show ${count} ${escapeHtml(brandDisplayName(brand))} cars" aria-pressed="${isActive}">
          <span class="fleet-brand-mark">${brandLogoMarkup(brand)}</span>
          <strong>${escapeHtml(brandDisplayName(brand))}</strong>
          <small>${count} ${count === 1 ? "car" : "cars"}</small>
        </button>`;
    }).join("");

    if (brandDots) {
      brandDots.innerHTML = brands.map((brand, index) => `
        <button class="${index === 0 ? "active" : ""}" type="button" data-brand-dot="${index}" aria-label="Show ${escapeHtml(brandDisplayName(brand))} in the brand carousel" aria-pressed="${index === 0}"><span></span></button>
      `).join("");
    }
  }
}

function vehicleYear(car) {
  return String(car.year || car.name.match(/^(\d{4})/)?.[1] || "Exclusive");
}

function cardMarkup(car, variant = "collection", highPriority = false) {
  const slug = vehicleSlug(car);
  const { brand, model } = vehicleDisplay(car);
  const isPopular = variant === "popular";
  return `
    <article class="showroom-card showroom-card-${variant}" data-vehicle-slug="${escapeHtml(slug)}" data-vehicle="${escapeHtml(car.name)}">
      <a class="showroom-card-media" href="/cars/${escapeHtml(slug)}.html" aria-label="View ${escapeHtml(car.name)}" data-fleet-card-link data-vehicle="${escapeHtml(car.name)}" data-vehicle-slug="${escapeHtml(slug)}">
        ${fleetPictureMarkup(originalCarImage(car), { alt: car.name, width: 900, height: 675, quality: 76, updatedAt: car.updatedAt || car.updated_at, loading: isPopular ? "eager" : "lazy", fetchPriority: highPriority ? "high" : "" })}
      </a>
      <div class="showroom-card-body">
        <div class="showroom-card-title">
          <span>${escapeHtml(vehicleYear(car))} · ${escapeHtml(brand)}</span>
          <h3>${escapeHtml(model)}</h3>
        </div>
        <strong>${escapeHtml(formatPrice(car.price))}<small>/day</small></strong>
      </div>
      <button class="showroom-request" type="button" data-check-availability data-vehicle="${escapeHtml(car.name)}" data-vehicle-slug="${escapeHtml(slug)}">
        Request This Vehicle <span aria-hidden="true">↗</span>
      </button>
    </article>`;
}

function renderPopularCars() {
  if (!popularGrid) return;
  const selected = POPULAR_VEHICLE_SLUGS
    .map((slug) => cars.find((car) => vehicleSlug(car) === slug))
    .filter(Boolean)
    .slice(0, 3);
  const fallback = selected.length === 3 ? selected : sortedCars(cars).slice(0, 3);
  popularGrid.innerHTML = fallback.map((car, index) => cardMarkup(car, "popular", index === 0)).join("");
}

function renderCards() {
  const visibleCars = sortedCars(cars.filter(matchesFilter).filter(matchesQuickFilter).filter(matchesSearch));
  const label = filterLabel();
  const quickLabel = quickFilterLabel(quickFilter);
  const resultContext = [quickFilter !== "all" ? quickLabel : "", label !== "All cars" ? label : "", searchInput.value.trim() ? `Search: “${searchInput.value.trim()}”` : ""]
    .filter(Boolean)
    .join(" · ");

  countLabel.textContent = `${visibleCars.length} ${visibleCars.length === 1 ? "vehicle" : "vehicles"}`;
  filterNote.textContent = resultContext || "All cars";
  activeFilterLabel.textContent = label;
  clearSearchButton.hidden = !searchInput.value;
  renderQuickFilters();

  grid.innerHTML = visibleCars.length ? visibleCars
    .map((car, index) => {
      const card = cardMarkup(car);

      let additions = "";
      if ((index + 1) % 12 === 0 && index !== visibleCars.length - 1) additions += `
        <aside class="fleet-concierge-break">
          <div>
            <p class="eyebrow">Need a recommendation?</p>
            <h2>Tell us the date, budget, and occasion.</h2>
            <p>We will review the collection and suggest vehicles that fit your plans.</p>
          </div>
          <button type="button" data-concierge-match>Help me choose</button>
        </aside>
      `;
      return `${card}${additions}`;
    })
    .join("") : `
      <div class="fleet-empty-state">
        <strong>No vehicles found</strong>
        <p>Try a different make, model, color, or filter.</p>
        <button type="button" data-reset-fleet>Show all vehicles</button>
      </div>
    `;
  observeCardImpressions();
}

function renderFleet() {
  cars = baseFleet.slice();
  const activeSlugs = new Set(cars.map(vehicleSlug));
  popularSlugs = new Set(POPULAR_VEHICLE_SLUGS.filter((slug) => activeSlugs.has(slug)).slice(0, 6));
  if (activeType !== "all" && !cars.some((car) => bodyTypeFor(car) === activeType)) activeType = "all";
  if (activeBrand !== "all" && !cars.some((car) => brandFor(car) === activeBrand)) activeBrand = "all";
  renderFilterButtons();
  renderPopularCars();
  renderCards();
}

function renderFleetLoading() {
  activeType = "all";
  activeBrand = "all";
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

function localDateValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function openAvailabilityDrawer(vehicleName, trigger) {
  if (!availabilityDrawer || !availabilityForm) return;
  availabilityTrigger = trigger || null;
  availabilityForm.reset();
  availabilityForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = false;
  });
  availabilityForm.elements.vehicle.value = vehicleName;
  availabilityForm.elements.requestType.value = "availability";
  availabilityForm.elements.alternatives.checked = true;
  availabilityForm.elements.date.min = localDateValue();
  availabilityForm.elements.returnDate.min = localDateValue();
  availabilityVehicle.querySelector("strong").textContent = vehicleName;
  availabilityStatus.dataset.tone = "";
  availabilityStatus.textContent = "No charge today. We will verify the vehicle and contact you before any booking step.";
  availabilityDrawer.hidden = false;
  document.body.classList.add("availability-open");
  availabilityForm.elements.date.focus();
  trackFleetEvent("availability_form_open", {
    vehicle: vehicleName,
    vehicle_slug: trigger?.dataset.vehicleSlug || "",
  });
}

function closeAvailabilityDrawer() {
  if (!availabilityDrawer || availabilityDrawer.hidden) return;
  availabilityDrawer.hidden = true;
  document.body.classList.remove("availability-open");
  availabilityTrigger?.focus();
  availabilityTrigger = null;
}

availabilityCloseButtons.forEach((button) => button.addEventListener("click", closeAvailabilityDrawer));

availabilityForm?.elements.date.addEventListener("change", () => {
  const pickupDate = availabilityForm.elements.date.value || localDateValue();
  availabilityForm.elements.returnDate.min = pickupDate;
  if (availabilityForm.elements.returnDate.value && availabilityForm.elements.returnDate.value < pickupDate) {
    availabilityForm.elements.returnDate.value = pickupDate;
  }
});

availabilityForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = availabilityForm.querySelector("button[type='submit']");
  const formData = new FormData(availabilityForm);
  const alternativesApproved = Boolean(formData.get("alternatives"));
  const message = [
    "Personal vehicle availability check requested.",
    `Return date: ${formData.get("returnDate") || "Not provided"}`,
    `Delivery city or ZIP: ${formData.get("deliveryLocation") || "Not provided"}`,
    `Similar vehicles approved: ${alternativesApproved ? "Yes" : "No"}`,
  ].join("\n");
  const payload = {
    requestType: "availability",
    name: formData.get("name") || "",
    phone: formData.get("phone") || "",
    email: formData.get("email") || "",
    insuranceProvider: "",
    date: formData.get("date") || "",
    vehicle: formData.get("vehicle") || "Help me choose",
    addons: alternativesApproved ? ["Similar options approved"] : [],
    message,
    company: formData.get("company") || "",
    pageUrl: window.location.href,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Sending availability request...";
  availabilityStatus.dataset.tone = "";
  availabilityStatus.textContent = "Saving your request for a personal availability check...";
  trackFleetEvent("availability_request_submit", {
    vehicle: payload.vehicle,
    vehicle_slug: availabilityTrigger?.dataset.vehicleSlug || "",
  });

  try {
    const result = await submitQuoteRequest(payload);

    try {
      const storedRequests = JSON.parse(localStorage.getItem(CRM_REQUESTS_KEY)) || [];
      storedRequests.unshift({
        id: result.id || `availability-${Date.now()}`,
        requestType: "availability",
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        insuranceProvider: "",
        vehicle: payload.vehicle,
        date: payload.date,
        addons: payload.addons,
        message: payload.message,
        status: "new",
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(CRM_REQUESTS_KEY, JSON.stringify(storedRequests));
    } catch {
      // Local mirror is best-effort only; Supabase remains the source of truth.
    }

    availabilityStatus.dataset.tone = "success";
    availabilityStatus.textContent = "Request received. We will verify the exact vehicle and dates, then contact you with the result or similar options.";
    trackFleetEvent("availability_request_success", {
      vehicle: payload.vehicle,
      vehicle_slug: availabilityTrigger?.dataset.vehicleSlug || "",
    });
    availabilityForm.querySelectorAll("input, button").forEach((control) => {
      if (control !== submitButton) control.disabled = true;
    });
  } catch (error) {
    availabilityStatus.dataset.tone = "error";
    availabilityStatus.textContent = error.message || "We could not save this request. Please call us directly.";
    trackFleetEvent("availability_request_error", { vehicle: payload.vehicle });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = availabilityStatus.dataset.tone === "success" ? "Request received" : "Request availability check";
  }
});

function closeFilters({ returnFocus = false } = {}) {
  filterPanel.hidden = true;
  filterBackdrop.hidden = true;
  filterToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("fleet-filters-open");
  if (returnFocus) filterToggle.focus();
}

function openFilters() {
  filterPanel.hidden = false;
  filterBackdrop.hidden = false;
  filterToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("fleet-filters-open");
  window.requestAnimationFrame(() => filterPanel.querySelector("button.active")?.focus());
}

filterToggle.addEventListener("click", () => {
  if (filterPanel.hidden) openFilters();
  else closeFilters();
});

filterPanel.addEventListener("click", (event) => {
  event.stopPropagation();
  if (event.target.closest("[data-filter-close]")) {
    closeFilters({ returnFocus: true });
    return;
  }
  if (event.target.closest("[data-filter-clear]")) {
    activeType = "all";
    activeBrand = "all";
    renderFleet();
    trackFleetEvent("fleet_filter", { type: activeType, brand: activeBrand });
    return;
  }
  const button = event.target.closest("[data-filter-type], [data-filter-brand]");
  if (!button) return;
  if (button.dataset.filterType) activeType = button.dataset.filterType;
  if (button.dataset.filterBrand) activeBrand = button.dataset.filterBrand;
  renderFleet();
  trackFleetEvent("fleet_filter", { type: activeType, brand: activeBrand });
});

filterBackdrop.addEventListener("click", () => closeFilters({ returnFocus: true }));

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

searchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !searchInput.value) return;
  searchInput.value = "";
  searchQuery = "";
  renderCards();
});

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  renderCards();
});

quickFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    quickFilter = button.dataset.quickFilter || "all";
    activeType = "all";
    activeBrand = "all";
    renderCards();
    trackFleetEvent("fleet_quick_filter", { filter: quickFilter });
  });
});

function handleFleetCardClick(event) {
  const availabilityButton = event.target.closest("[data-check-availability]");
  if (availabilityButton) {
    openAvailabilityDrawer(availabilityButton.dataset.vehicle || "Vehicle selection", availabilityButton);
    return;
  }

  const conciergeButton = event.target.closest("[data-concierge-match]");
  if (conciergeButton) {
    openAvailabilityDrawer("Help me choose", conciergeButton);
    return;
  }

  const cardLink = event.target.closest("[data-fleet-card-link]");
  if (cardLink) {
    trackFleetEvent("select_item", {
      vehicle: cardLink.dataset.vehicle || "Vehicle",
      vehicle_slug: cardLink.dataset.vehicleSlug || "",
    });
    return;
  }

  if (event.target.closest("[data-reset-fleet]")) {
    activeType = "all";
    activeBrand = "all";
    quickFilter = "all";
    searchInput.value = "";
    searchQuery = "";
    sortSelect.value = "featured";
    sortMode = "featured";
    renderFleet();
  }
}

grid.addEventListener("click", handleFleetCardClick);
popularGrid?.addEventListener("click", handleFleetCardClick);

brandRail?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-brand-shortcut]");
  if (!button) return;
  activeBrand = button.dataset.brandShortcut;
  activeType = "all";
  quickFilter = "all";
  renderFleet();
  document.querySelector(".fleet-showroom")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

brandDots?.addEventListener("click", (event) => {
  const dot = event.target.closest("[data-brand-dot]");
  if (!dot || !brandRail) return;
  const card = brandRail.children[Number(dot.dataset.brandDot)];
  card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
});

let brandScrollFrame = 0;
brandRail?.addEventListener("scroll", () => {
  window.cancelAnimationFrame(brandScrollFrame);
  brandScrollFrame = window.requestAnimationFrame(() => {
    const railCenter = brandRail.scrollLeft + brandRail.clientWidth / 2;
    const cards = [...brandRail.children];
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - railCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    brandDots?.querySelectorAll("[data-brand-dot]").forEach((dot, index) => {
      const active = index === closestIndex;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-pressed", String(active));
    });
  });
}, { passive: true });

document.querySelector("[data-show-popular]")?.addEventListener("click", () => {
  activeType = "all";
  activeBrand = "all";
  quickFilter = "popular";
  renderCards();
  document.querySelector(".fleet-showroom")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.addEventListener("click", (event) => {
  if (filterPanel.hidden || filterControl.contains(event.target)) return;
  closeFilters();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFilters({ returnFocus: !filterPanel.hidden });
    closeAvailabilityDrawer();
    return;
  }

  if (event.key === "Tab" && availabilityDrawer && !availabilityDrawer.hidden) {
    const focusable = [...availabilityDrawer.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
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

function currentSpecialMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthlyFallbackSlugs(source, month) {
  if (!source.length) return [];
  const seed = Number(month.replace("-", ""));
  const start = seed % source.length;
  return Array.from({ length: Math.min(2, source.length) }, (_, index) => vehicleSlug(source[(start + index) % source.length]));
}

async function hydrateMonthlyDeals() {
  const month = currentSpecialMonth();
  const configuredSpecial = isSupabaseFleetConfigured ? await loadMonthlySpecialFromSupabase(month) : null;
  const activeSlugs = new Set(baseFleet.map(vehicleSlug));
  const configuredSlugs = Array.isArray(configuredSpecial?.car_slugs)
    ? configuredSpecial.car_slugs.filter((slug) => activeSlugs.has(slug)).slice(0, 2)
    : [];
  monthlySpecialSlugs = new Set(configuredSlugs.length ? configuredSlugs : monthlyFallbackSlugs(baseFleet, month));
}

async function initFleetPage() {
  renderFleet();
  trackFleetEvent("view_item_list", { vehicle_count: baseFleet.length });
  await hydrateMonthlyDeals();
}

initFleetPage();
