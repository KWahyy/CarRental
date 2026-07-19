import { ADMIN_FLEET_REFRESH_KEY } from "./admin-store.js?v=fleet-consistency-20260715";
import { fleet, formatPrice, getVehicle } from "./fleet-data.js?v=fleet-consistency-20260715";
import { cacheSafeFleetImageUrl, isSupabaseFleetConfigured, loadVehicleFromSupabase, recordFleetEvent } from "./supabase-fleet.js?v=fleet-consistency-20260715";
import { submitQuoteRequest } from "./quote-api.js?v=lead-delivery-20260718b";

const slug = document.body.dataset.vehicleSlug;
let baseVehicleFleet = fleet;
let vehicleFleet = baseVehicleFleet.slice();
let car = vehicleFleet.find((item) => item.slug === slug) || getVehicle(slug);
const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const CLOUD_VEHICLE_TIMEOUT_MS = 3500;
const MAX_LISTING_PHOTOS = 3;
const CRM_REQUESTS_KEY = "kds-crm-requests";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function vehicleYear(vehicle) {
  return String(vehicle?.year || vehicle?.name?.match(/^(\d{4})/)?.[1] || "Private collection");
}

function ensureVehicleShell() {
  const page = document.querySelector("[data-vehicle-page]");
  if (!page || page.querySelector(".vehicle-private-page")) return;
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
          <img data-gallery-main alt="" width="1600" height="1100" />
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
          <a class="vehicle-request-call" href="tel:+12132642967">Prefer to speak privately? Call (213) 264-2967</a>
        </aside>
      </section>

      <section class="vehicle-private-essentials" aria-labelledby="vehicle-essentials-title">
        <header><p class="eyebrow">Before you request</p><h2 id="vehicle-essentials-title">The essentials.</h2></header>
        <div>
          <article><span>01</span><h3>Driver approval</h3><p>A valid driver’s license, approved age and driving history, and identity verification may be required.</p></article>
          <article><span>02</span><h3>Insurance</h3><p>Proof of active insurance or another approved coverage arrangement is reviewed for the exact vehicle.</p></article>
          <article><span>03</span><h3>Security deposit</h3><p>The amount and release timing vary by vehicle, dates, coverage, and driver profile.</p></article>
          <article><span>04</span><h3>Concierge delivery</h3><p>Delivery timing, access, mileage, and any applicable fee are confirmed for your requested address.</p></article>
        </div>
      </section>

      <section class="vehicle-private-faq" aria-labelledby="vehicle-faq-title">
        <header><p class="eyebrow">Private rental desk</p><h2 id="vehicle-faq-title">Questions,<br /><em>answered.</em></h2></header>
        <div class="vehicle-private-faq-list">
          <details><summary>How do I qualify to rent this vehicle?<span>+</span></summary><p>Approval is vehicle-specific. You may need a valid driver’s license, proof of insurance, an acceptable driving history, identity verification, and an approved security deposit.</p></details>
          <details><summary>How many miles are included?<span>+</span></summary><p>The included daily mileage is shown above when available. Your confirmed quote will state the total allowance and the additional-mileage rate.</p></details>
          <details><summary>Can you deliver the car to me?<span>+</span></summary><p>Yes. KD’s Exotics operates as a delivery-only service. We confirm timing, access, and any delivery fee for your hotel, residence, airport-area meeting point, or approved address.</p></details>
          <details><summary>What payment methods are accepted?<span>+</span></summary><p>Accepted payment methods may vary by vehicle and booking. Your concierge will explain the approved payment arrangement before confirmation.</p></details>
          <details><summary>How much is the security deposit?<span>+</span></summary><p>Deposits vary by vehicle, dates, coverage, and driver profile. The exact amount is disclosed before you approve the reservation.</p></details>
          <details><summary>Can an international visitor rent?<span>+</span></summary><p>Possibly. International licenses, passports, coverage, age, and additional verification are reviewed individually before approval.</p></details>
        </div>
      </section>

      <section class="related-section vehicle-product-related" aria-label="Related vehicles">
        <div class="section-heading compact-heading"><p class="eyebrow">Continue exploring</p><h2>Similar vehicles</h2><p>Three considered alternatives from the active collection.</p></div>
        <div class="related-grid" data-related></div>
      </section>
    </div>`;
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
  const match = tag.match(/\$([\d,]+)(?:\.00)?\s+(.+)/);
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

function seatsForVehicle(vehicle) {
  const joined = `${vehicle.name} ${vehicle.category} ${vehicle.categoryLabel}`.toLowerCase();
  if (joined.includes("suv") || joined.includes("g-wagon") || joined.includes("g wagon") || joined.includes("gls") || joined.includes("gle") || joined.includes("g63") || joined.includes("escalade") || joined.includes("urus") || joined.includes("defender") || joined.includes("range rover") || joined.includes("cullinan") || joined.includes("macan") || joined.includes("cybertruck")) return "5 seats";
  if (joined.includes("panamera") || joined.includes("model s") || joined.includes("m3") || joined.includes("m5") || joined.includes("c63") || joined.includes("s63")) return "5 seats";
  if (joined.includes("m4")) return "4 seats";
  return "2 seats";
}

function engineForVehicle(vehicle) {
  const name = vehicle.name.toLowerCase();
  const make = vehicle.make.toLowerCase();
  if (name.includes("huracan") || name.includes("r8")) return "V10";
  if (name.includes("cybertruck") || name.includes("tesla")) return "Electric";
  if (name.includes("corvette")) return "V8";
  if (name.includes("urus") || name.includes("g63") || name.includes("g-wagon") || name.includes("g wagon") || name.includes("gls") || name.includes("gle") || name.includes("escalade") || name.includes("cullinan") || name.includes("defender") || name.includes("range rover")) return "V8 / SUV";
  if (make.includes("rolls") || make.includes("bentley")) return "Twin-turbo V8";
  if (make.includes("ferrari") || make.includes("mclaren")) return "Twin-turbo V8";
  if (make.includes("lotus")) return "Supercharged V6";
  if (make.includes("bmw")) return "Twin-turbo I6";
  if (make.includes("porsche")) return "Turbo flat-six";
  if (make.includes("ford")) return "Twin-turbo V6";
  return "Performance";
}

function accelerationForVehicle(vehicle) {
  const name = vehicle.name.toLowerCase();
  const make = vehicle.make.toLowerCase();
  if (name.includes("huracan")) return "2.9 sec";
  if (make.includes("ferrari") || make.includes("mclaren") || name.includes("r8") || name.includes("corvette")) return "3.1 sec";
  if (name.includes("urus")) return "3.6 sec";
  if (name.includes("tesla") || name.includes("plaid")) return "2.1 sec";
  if (make.includes("bmw")) return "3.8 sec";
  if (name.includes("g63") || name.includes("g-wagon") || name.includes("g wagon") || name.includes("gle") || name.includes("gls") || name.includes("escalade") || name.includes("range rover") || name.includes("defender")) return "4.5 sec";
  return "Fast";
}

function typeForVehicle(vehicle) {
  const label = vehicle.categoryLabel || vehicle.category;
  const joined = `${vehicle.name} ${vehicle.category} ${vehicle.summary}`.toLowerCase();
  if (joined.includes("convertible") || joined.includes("spyder") || joined.includes("spider") || joined.includes("gtc") || joined.includes("dawn") || joined.includes("portofino") || joined.includes("open-air")) return "Convertible";
  if (joined.includes("cybertruck") || joined.includes("f150")) return "Truck";
  if (joined.includes("suv") || joined.includes("g63") || joined.includes("g-wagon") || joined.includes("g wagon") || joined.includes("gle") || joined.includes("gls") || joined.includes("escalade") || joined.includes("urus") || joined.includes("defender") || joined.includes("range rover") || joined.includes("cullinan") || joined.includes("macan")) return "SUV";
  if (joined.includes("sedan") || joined.includes("m3") || joined.includes("m5") || joined.includes("c63") || joined.includes("s63") || joined.includes("panamera") || joined.includes("model s")) return "Sedan";
  return label;
}

function listingGallery(vehicle) {
  return [...new Set([...(vehicle.gallery || []), vehicle.image].filter(Boolean))]
    .slice(0, MAX_LISTING_PHOTOS)
    .map((image) => cacheSafeFleetImageUrl(image, vehicle.updatedAt || vehicle.updated_at));
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

  document.title = `${car.name} | KD's Exotics`;
  setText("[data-vehicle-year]", vehicleYear(car));
  setText("[data-vehicle-category]", car.categoryLabel);
  const vehicleTitle = car.name.replace(/^\d{4}\s+/, "");
  const vehicleTitleNode = document.querySelector("[data-vehicle-title]");
  if (vehicleTitleNode) {
    vehicleTitleNode.textContent = vehicleTitle;
    vehicleTitleNode.classList.toggle("vehicle-title-long", vehicleTitle.length > 18);
    vehicleTitleNode.classList.toggle("vehicle-title-extra-long", vehicleTitle.length > 28);
  }
  setText("[data-vehicle-summary]", car.summary);
  setTextAll("[data-vehicle-price]", `${formatPrice(car.price)}/day`);
  setText("[data-vehicle-mileage]", car.mileage);
  setText("[data-vehicle-color]", car.color);
  setText("[data-vehicle-make]", car.make);
  setText("[data-vehicle-model]", car.model);
  setText("[data-vehicle-engine]", engineForVehicle(car));
  setText("[data-vehicle-seats]", seatsForVehicle(car));
  setText("[data-vehicle-acceleration]", accelerationForVehicle(car));
  setText("[data-vehicle-type]", typeForVehicle(car));
  setAttr("[data-booking-link]", "href", `/?vehicle=${encodeURIComponent(car.name)}#booking`);
  const requestForm = document.querySelector("[data-vehicle-request-form]");
  if (requestForm) requestForm.elements.vehicle.value = car.name;
  bindVehicleRequestForm();

  const gallery = listingGallery(car);
  renderGallery(gallery);

  const rates = car.tags.map((tag) => rateFromTag(tag, car.price)).filter(Boolean);
  const featureTags = car.tags.filter((tag) => !rateFromTag(tag, car.price));
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
        (item, index) => `
          <a class="related-car" href="/cars/${item.slug}.html">
            <div class="related-car-media">
              <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" width="720" height="540" />
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

function refreshVehicleFromBase({ allowStaticFallback = true } = {}) {
  vehicleFleet = baseVehicleFleet.slice();
  car = vehicleFleet.find((item) => item.slug === slug) || (allowStaticFallback ? getVehicle(slug) : null);
  renderVehicle();
}

async function hydrateRemoteVehicle() {
  const remoteCar = await withTimeout(loadVehicleFromSupabase(slug), CLOUD_VEHICLE_TIMEOUT_MS, null);
  if (!remoteCar) {
    setVehicleIndexing(false);
    return false;
  }

  const bundledCar = baseVehicleFleet.find((item) => item.slug === remoteCar.slug);
  const bundledPricingIsNewer = Boolean(
    bundledCar?.competitorCheckedAt &&
    (!remoteCar.competitorCheckedAt || bundledCar.competitorCheckedAt >= remoteCar.competitorCheckedAt),
  );
  const publicCar = {
    ...remoteCar,
    ...(!remoteCar.gallery?.length && bundledCar?.gallery?.length ? { image: bundledCar.image, gallery: bundledCar.gallery } : {}),
    ...(bundledPricingIsNewer
      ? {
          price: bundledCar.price,
          competitorPrice: bundledCar.competitorPrice,
          competitorName: bundledCar.competitorName,
          competitorUrl: bundledCar.competitorUrl,
          competitorCheckedAt: bundledCar.competitorCheckedAt,
        }
      : {}),
  };

  baseVehicleFleet = baseVehicleFleet.some((item) => item.slug === publicCar.slug)
    ? baseVehicleFleet.map((item) => (item.slug === publicCar.slug ? publicCar : item))
    : [...baseVehicleFleet, publicCar];
  refreshVehicleFromBase({ allowStaticFallback: false });
  setVehicleIndexing(true);
  return true;
}

async function initVehicle() {
  renderVehicle();
  document.body.classList.remove("is-loading-vehicle");
  if (!isSupabaseFleetConfigured) setVehicleIndexing(Boolean(car));
  let hydrated = false;
  if (isSupabaseFleetConfigured) {
    try {
      hydrated = await hydrateRemoteVehicle();
    } catch (error) {
      console.warn("Could not initialize cloud vehicle:", error);
    }
  }

  if (!hydrated) {
    refreshVehicleFromBase({ allowStaticFallback: !isSupabaseFleetConfigured });
  }
  document.body.classList.remove("is-loading-vehicle");
  void recordFleetEvent("vehicle_detail_view", {
    carSlug: slug,
    metadata: { vehicle: car?.name || slug },
  });
}

initVehicle();

function refreshCloudVehicle() {
  if (!isSupabaseFleetConfigured) return;
  document.body.classList.add("is-loading-vehicle");
  hydrateRemoteVehicle()
    .then((hydrated) => {
      if (hydrated) return;
      refreshVehicleFromBase({ allowStaticFallback: !isSupabaseFleetConfigured });
    })
    .catch((error) => {
      console.warn("Could not refresh cloud vehicle:", error);
      refreshVehicleFromBase({ allowStaticFallback: !isSupabaseFleetConfigured });
    })
    .finally(() => {
      document.body.classList.remove("is-loading-vehicle");
    });
}

window.addEventListener("storage", (event) => {
  if (event.key !== ADMIN_FLEET_REFRESH_KEY) return;
  refreshCloudVehicle();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshCloudVehicle();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) refreshCloudVehicle();
});
