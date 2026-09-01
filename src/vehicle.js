import { fleet, formatPrice, getVehicle } from "./fleet-data.js?v=fleet-consistency-20260715";
import {
  cacheSafeFleetImageUrl,
  fleetImageSources,
  fleetPictureMarkup,
  isSupabaseFleetConfigured,
  loadMonthlySpecialFromSupabase,
  recordFleetEvent,
} from "./supabase-fleet.js?v=product-image-quality-20260901";
import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260720";
import {
  accelerationForVehicle,
  bodyTypeForVehicle,
  engineForVehicle,
  publicVehicleDetails,
  publicVehicleSummary,
  seatsForVehicle,
  vehicleSeoDescription,
  vehicleSeoSectionMarkup,
  vehicleSeoTitle,
  vehicleYear,
} from "./vehicle-content.js?v=vehicle-seo-20260901";

document.body.classList.add("site-theme");

const slug = document.body.dataset.vehicleSlug;
const vehicleFleet = fleet.slice();
const car = vehicleFleet.find((item) => item.slug === slug) || getVehicle(slug);
const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const MAX_LISTING_PHOTOS = 3;
const CRM_REQUESTS_KEY = "prestige-luxor-crm-requests";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentSpecialMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthlyFallbackSlugs(source, month) {
  if (!source.length) return [];
  const seed = Number(month.replace("-", ""));
  const start = seed % source.length;
  return Array.from({ length: Math.min(2, source.length) }, (_, index) => source[(start + index) % source.length].slug);
}

async function hydrateMonthlySpecialPrice() {
  if (!car) return;
  const month = currentSpecialMonth();
  let configuredSpecial = null;
  try {
    configuredSpecial = isSupabaseFleetConfigured ? await loadMonthlySpecialFromSupabase(month) : null;
  } catch (error) {
    console.warn("Could not hydrate vehicle monthly-special pricing:", error);
  }
  const activeSlugs = new Set(vehicleFleet.map((vehicle) => vehicle.slug));
  const configuredSlugs = Array.isArray(configuredSpecial?.car_slugs)
    ? configuredSpecial.car_slugs.filter((vehicleSlug) => activeSlugs.has(vehicleSlug)).slice(0, 2)
    : [];
  const specialSlugs = configuredSlugs.length ? configuredSlugs : monthlyFallbackSlugs(vehicleFleet, month);
  if (!specialSlugs.includes(slug)) return;

  const originalRate = Math.max(Number(car.price || 0), 0);
  const discountedRate = Math.round(originalRate * 0.9);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(`${month}-02T12:00:00`));

  document.querySelectorAll("[data-vehicle-price]").forEach((price) => {
    price.classList.add("vehicle-special-price");
    price.setAttribute("aria-label", `${monthLabel} special: 10% off, ${formatPrice(discountedRate)} per day, regularly ${formatPrice(originalRate)} per day`);
    price.innerHTML = `
      <span class="vehicle-special-label">${escapeHtml(monthLabel)} special · 10% off</span>
      <span class="vehicle-special-values" aria-hidden="true">
        <del>${escapeHtml(formatPrice(originalRate))}</del>
        <b>${escapeHtml(formatPrice(discountedRate))}</b>
        <small>/day</small>
      </span>
    `;
  });
}

function ensureVehicleShell() {
  const page = document.querySelector("[data-vehicle-page]");
  if (!page || page.querySelector(".vehicle-private-page")) return;
  const staticSeo = page.querySelector("[data-vehicle-seo]");
  const hasStaticSeo = Boolean(staticSeo);
  staticSeo?.remove();
  page.innerHTML = `
    <div class="vehicle-private-page">
      <a class="vehicle-private-back" href="/fleet.html"><span aria-hidden="true">←</span> Return to collection</a>

      <section class="vehicle-private-hero" aria-labelledby="vehicle-private-title">
        <div class="vehicle-private-title-card">
          <span data-vehicle-year>Private collection</span>
          <p data-vehicle-category>Exotic vehicle</p>
          <h1 id="vehicle-private-title" data-vehicle-title>Vehicle</h1>
          <strong data-vehicle-price></strong>
          <a href="#vehicle-request">Request this vehicle <span aria-hidden="true">↘</span></a>
        </div>
        <div class="vehicle-gallery-stage">
          <button class="vehicle-gallery-nav vehicle-gallery-nav-prev" type="button" aria-label="Previous photo" data-gallery-prev><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
          <picture data-gallery-picture><source data-gallery-source /><img data-gallery-main alt="" width="1600" height="1100" fetchpriority="high" decoding="async" /></picture>
          <button class="vehicle-gallery-nav vehicle-gallery-nav-next" type="button" aria-label="Next photo" data-gallery-next><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>
        </div>
      </section>

      <div class="vehicle-private-photo-grid" data-gallery-thumbs aria-label="Vehicle gallery"></div>

      <section class="vehicle-private-information" aria-label="Vehicle information and request">
        <article class="vehicle-private-overview">
          <p class="eyebrow">Overview</p>
          <h2>Made for the moment.</h2>
          <p class="vehicle-private-summary" data-vehicle-summary></p>
          <div class="vehicle-private-specs" aria-label="Vehicle specifications">
            <div><span>Engine</span><strong data-vehicle-engine></strong></div>
            <div><span>Seats</span><strong data-vehicle-seats></strong></div>
            <div><span>0–60 mph</span><strong data-vehicle-acceleration></strong></div>
            <div><span>Body</span><strong data-vehicle-type></strong></div>
            <div><span>Exterior</span><strong data-vehicle-color></strong></div>
            <div><span>Included mileage</span><strong data-vehicle-mileage></strong></div>
          </div>

          <div class="vehicle-private-inclusions">
            <p class="eyebrow">The vehicle</p>
            <ul data-vehicle-details></ul>
          </div>

          <div class="vehicle-private-rates">
            <p class="eyebrow">Rate guidance</p>
            <div data-vehicle-tags></div>
            <p>Multi-day savings are calculated from the displayed daily rate. Additional mileage, delivery, and add-ons are confirmed by your concierge before approval.</p>
          </div>
        </article>

        <aside id="vehicle-request" class="vehicle-private-request">
          <p class="eyebrow">Private vehicle request</p>
          <h2>Check your dates.</h2>
          <p>Availability changes frequently. Your concierge will verify the exact vehicle and requested dates before confirming anything.</p>
          <div class="vehicle-request-rate"><span>Starting from</span><strong data-vehicle-price></strong></div>
          <form data-vehicle-request-form>
            <input name="vehicle" type="hidden" />
            <div class="vehicle-request-dates">
              <label><span>Pickup date</span><input name="date" type="date" required /></label>
              <label><span>Return date</span><input name="returnDate" type="date" required /></label>
            </div>
            <label><span>Delivery city or ZIP</span><input name="deliveryLocation" type="text" placeholder="Beverly Hills or 90210" required /></label>
            <label><span>Full name</span><input name="name" type="text" autocomplete="name" required /></label>
            <label><span>Phone</span><input name="phone" type="tel" autocomplete="tel" required /></label>
            <label><span>Email <small>Optional</small></span><input name="email" type="email" autocomplete="email" /></label>
            <label class="vehicle-request-alternatives"><input name="alternatives" type="checkbox" checked /><span>Show me similar options if this car is unavailable.</span></label>
            <label class="quote-honeypot" aria-hidden="true"><span>Company</span><input name="company" type="text" tabindex="-1" autocomplete="off" /></label>
            <button type="submit">Request This Vehicle <span aria-hidden="true">↗</span></button>
            <p data-vehicle-request-status role="status">No charge today. We will verify availability and contact you personally.</p>
          </form>
          <a class="vehicle-request-call" href="tel:+19496200024">Prefer to speak privately? Call (949) 620-0024</a>
        </aside>
      </section>

      ${hasStaticSeo ? "" : vehicleSeoMarkup(car)}

      <section class="related-section vehicle-product-related" aria-label="Related vehicles">
        <div class="section-heading compact-heading"><p class="eyebrow">Continue exploring</p><h2>Similar vehicles</h2><p>Three considered alternatives from the active collection.</p></div>
        <div class="related-grid" data-related></div>
      </section>
    </div>`;
  if (staticSeo) {
    const relatedSection = page.querySelector(".vehicle-product-related");
    relatedSection?.before(staticSeo);
  }
}

function setVehicleIndexing(isActive) {
  let robots = document.querySelector("meta[name='robots']");
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.append(robots);
  }
  robots.content = isActive ? "index, follow" : "noindex, follow";
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setTextAll(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function setAttr(selector, attribute, value) {
  const node = document.querySelector(selector);
  if (node) node.setAttribute(attribute, value);
}

function rateFromTag(tag, basePrice) {
  const match = String(tag || "").match(/^\$([\d,]+)(?:\.00)?\s+([^$]+)$/);
  if (!match) return null;
  const multiDayPrice = Number(match[1].replaceAll(",", ""));
  const dailyPrice = Number(basePrice);
  if (!Number.isFinite(multiDayPrice) || !Number.isFinite(dailyPrice) || dailyPrice <= 0) return null;
  const discount = Math.max(0, Math.round(((dailyPrice - multiDayPrice) / dailyPrice) * 100));
  return {
    discount,
    label: match[2],
  };
}

function vehicleSeoMarkup(vehicle) {
  return vehicleSeoSectionMarkup(vehicle, { formatPrice, escapeHtml });
}

function listingGallery(vehicle) {
  return [...new Set([...(vehicle.gallery || []), vehicle.image].filter(Boolean))]
    .slice(0, MAX_LISTING_PHOTOS)
    .map((image) => cacheSafeFleetImageUrl(image, vehicle.updatedAt || vehicle.updated_at));
}

function renderGallery(gallery) {
  const mainImage = document.querySelector("[data-gallery-main]");
  const mainSource = document.querySelector("[data-gallery-source]");
  const galleryThumbs = document.querySelector("[data-gallery-thumbs]");
  const previousButton = document.querySelector("[data-gallery-prev]");
  const nextButton = document.querySelector("[data-gallery-next]");
  let activeIndex = 0;

  function setActiveImage(index) {
    if (!gallery.length || !mainImage) return;
    activeIndex = (index + gallery.length) % gallery.length;
    const originalImage = gallery[activeIndex];
    const { optimized, fallback } = fleetImageSources(originalImage, { width: 2000, height: 1400, quality: 90, updatedAt: car.updatedAt || car.updated_at });
    const isLocalGallery = /^\/assets\/fleet-galleries\//i.test(fallback.split("?")[0]);
    const displaySource = isLocalGallery ? fallback : optimized;
    if (mainSource) {
      mainSource.srcset = displaySource;
      if (/\.webp(?:\?|$)/i.test(displaySource)) mainSource.type = "image/webp";
      else mainSource.removeAttribute("type");
    }
    mainImage.src = fallback;
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
      .map(
        (image, index) => `
          <button class="vehicle-side-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-image="${image}" data-gallery-index="${index}" aria-label="Show photo ${index + 1} of ${car.name}">
            ${fleetPictureMarkup(image, { alt: "", width: 1000, height: 660, quality: 88, updatedAt: car.updatedAt || car.updated_at, loading: "lazy", preferOriginalLocal: true })}
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

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function bindVehicleRequestForm() {
  const form = document.querySelector("[data-vehicle-request-form]");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  const status = form.querySelector("[data-vehicle-request-status]");
  const pickup = form.elements.date;
  const returnDate = form.elements.returnDate;
  pickup.min = localDateValue();
  returnDate.min = localDateValue();
  pickup.addEventListener("change", () => {
    returnDate.min = pickup.value || localDateValue();
    if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = returnDate.min;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const alternatives = Boolean(data.get("alternatives"));
    const payload = {
      requestType: "availability",
      name: data.get("name") || "",
      phone: data.get("phone") || "",
      email: data.get("email") || "",
      insuranceProvider: "",
      date: data.get("date") || "",
      vehicle: car?.name || data.get("vehicle") || "Vehicle request",
      addons: alternatives ? ["Similar options approved"] : [],
      message: [
        "Vehicle product-page availability request.",
        `Return date: ${data.get("returnDate") || "Not provided"}`,
        `Delivery city or ZIP: ${data.get("deliveryLocation") || "Not provided"}`,
        `Similar options approved: ${alternatives ? "Yes" : "No"}`,
      ].join("\n"),
      company: data.get("company") || "",
      pageUrl: window.location.href,
    };

    submit.disabled = true;
    submit.firstChild.textContent = "Sending request ";
    status.dataset.tone = "";
    status.textContent = "Saving your request for a personal availability check...";
    try {
      const result = await submitQuoteRequest(payload);
      try {
        const requests = JSON.parse(localStorage.getItem(CRM_REQUESTS_KEY)) || [];
        requests.unshift({ id: result.id || `vehicle-${Date.now()}`, ...payload, status: "new", createdAt: new Date().toISOString() });
        localStorage.setItem(CRM_REQUESTS_KEY, JSON.stringify(requests));
      } catch {
        // The local Admin mirror is best-effort; Supabase remains authoritative.
      }
      status.dataset.tone = "success";
      status.textContent = "Request received. Your concierge will verify the vehicle and contact you personally.";
      submit.firstChild.textContent = "Request received ";
      void recordFleetEvent("availability_success", { carSlug: slug, metadata: { vehicle: payload.vehicle } });
    } catch (error) {
      status.dataset.tone = "error";
      status.textContent = error.message || "Please call us directly to request this vehicle.";
      submit.firstChild.textContent = "Request This Vehicle ";
    } finally {
      submit.disabled = status.dataset.tone === "success";
    }
  });
}

function renderVehicle() {
  ensureVehicleShell();
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

  document.title = vehicleSeoTitle(car);
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.content = vehicleSeoDescription(car, formatPrice);
  setText("[data-vehicle-year]", vehicleYear(car));
  setText("[data-vehicle-category]", car.categoryLabel);
  const vehicleTitle = car.name.replace(/^\d{4}\s+/, "");
  const vehicleTitleNode = document.querySelector("[data-vehicle-title]");
  if (vehicleTitleNode) {
    vehicleTitleNode.textContent = vehicleTitle;
    vehicleTitleNode.classList.toggle("vehicle-title-long", vehicleTitle.length > 18);
    vehicleTitleNode.classList.toggle("vehicle-title-extra-long", vehicleTitle.length > 28);
  }
  setText("[data-vehicle-summary]", publicVehicleSummary(car));
  setTextAll("[data-vehicle-price]", `${formatPrice(car.price)}/day`);
  setText("[data-vehicle-mileage]", car.mileage);
  setText("[data-vehicle-color]", car.color);
  setText("[data-vehicle-make]", car.make);
  setText("[data-vehicle-model]", car.model);
  setText("[data-vehicle-engine]", engineForVehicle(car));
  setText("[data-vehicle-seats]", seatsForVehicle(car));
  setText("[data-vehicle-acceleration]", accelerationForVehicle(car));
  setText("[data-vehicle-type]", bodyTypeForVehicle(car));
  setAttr("[data-booking-link]", "href", `/?vehicle=${encodeURIComponent(car.name)}#booking`);
  const requestForm = document.querySelector("[data-vehicle-request-form]");
  if (requestForm) requestForm.elements.vehicle.value = car.name;
  bindVehicleRequestForm();

  const gallery = listingGallery(car);
  renderGallery(gallery);

  const rates = car.tags.map((tag) => rateFromTag(tag, car.price)).filter(Boolean);
  const featureTags = publicVehicleDetails(car).slice(0, 4);
  const tagsNode = document.querySelector("[data-vehicle-tags]");
  if (tagsNode) {
    tagsNode.innerHTML = `
      <div class="vehicle-rate-cards">
        ${rates
          .map(
            (rate) => `
              <div class="vehicle-rate-card">
                <span>${rate.label}</span>
                <strong>${rate.discount}%<small> savings</small></strong>
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
    detailsNode.innerHTML = publicVehicleDetails(car)
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
        (item, index) => `
          <a class="related-car" href="/cars/${item.slug}.html">
            <div class="related-car-media">
              ${fleetPictureMarkup(item.image, { alt: item.name, width: 720, height: 540, quality: 76, updatedAt: item.updatedAt || item.updated_at, loading: "lazy" })}
              <span aria-hidden="true">0${index + 1}</span>
            </div>
            <div class="related-car-meta">
              <span>${escapeHtml(item.categoryLabel)}</span>
              <small>${escapeHtml(vehicleYear(item))}</small>
            </div>
            <div class="related-car-main">
              <strong>${escapeHtml(item.name.replace(/^\d{4}\s+/, ""))}</strong>
              <small>${formatPrice(item.price)}<em>/day</em></small>
            </div>
            <span class="related-car-action">View vehicle <b aria-hidden="true">↗</b></span>
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

function initVehicle() {
  renderVehicle();
  document.body.classList.remove("is-loading-vehicle");
  void hydrateMonthlySpecialPrice();
  setVehicleIndexing(Boolean(car));
  void recordFleetEvent("vehicle_detail_view", {
    carSlug: slug,
    metadata: { vehicle: car?.name || slug },
  });
}

initVehicle();
