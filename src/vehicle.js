import { applyTripToForm } from "./rental-search.js";
import { vehicleShellMarkup } from "./vehicle-shell.js";
import { fleet, formatPrice, getVehicle, isPublicRendered } from "./live-fleet.js";
import {
  cacheSafeFleetImageUrl,
  fleetImageSources,
  fleetPictureMarkup,
  isSupabaseFleetConfigured,
  loadMonthlySpecialFromSupabase,
  recordFleetEvent,
} from "./supabase-fleet.js?v=product-image-quality-20260901";
import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260906";
import { enhanceHuracanProduct } from "./huracan-product.js?v=20260909";
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
  const specialSlugs = isSupabaseFleetConfigured ? configuredSlugs : monthlyFallbackSlugs(vehicleFleet, month);
  if (!specialSlugs.includes(slug)) return;

  const originalRate = Math.max(Number(car.price || 0), 0);
  const discountedRate = Math.round(originalRate * 0.9);
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const entity = data["@graph"]?.find(item => item.offers && item.url?.endsWith(`/cars/${slug}`));
      if (!entity) return;
      entity.offers.price = discountedRate;
      if (entity.offers.priceSpecification) entity.offers.priceSpecification.price = discountedRate;
      script.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
    } catch { /* Leave unrelated structured data unchanged. */ }
  });
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
  page.innerHTML = vehicleShellMarkup(hasStaticSeo ? "" : vehicleSeoMarkup(car));
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
  const galleryCount = document.querySelector("[data-gallery-count]");
  const galleryDots = document.querySelector("[data-gallery-dots]");
  const galleryStage = mainImage?.closest(".vehicle-gallery-stage");
  let activeIndex = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerOffsetX = 0;
  let activePointerId = null;
  let isHorizontalSwipe = false;

  function setActiveImage(index) {
    if (!gallery.length || !mainImage) return;
    activeIndex = (index + gallery.length) % gallery.length;
    const originalImage = gallery[activeIndex];
    const { optimized, fallback } = fleetImageSources(originalImage, { width: 1200, height: 825, quality: 82, updatedAt: car.updatedAt || car.updated_at });
    const displaySource = optimized;
    if (mainSource) {
      mainSource.srcset = displaySource;
      if (/\.webp(?:\?|$)/i.test(displaySource)) mainSource.type = "image/webp";
      else mainSource.removeAttribute("type");
    }
    mainImage.src = fallback;
    mainImage.alt = `${car.name} photo ${activeIndex + 1}`;
    if (galleryCount) galleryCount.textContent = `${activeIndex + 1} / ${gallery.length}`;
    galleryDots?.querySelectorAll("span").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === activeIndex);
    });
    document.querySelectorAll("[data-gallery-image]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.galleryIndex) === activeIndex);
    });
  }

  if (mainImage) {
    mainImage.draggable = false;
    if (gallery.length && !isPublicRendered) setActiveImage(0);
  }

  if (galleryThumbs && !isPublicRendered) {
    galleryThumbs.innerHTML = gallery
      .map(
        (image, index) => `
          <button class="vehicle-side-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-image="${image}" data-gallery-index="${index}" aria-label="Show photo ${index + 1} of ${car.name}">
            ${fleetPictureMarkup(image, { alt: "", width: 360, height: 240, quality: 78, updatedAt: car.updatedAt || car.updated_at, loading: "lazy" })}
          </button>
        `,
      )
      .join("");
  }
  if (galleryDots && !isPublicRendered) galleryDots.innerHTML = gallery.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("");


  document.querySelectorAll("[data-gallery-image]").forEach((button) => {
    button.addEventListener("click", () => setActiveImage(Number(button.dataset.galleryIndex)));
  });

  [previousButton, nextButton].forEach((button) => {
    if (!button) return;
    button.hidden = gallery.length < 2;
  });

  if (previousButton) previousButton.onclick = () => setActiveImage(activeIndex - 1);
  if (nextButton) nextButton.onclick = () => setActiveImage(activeIndex + 1);

  if (galleryStage && mainImage && gallery.length > 1) {
    galleryStage.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.target.closest("button, a")) return;
      activePointerId = event.pointerId;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerOffsetX = 0;
      isHorizontalSwipe = false;
      galleryStage.classList.add("is-touching");
      galleryStage.setPointerCapture?.(event.pointerId);
    });

    galleryStage.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointerId) return;
      const deltaX = event.clientX - pointerStartX;
      const deltaY = event.clientY - pointerStartY;
      if (!isHorizontalSwipe && Math.abs(deltaX) > 8) isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      if (!isHorizontalSwipe) return;
      event.preventDefault();
      pointerOffsetX = deltaX;
      mainImage.style.transform = `translate3d(${deltaX * 0.38}px, 0, 0) scale(1.015)`;
      mainImage.style.opacity = String(Math.max(0.64, 1 - Math.abs(deltaX) / 500));
    });

    const finishSwipe = (event) => {
      if (event.pointerId !== activePointerId) return;
      galleryStage.releasePointerCapture?.(event.pointerId);
      activePointerId = null;
      galleryStage.classList.remove("is-touching");
      mainImage.style.removeProperty("transform");
      mainImage.style.removeProperty("opacity");
      if (isHorizontalSwipe && Math.abs(pointerOffsetX) >= 42) {
        galleryStage.classList.add("is-settling");
        setActiveImage(activeIndex + (pointerOffsetX < 0 ? 1 : -1));
        window.setTimeout(() => galleryStage.classList.remove("is-settling"), 260);
      }
      pointerOffsetX = 0;
      isHorizontalSwipe = false;
    };

    galleryStage.addEventListener("pointerup", finishSwipe);
    galleryStage.addEventListener("pointercancel", finishSwipe);
  }
}

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function bindVehicleRequestForm() {
  const form = document.querySelector("[data-vehicle-request-form]");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  const status = form.querySelector("[data-vehicle-request-status]");
  const pickup = form.elements.date;
  const returnDate = form.elements.returnDate;
  const continueButton = form.querySelector("[data-request-continue]");
  const backButton = form.querySelector("[data-request-back]");
  const detailsStep = form.querySelector("[data-request-step='details']");
  const dateFields = [pickup, returnDate, form.elements.deliveryLocation].filter(Boolean);
  pickup.min = localDateTimeValue();
  applyTripToForm(form);
  const syncReturnDate = () => {
    if (!returnDate) return;
    returnDate.min = pickup.value || pickup.min;
    returnDate.setCustomValidity(returnDate.value && pickup.value && (pickup.type === "date" ? returnDate.value < pickup.value : returnDate.value <= pickup.value) ? "Return must be after pickup." : "");
  };
  pickup.addEventListener("change", syncReturnDate);
  returnDate?.addEventListener("change", syncReturnDate);
  syncReturnDate();

  continueButton?.addEventListener("click", () => {
    const invalidField = dateFields.find((field) => !field.checkValidity());
    if (invalidField) {
      invalidField.reportValidity();
      invalidField.focus({ preventScroll: true });
      return;
    }
    form.classList.add("show-details");
    detailsStep?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    window.setTimeout(() => form.elements.name?.focus({ preventScroll: true }), 220);
  });

  backButton?.addEventListener("click", () => {
    form.classList.remove("show-details");
    pickup.focus({ preventScroll: true });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncReturnDate();
    if (!form.reportValidity()) return;
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
        `Return date: ${data.get("returnDate") || "Not decided yet"}`,
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
    if (slug === "2022-lamborghini-huracan") {
      vehicleTitleNode.innerHTML = `<span>Huracán EVO</span><em>Spyder.</em>`;
      vehicleTitleNode.setAttribute("aria-label", "Lamborghini Huracán EVO Spyder");
    } else {
      vehicleTitleNode.textContent = vehicleTitle;
    }
    vehicleTitleNode.classList.toggle("vehicle-title-long", vehicleTitle.length > 18);
    vehicleTitleNode.classList.toggle("vehicle-title-extra-long", vehicleTitle.length > 28);
  }
  setText("[data-vehicle-summary]", publicVehicleSummary(car));
  setTextAll("[data-vehicle-price]", `${formatPrice(car.price)}/day`);
  setText("[data-vehicle-mileage]", car.mileage);
  setText("[data-vehicle-mileage-short]", String(car.mileage || "100").match(/\d+/)?.[0] || "100");
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
  if (slug === "2022-lamborghini-huracan") enhanceHuracanProduct(car);
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
  if (isPublicRendered && car) {
    bindVehicleRequestForm();
    renderGallery(listingGallery(car));
  } else renderVehicle();
  document.body.classList.remove("is-loading-vehicle");
  if (!isPublicRendered) void hydrateMonthlySpecialPrice();
  setVehicleIndexing(Boolean(car));
  void recordFleetEvent("vehicle_detail_view", {
    carSlug: slug,
    metadata: { vehicle: car?.name || slug },
  });
}

initVehicle();
