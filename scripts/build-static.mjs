import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PurgeCSS } from "purgecss";
import { transform } from "lightningcss";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../src/supabase-config.js";

const root = process.cwd();
const outDir = join(root, "dist");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const pathsToCopy = [
  "index.html",
  "exotic-car-rental.html",
  "faq.html",
  "fleet.html",
  "lamborghini.html",
  "ferrari.html",
  "partner.html",
  "quote.html",
  "agreement.html",
  "wedding.html",
  "admin",
  "assets",
  "cars",
  "images",
  "public",
  "src",
  "supabase"
];

for (const path of pathsToCopy) {
  const source = join(root, path);
  if (existsSync(source)) {
    cpSync(source, join(outDir, path), { recursive: true });
  }
}

async function buildHomepageStyles() {
  const homepageContent = [
    "index.html",
    "src/main.js",
    "src/admin-store.js",
    "src/fleet-data.js",
    "src/supabase-fleet.js",
    "src/quote-api.js",
  ].map((path) => join(root, path));
  const [{ css = "" } = {}] = await new PurgeCSS().purge({
    content: homepageContent,
    css: [join(root, "src/styles.css")],
    fontFace: true,
    keyframes: true,
    safelist: {
      standard: ["reveal", "revealed", "active", "selected", "hidden", "visible"],
      greedy: [/(^|-)is-/, /(^|-)has-/, /(^|-)open/, /(^|-)loading/, /(^|-)loaded/, /(^|-)success/, /(^|-)error/],
    },
  });

  const optimized = transform({
    filename: "styles-home.css",
    code: Buffer.from(css),
    minify: true,
  }).code;
  writeFileSync(join(outDir, "src", "styles-home.css"), optimized);

  const homepagePath = join(outDir, "index.html");
  const optimizedCss = Buffer.from(optimized).toString("utf8");
  const homepage = readFileSync(homepagePath, "utf8").replace(
    /<link rel="stylesheet" href="\/src\/styles\.css\?v=[^"]+" \/>/,
    `<style data-home-critical>${optimizedCss}</style>`,
  );
  writeFileSync(homepagePath, homepage);
}

await buildHomepageStyles();

const siteUrl = "https://www.prestigeluxor.com";
const carDir = join(outDir, "cars");
const phoneHref = "+19496200024";
const phoneLabel = "(949) 620-0024";
const retiredVehicleSlugs = new Set(["porschepanamera"]);

async function loadActiveInventory() {
  if (!SUPABASE_URL?.startsWith("https://") || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase fleet configuration is required to build indexable vehicle pages.");
  }

  const endpoint = new URL("/rest/v1/cars", SUPABASE_URL);
  endpoint.searchParams.set(
    "select",
    "id,slug,name,make,model,category,category_label,price,mileage,seats,color,summary,image_url,tags,details,updated_at,car_photos(position,url)",
  );
  endpoint.searchParams.set("is_active", "eq.true");
  endpoint.searchParams.set("order", "name.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load active inventory for SEO (${response.status} ${response.statusText}).`);
  }

  const rows = await response.json();
  return rows.filter((row) => /^[a-z0-9][a-z0-9-]*$/.test(row.slug) && !retiredVehicleSlugs.has(row.slug));
}

const activeInventory = await loadActiveInventory();
const activeInventoryBySlug = new Map(activeInventory.map((car) => [car.slug, car]));

const publicFleetSnapshot = activeInventory.map((car) => {
  const photos = [...(car.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
  const gallery = photos.map((photo) => photo.url).filter(Boolean).slice(0, 3);
  const image = gallery[0] || car.image_url || "/assets/prestige-luxor-hero.png";
  return {
    id: car.id,
    slug: car.slug,
    name: car.name,
    make: car.make,
    model: car.model,
    category: car.category,
    categoryLabel: car.category_label,
    category_label: car.category_label,
    price: car.price,
    mileage: car.mileage,
    seats: car.seats,
    color: car.color,
    summary: car.summary,
    image,
    image_url: image,
    gallery: gallery.length ? gallery : [image],
    tags: Array.isArray(car.tags) ? car.tags : [],
    details: Array.isArray(car.details) ? car.details : [],
    competitorPrice: null,
    competitorName: "",
    competitorUrl: "",
    competitorCheckedAt: "",
    updatedAt: car.updated_at || "",
  };
});

const fleetSnapshotModule = `export const fleet = ${JSON.stringify(publicFleetSnapshot, null, 2).replace(/</g, "\\u003c")};

export function formatPrice(price) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

export function formatCategory(category) {
  const label = category.split(" ")[0];
  return label === "suv" ? "SUV" : label;
}

export function getVehicle(slug) {
  return fleet.find((car) => car.slug === slug);
}
`;

writeFileSync(join(outDir, "src", "fleet-data.js"), fleetSnapshotModule);

const escapeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function optimizedPublicImageUrl(value, { width = 900, height = 675, quality = 78 } = {}) {
  const source = String(value || "");
  if (!source) return "/assets/optimized/prestige-luxor-hero.webp";
  if (source.includes("/storage/v1/object/public/")) {
    const url = new URL(source);
    url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", String(quality));
    return url.href;
  }
  if (/^\/assets\/fleet\/[^/]+\.(jpe?g|png)$/i.test(source)) {
    return source.replace("/assets/fleet/", "/assets/fleet-optimized/").replace(/\.(jpe?g|png)$/i, ".webp");
  }
  if (/^\/assets\/fleet-galleries\/.+\.(jpe?g|png)$/i.test(source)) {
    return source.replace("/assets/fleet-galleries/", "/assets/fleet-galleries-optimized/").replace(/\.(jpe?g|png)$/i, ".webp");
  }
  return source;
}

function publicCarImage(car, options) {
  const photos = [...(car?.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
  return optimizedPublicImageUrl(photos.find(({ url }) => url)?.url || car?.image_url, options);
}

function publicCarOriginalImage(car) {
  const photos = [...(car?.car_photos || [])].sort((a, b) => Number(a.position) - Number(b.position));
  return photos.find(({ url }) => url)?.url || car?.image_url || "/assets/prestige-luxor-hero.png";
}

function publicCarPicture(car, { alt = "", width = 900, height = 675, quality = 78, loading = "lazy", fetchPriority = "" } = {}) {
  const optimized = publicCarImage(car, { width, height, quality });
  const fallback = publicCarOriginalImage(car);
  const sourceType = /\.webp(?:\?|$)/i.test(optimized) ? ' type="image/webp"' : "";
  return `<picture><source srcset="${escapeHtml(optimized)}"${sourceType} /><img src="${escapeHtml(fallback)}" alt="${escapeHtml(alt)}" width="${width}" height="${height}" loading="${loading}" decoding="async"${fetchPriority ? ` fetchpriority="${fetchPriority}"` : ""} /></picture>`;
}

function locationFeaturedCars() {
  const preferredSlugs = ["2022-lamborghini-huracan", "ferrari-f8", "rolls-royce-cullinan-white"];
  const selected = preferredSlugs.map((slug) => activeInventoryBySlug.get(slug)).filter(Boolean);
  for (const car of activeInventory) {
    if (selected.length >= 3) break;
    if (!selected.some(({ slug }) => slug === car.slug)) selected.push(car);
  }
  return selected;
}

function locationEnhancements({ slug, area }, { includeFleet = true } = {}) {
  const featuredCars = locationFeaturedCars();
  const fleetCards = includeFleet ? featuredCars.map((car) => `
        <article class="location-vehicle-card">
          <a class="location-vehicle-image" href="/cars/${escapeHtml(car.slug)}">
            ${publicCarPicture(car, { alt: `${car.name} available for ${area} delivery` })}
          </a>
          <div><p>${escapeHtml(car.make)}</p><h3>${escapeHtml(car.model)}</h3><span>From $${Number(car.price).toLocaleString("en-US")}/day</span></div>
          <a href="/cars/${escapeHtml(car.slug)}">View vehicle <span aria-hidden="true">&#8599;</span></a>
        </article>`).join("") : "";
  const vehicleOptions = activeInventory
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((car) => `<option value="${escapeHtml(car.name)}">${escapeHtml(car.name)} — from $${Number(car.price).toLocaleString("en-US")}/day</option>`)
    .join("");

  return `
      ${includeFleet ? `<section class="location-vehicles" aria-labelledby="location-fleet-${slug}">
        <div class="location-section-heading"><div><p>Popular in ${escapeHtml(area)}</p><h2 id="location-fleet-${slug}">Choose the car first.</h2></div><a href="/fleet">View all vehicles</a></div>
        <div class="location-vehicle-grid">${fleetCards}</div>
      </section>` : ""}
      <section class="location-faq" aria-labelledby="location-faq-${slug}">
        <div class="location-section-heading"><div><p>${escapeHtml(area)} rental details</p><h2 id="location-faq-${slug}">Know before you request.</h2></div></div>
        <div class="location-faq-list">
          <details><summary>Where can the vehicle be delivered in ${escapeHtml(area)}?</summary><p>We confirm an eligible hotel, residence, event venue, or agreed meeting location after reviewing access, timing, distance, and the selected vehicle.</p></details>
          <details><summary>Is the online daily rate the final total?</summary><p>The displayed rate is a starting daily rate. Your private quote confirms dates, rental length, mileage, delivery, deposit, and any requested add-ons before you approve anything.</p></details>
          <details><summary>What is required to reserve a vehicle?</summary><p>Start with the form below. License, insurance, eligibility, security deposit, agreement, and payment details are reviewed later during approval.</p></details>
        </div>
      </section>
      <section class="location-quote-section" id="location-quote" aria-labelledby="location-quote-${slug}">
        <div class="location-quote-copy"><p>Private availability check</p><h2 id="location-quote-${slug}">Request ${escapeHtml(area)} delivery.</h2><span>No payment is collected here. A concierge verifies the exact vehicle, dates, and total with you.</span></div>
        <form class="location-quote-form" data-location-quote data-location-slug="${escapeHtml(slug)}" data-location-name="${escapeHtml(area)}">
          <div class="location-form-grid">
            <label><span>Name</span><input name="name" type="text" autocomplete="name" required /></label>
            <label><span>Phone</span><input name="phone" type="tel" autocomplete="tel" required /></label>
            <label><span>Email</span><input name="email" type="email" autocomplete="email" /></label>
            <label><span>Pickup date</span><input name="date" type="date" required /></label>
            <label><span>Return date</span><input name="returnDate" type="date" /></label>
            <label><span>Delivery city or ZIP</span><input name="deliveryLocation" type="text" autocomplete="postal-code" required /></label>
            <label class="location-form-wide"><span>Vehicle</span><select name="vehicle" required><option value="">Choose a vehicle</option><option value="Vehicle recommendation requested">Help me choose</option>${vehicleOptions}</select></label>
            <label class="location-form-wide"><span>Notes</span><textarea name="message" rows="4" placeholder="Share timing, occasion, passengers, or questions."></textarea></label>
            <label class="quote-honeypot" aria-hidden="true"><span>Company</span><input name="company" type="text" tabindex="-1" autocomplete="off" /></label>
          </div>
          <button type="submit">Check availability</button>
          <p class="location-quote-status" data-location-quote-status role="status">Your request goes directly to the Prestige Luxor booking desk.</p>
        </form>
      </section>`;
}

function pageShell({ title, description, path, eyebrow, heading, lead, content, schemaType = "WebPage", area = "" }) {
  const canonical = `${siteUrl}/${path}`;
  const isLocationPage = path.startsWith("locations/");
  const pageEntity = {
    "@type": schemaType,
    name: heading,
    description,
    url: canonical,
    provider: { "@id": `${siteUrl}/#business` },
    ...(isLocationPage ? { serviceType: "Exotic and luxury car rental delivery", areaServed: { "@type": "AdministrativeArea", name: area } } : {}),
  };
  const schema = isLocationPage ? {
    "@context": "https://schema.org",
    "@graph": [
      pageEntity,
      {
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: `Where can the vehicle be delivered in ${area}?`, acceptedAnswer: { "@type": "Answer", text: "Prestige Luxor confirms an eligible hotel, residence, event venue, or agreed meeting location after reviewing access, timing, distance, and the selected vehicle." } },
          { "@type": "Question", name: "Is the online daily rate the final total?", acceptedAnswer: { "@type": "Answer", text: "The displayed rate is a starting daily rate. The private quote confirms dates, rental length, mileage, delivery, deposit, and requested add-ons before approval." } },
          { "@type": "Question", name: "What is required to reserve a vehicle?", acceptedAnswer: { "@type": "Answer", text: "The initial request needs contact information, dates, preferred vehicle, and delivery area. License, insurance, eligibility, security deposit, agreement, and payment details are reviewed later during approval." } },
        ],
      },
    ],
  } : { "@context": "https://schema.org", ...pageEntity };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#070606" />
    <title>${title}</title>
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prestige Luxor" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${siteUrl}/assets/prestige-luxor-search-preview.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${escapeJson(schema)}</script>
    <link rel="icon" type="image/png" sizes="48x48" href="/assets/prestige-luxor-favicon-48.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/prestige-luxor-favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/prestige-luxor-favicon-16.png" />
    <link rel="apple-touch-icon" href="/assets/prestige-luxor-apple-touch-icon.png?v=prestige-luxor-20260806" />
    <link rel="stylesheet" href="/src/styles.css?v=site-theme-20260719" />
  </head>
  <body class="site-theme site-content-page">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header scrolled" data-header>
      <a class="brand" href="/" aria-label="Prestige Luxor home"><img class="brand-logo brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" /></a>
      <nav class="desktop-nav" aria-label="Primary navigation"><a href="/fleet.html">Fleet</a><a href="/partner.html">Partner</a><a href="/faq">FAQ</a></nav>
      <div class="header-actions"><a class="ghost-button" href="tel:${phoneHref}">Call</a><a class="primary-button compact" href="${isLocationPage ? "#location-quote" : "/#quote"}">Reserve</a></div>
      <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-toggle><span></span><span></span></button>
    </header>
    <div class="mobile-menu" data-mobile-menu><a href="/fleet.html">Fleet</a><a href="/partner.html">Partner</a><a href="/faq">FAQ</a><a href="tel:${phoneHref}">Call</a><a href="${isLocationPage ? "#location-quote" : "/#quote"}">Reserve</a></div>
    <main id="main" class="seo-page-main">
      <header class="seo-page-hero">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${heading}</h1>
        <p class="seo-page-lead">${lead}</p>
        <div class="seo-page-actions"><a class="primary-button" href="/fleet">Browse the fleet</a><a class="ghost-button" href="tel:${phoneHref}">Call ${phoneLabel}</a></div>
      </header>
      <div class="seo-copy">${content}</div>
    </main>
    <footer class="site-footer">
      <div class="footer-main"><a class="brand footer-brand" href="/" aria-label="Prestige Luxor home"><span class="footer-logo-frame"><img class="brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" loading="lazy" /></span></a><p>Exotic and luxury car rentals with concierge delivery across Los Angeles and Orange County.</p><div class="footer-contact"><a href="tel:${phoneHref}">Call ${phoneLabel}</a><a href="sms:${phoneHref}">Text concierge</a><a href="mailto:Contact@prestigeluxor.com">Email</a></div></div>
      <div class="footer-columns">
        <nav class="footer-links" aria-label="Explore"><h3>Explore</h3><a href="/fleet">Fleet</a><a href="/partner">Become a Partner</a><a href="${isLocationPage ? "#location-quote" : "/#quote"}">Request Quote</a></nav>
        <nav class="footer-links" aria-label="Locations"><h3>Locations</h3><a href="/locations/los-angeles-exotic-car-rental">Los Angeles</a><a href="/locations/orange-county-exotic-car-rental">Orange County</a><a href="/locations/lax-exotic-car-delivery">LAX Delivery</a><a href="/locations/sna-exotic-car-delivery">SNA Delivery</a></nav>
        <nav class="footer-links" aria-label="Company"><h3>Company</h3><a href="/about">About</a><a href="/rental-policies">Rental Policies</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/admin/" rel="nofollow">Admin Login</a></nav>
      </div>
      <div class="footer-bottom"><span>© 2026 Prestige Luxor. All rights reserved.</span><span>Rental approval required. Rates subject to availability.</span></div>
    </footer>
    <script type="module" src="/src/partner.js?v=public-nav-20260713"></script>
    ${isLocationPage ? '<script type="module" src="/src/location-page.js?v=location-leads-20260823"></script>' : ""}
  </body>
</html>`;
}

function orangeCountyPage({ title, description, heading, lead, path }) {
  const canonical = `${siteUrl}/${path}`;
  const preferredSlugs = [
    "2022-lamborghini-huracan",
    "ferrari-f8",
    "rolls-royce-cullinan-white",
  ];
  const featuredCars = preferredSlugs
    .map((slug) => activeInventoryBySlug.get(slug))
    .filter(Boolean);

  for (const car of activeInventory) {
    if (featuredCars.length >= 3) break;
    if (!featuredCars.some((featured) => featured.slug === car.slug)) featuredCars.push(car);
  }

  const heroCar = featuredCars[0];
  const heroImage = heroCar ? publicCarImage(heroCar, { width: 960, height: 640, quality: 80 }) : "/assets/optimized/prestige-luxor-hero.webp";
  const heroImageSrcset = heroCar
    ? [
        [640, 427, 76],
        [960, 640, 80],
        [1600, 1067, 82],
      ].map(([width, height, quality]) => `${publicCarImage(heroCar, { width, height, quality })} ${width}w`).join(", ")
    : "";
  const heroImagePreconnect = heroImage.startsWith("https://")
    ? `<link rel="preconnect" href="${new URL(heroImage).origin}" crossorigin />`
    : "";
  const fleetCards = featuredCars.map((car) => `
          <article class="oc-showroom-card">
            <a class="oc-showroom-media" href="/cars/${car.slug}" aria-label="View ${car.make} ${car.model}">
              ${publicCarPicture(car, { alt: `${car.make} ${car.model} available from Prestige Luxor`, width: 1200, height: 900 })}
            </a>
            <div class="oc-showroom-card-copy">
              <div>
                <span>${car.make}</span>
                <h3>${car.model}</h3>
              </div>
              <p>From <strong>$${Number(car.price).toLocaleString("en-US")}</strong>/day</p>
            </div>
            <a class="oc-showroom-link" href="/cars/${car.slug}"><span>View vehicle</span><span aria-hidden="true">&#8599;</span></a>
          </article>`).join("");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Service", name: heading, description, url: canonical, serviceType: "Exotic and luxury car rental delivery", areaServed: ["Orange County", "Newport Beach", "Irvine", "Anaheim"], provider: { "@id": `${siteUrl}/#business` } },
      { "@type": "FAQPage", mainEntity: [
        { "@type": "Question", name: "Where can the vehicle be delivered in Orange County?", acceptedAnswer: { "@type": "Answer", text: "Prestige Luxor confirms an eligible hotel, residence, event venue, or agreed meeting location after reviewing access, timing, distance, and the selected vehicle." } },
        { "@type": "Question", name: "Is the online daily rate the final total?", acceptedAnswer: { "@type": "Answer", text: "The displayed rate is a starting daily rate. The private quote confirms dates, rental length, mileage, delivery, deposit, and requested add-ons before approval." } },
        { "@type": "Question", name: "What is required to reserve a vehicle?", acceptedAnswer: { "@type": "Answer", text: "The initial request needs contact information, dates, preferred vehicle, and delivery area. License, insurance, eligibility, security deposit, agreement, and payment details are reviewed later during approval." } },
      ] },
    ],
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#080808" />
    ${heroImagePreconnect}
    <title>${title}</title>
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prestige Luxor" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${heroImage.startsWith("http") ? heroImage : `${siteUrl}${heroImage}`}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${escapeJson(schema)}</script>
    <link rel="icon" type="image/png" sizes="48x48" href="/assets/prestige-luxor-favicon-48.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/prestige-luxor-favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/prestige-luxor-favicon-16.png" />
    <link rel="apple-touch-icon" href="/assets/prestige-luxor-apple-touch-icon.png?v=prestige-luxor-20260806" />
  <link rel="stylesheet" href="/src/styles.css?v=site-theme-20260719" />
  </head>
  <body class="site-theme fleet-page oc-location-page">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header scrolled" data-header>
      <a class="brand" href="/" aria-label="Prestige Luxor home"><img class="brand-logo brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" /></a>
      <nav class="desktop-nav" aria-label="Primary navigation"><a href="/fleet.html">Fleet</a><a href="/partner.html">Partner</a><a href="/faq">FAQ</a></nav>
      <div class="header-actions"><a class="ghost-button" href="tel:${phoneHref}">Call</a><a class="primary-button compact" href="#location-quote">Reserve</a></div>
      <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-toggle><span></span><span></span></button>
    </header>
    <div class="mobile-menu" data-mobile-menu><a href="/fleet.html">Fleet</a><a href="/partner.html">Partner</a><a href="/faq">FAQ</a><a href="tel:${phoneHref}">Call</a><a href="#location-quote">Reserve</a></div>

    <main id="main" class="oc-location-main">
      <section class="oc-location-hero" aria-labelledby="oc-location-title">
        <picture class="native-picture"><source srcset="${heroImageSrcset || heroImage}" sizes="100vw" /><img class="oc-location-hero-media" src="${escapeHtml(heroCar ? publicCarOriginalImage(heroCar) : "/assets/prestige-luxor-hero.png")}" alt="${heroCar ? `${heroCar.make} ${heroCar.model}` : "Exotic car"} available for Orange County delivery" width="1600" height="1067" fetchpriority="high" decoding="async" /></picture>
        <div class="oc-location-hero-scrim" aria-hidden="true"></div>
        <div class="oc-location-hero-content">
          <p class="oc-location-kicker">Orange County exotic car rental</p>
          <h1 id="oc-location-title">Meet your<br />next arrival.</h1>
          <p>Premium cars, clear quotes, and concierge delivery built around your plans.</p>
          <div class="oc-new-client-offer" aria-label="New client offer">
            <strong>10% off</strong>
            <span>Your first Prestige Luxor rental</span>
            <small>New clients only. Select vehicles and dates.</small>
          </div>
          <div class="oc-location-actions">
            <a class="oc-location-primary" href="#orange-county-fleet">Explore the fleet</a>
            <a class="oc-location-secondary" href="#location-quote">Request a quote <span aria-hidden="true">&#8594;</span></a>
          </div>
        </div>
        ${heroCar ? `<a class="oc-location-featured" href="/cars/${heroCar.slug}"><span>Featured vehicle</span><strong>${heroCar.make} ${heroCar.model}</strong><small>From $${Number(heroCar.price).toLocaleString("en-US")}/day <b aria-hidden="true">&#8599;</b></small></a>` : ""}
      </section>

      <section class="oc-location-fleet" id="orange-county-fleet" aria-labelledby="oc-fleet-title">
        <header class="oc-section-heading">
          <div><p>Available now</p><h2 id="oc-fleet-title">Choose your arrival.</h2></div>
          <a href="/fleet.html">View the full fleet <span aria-hidden="true">&#8594;</span></a>
        </header>
        <div class="oc-showroom-grid">${fleetCards}</div>
      </section>

      <section class="oc-location-service" aria-labelledby="oc-service-title">
        <div class="oc-service-intro">
          <p>Three steps. No rental counter.</p>
          <h2 id="oc-service-title">Booked without the runaround.</h2>
        </div>
        <div class="oc-service-steps">
          <article><span>01</span><h3>Choose the car</h3><p>Send the vehicle, date, and driver details.</p></article>
          <article><span>02</span><h3>Get approved</h3><p>We confirm availability, insurance, deposit, mileage, and delivery.</p></article>
          <article><span>03</span><h3>Take the keys</h3><p>Meet your vehicle at the confirmed handoff.</p></article>
        </div>
      </section>

      <section class="oc-location-quote" aria-labelledby="oc-quote-title">
        <div>
          <p>Before you commit</p>
          <h2 id="oc-quote-title">Everything<br />upfront.</h2>
        </div>
        <dl>
          <div><dt>Vehicle</dt><dd>Exact car and live availability</dd></div>
          <div><dt>Schedule</dt><dd>Dates and delivery window</dd></div>
          <div><dt>Approval</dt><dd>License, insurance, and deposit</dd></div>
          <div><dt>Total</dt><dd>Mileage, delivery, and add-ons</dd></div>
        </dl>
      </section>

      ${locationEnhancements({ slug: "orange-county-exotic-car-rental", area: "Orange County" }, { includeFleet: false })}

      <section class="oc-location-final" aria-labelledby="oc-final-title">
        <p>10% off for first-time clients</p>
        <h2 id="oc-final-title">Make the first one count.</h2>
        <div><a class="oc-location-primary" href="#location-quote">Request a quote</a><a class="oc-location-secondary" href="tel:${phoneHref}">Call ${phoneLabel}</a></div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="footer-main"><a class="brand footer-brand" href="/" aria-label="Prestige Luxor home"><span class="footer-logo-frame"><img class="brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" loading="lazy" /></span></a><p>Exotic and luxury car rentals with concierge delivery across Los Angeles and Orange County.</p><div class="footer-contact"><a href="tel:${phoneHref}">Call ${phoneLabel}</a><a href="sms:${phoneHref}">Text concierge</a><a href="mailto:Contact@prestigeluxor.com">Email</a></div></div>
      <div class="footer-columns">
        <nav class="footer-links" aria-label="Explore"><h3>Explore</h3><a href="/fleet">Fleet</a><a href="/partner">Become a Partner</a><a href="/#quote">Request Quote</a></nav>
        <nav class="footer-links" aria-label="Locations"><h3>Locations</h3><a href="/locations/los-angeles-exotic-car-rental">Los Angeles</a><a href="/locations/orange-county-exotic-car-rental">Orange County</a><a href="/locations/lax-exotic-car-delivery">LAX Delivery</a><a href="/locations/sna-exotic-car-delivery">SNA Delivery</a></nav>
        <nav class="footer-links" aria-label="Company"><h3>Company</h3><a href="/about">About</a><a href="/rental-policies">Rental Policies</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/admin/" rel="nofollow">Admin Login</a></nav>
      </div>
      <div class="footer-bottom"><span>© 2026 Prestige Luxor. All rights reserved.</span><span>Rental approval required. Rates subject to availability.</span></div>
    </footer>
    <script type="module" src="/src/partner.js?v=public-nav-20260713"></script>
    <script type="module" src="/src/location-page.js?v=location-leads-20260823"></script>
  </body>
</html>`;
}

const locationPages = [
  {
    slug: "los-angeles-exotic-car-rental",
    area: "Los Angeles",
    title: "Exotic Car Rental Los Angeles | Prestige Luxor",
    description: "Rent an exotic or luxury car in Los Angeles with concierge delivery, flexible booking, and a curated fleet from Prestige Luxor.",
    heading: "Exotic car rental in Los Angeles.",
    lead: "From a weekend in West Hollywood to a production day downtown, Prestige Luxor coordinates the vehicle, timing, and delivery details around your plans.",
    content: `<section><h2>Built around Los Angeles schedules</h2><p>Traffic, venue access, hotel loading zones, and production timing all matter here. Share your address, requested arrival window, dates, and preferred vehicle so our team can confirm a practical handoff plan before approval.</p></section><div class="seo-card-grid"><article class="seo-card"><h3>Private rentals</h3><p>Choose a supercar, convertible, performance sedan, or luxury SUV for personal travel and special occasions.</p></article><article class="seo-card"><h3>Events and content</h3><p>Ask about arrivals, brand activations, photography coordination, and vehicles for content production.</p></article><article class="seo-card"><h3>Concierge delivery</h3><p>Delivery is confirmed by location, schedule, vehicle availability, and access requirements.</p></article></div><section><h2>Popular Los Angeles requests</h2><ul><li>Beverly Hills and West Hollywood hotel delivery</li><li>Hollywood, Downtown LA, and event arrivals</li><li>Malibu day trips and coastal drives</li><li>LAX arrival coordination</li></ul></section>`
  },
  {
    slug: "orange-county-exotic-car-rental",
    area: "Orange County",
    title: "Exotic Car Rental Orange County | Prestige Luxor",
    description: "Explore exotic and luxury car rentals in Orange County with delivery options for Newport Beach, Irvine, Anaheim, and surrounding communities.",
    heading: "Exotic car rental in Orange County.",
    lead: "Prestige Luxor serves Orange County clients looking for a memorable car, a straightforward quote, and delivery planned around the day—not the other way around.",
    content: `<section><h2>From coastal weekends to event arrivals</h2><p>Orange County bookings range from Newport Coast getaways to Anaheim events and Irvine business travel. Tell us where the car is needed, who will drive, and the dates so we can confirm availability, mileage, deposit, and delivery.</p></section><div class="seo-card-grid"><article class="seo-card"><h3>Newport Beach</h3><p>Convertibles, supercars, and luxury SUVs for coastal stays, dinners, and celebrations.</p></article><article class="seo-card"><h3>Irvine</h3><p>Performance sedans and executive SUVs for local travel, meetings, and weekend plans.</p></article><article class="seo-card"><h3>Anaheim</h3><p>Vehicle delivery for events, hotels, entertainment districts, and private bookings.</p></article></div><section><h2>What your quote covers</h2><p>Every quote is based on the exact vehicle, dates, driver requirements, mileage plan, delivery address, and optional add-ons. Online prices are starting points until the team confirms the booking.</p></section>`
  },
  {
    slug: "beverly-hills-luxury-car-rental",
    area: "Beverly Hills",
    title: "Luxury Car Rental Beverly Hills | Prestige Luxor",
    description: "Reserve a luxury or exotic car in Beverly Hills with discreet concierge coordination and delivery from Prestige Luxor.",
    heading: "Luxury car rental in Beverly Hills.",
    lead: "Arrive in a vehicle that fits the occasion, with hotel, residence, restaurant, and event delivery details confirmed before the handoff.",
    content: `<section><h2>A considered Beverly Hills experience</h2><p>We coordinate around valet access, hotel policies, event timing, and the driver’s schedule. Luxury SUVs suit groups and luggage; convertibles and supercars work well for celebrations, dinners, and scenic drives.</p></section><div class="seo-card-grid"><article class="seo-card"><h3>Hotel delivery</h3><p>Provide the hotel name, guest name, arrival window, and valet instructions when available.</p></article><article class="seo-card"><h3>Special occasions</h3><p>Plan proposals, anniversaries, birthdays, shoots, and private event arrivals.</p></article><article class="seo-card"><h3>Discreet service</h3><p>Booking details, driver approval, and delivery logistics are handled directly with the client.</p></article></div><section><h2>Before the keys are handed over</h2><p>A valid driver’s license, proof of insurance, approved security deposit, signed agreement, and final payment arrangements may be required.</p></section>`
  },
  {
    slug: "newport-beach-exotic-car-rental",
    area: "Newport Beach",
    title: "Exotic Car Rental Newport Beach | Prestige Luxor",
    description: "Book an exotic car rental in Newport Beach for coastal drives, celebrations, hotels, and private events with Prestige Luxor.",
    heading: "Exotic car rental in Newport Beach.",
    lead: "Pair the coast with the right car—from open-top drives along Pacific Coast Highway to luxury SUVs for a full Newport weekend.",
    content: `<section><h2>Made for the coast</h2><p>Newport Beach bookings often involve hotel stays, marina plans, dinners, weddings, and scenic drives. We help match the vehicle to passengers, luggage, route, and the experience you want.</p></section><div class="seo-card-grid"><article class="seo-card"><h3>Coastal drives</h3><p>Ask about convertibles and performance cars suited to your route and mileage plan.</p></article><article class="seo-card"><h3>Weddings and events</h3><p>Coordinate arrival timing, photography, delivery, and venue access in advance.</p></article><article class="seo-card"><h3>Weekend stays</h3><p>Choose a vehicle with the right space and comfort for hotels, dining, and local travel.</p></article></div><section><h2>Delivery throughout the Newport area</h2><p>Delivery may be available in Newport Beach, Newport Coast, Corona del Mar, Costa Mesa, and nearby Orange County communities, subject to schedule and vehicle availability.</p></section>`
  },
  {
    slug: "lax-exotic-car-delivery",
    area: "LAX and Los Angeles",
    title: "LAX Exotic Car Delivery | Prestige Luxor",
    description: "Plan exotic or luxury car delivery near LAX with flight-aware arrival coordination from Prestige Luxor.",
    heading: "Exotic car delivery for LAX arrivals.",
    lead: "Send the flight details and destination early so we can plan a realistic handoff around airport rules, traffic, delays, and your onward itinerary.",
    content: `<section><h2>Airport delivery requires a plan</h2><p>LAX access and curb activity can change quickly. Depending on the booking, the handoff may be coordinated at an approved nearby location, hotel, residence, or other agreed meeting point rather than directly at a terminal curb.</p></section><div class="seo-card-grid"><article class="seo-card"><h3>Share your flight</h3><p>Provide airline, flight number, arrival time, terminal, passenger count, and luggage estimate.</p></article><article class="seo-card"><h3>Choose for the trip</h3><p>Consider luggage space, passengers, driving distance, and hotel parking—not only the look of the car.</p></article><article class="seo-card"><h3>Allow flexibility</h3><p>Traffic, baggage delays, airport restrictions, and schedule changes can affect the final meeting window.</p></article></div><section><h2>Continue from LAX</h2><p>Common destinations include Beverly Hills, West Hollywood, Downtown Los Angeles, Malibu, Santa Monica, and Orange County. Delivery and mileage are quoted for the actual itinerary.</p></section>`
  },
  {
    slug: "sna-exotic-car-delivery",
    area: "SNA and Orange County",
    title: "SNA Exotic Car Delivery | Prestige Luxor",
    description: "Arrange exotic or luxury car delivery near John Wayne Airport for Newport Beach, Irvine, and Orange County travel.",
    heading: "Exotic car delivery for SNA arrivals.",
    lead: "Start an Orange County trip with the vehicle already coordinated for your flight, luggage, destination, and arrival schedule.",
    content: `<section><h2>A smoother Orange County arrival</h2><p>John Wayne Airport places travelers close to Irvine, Costa Mesa, and Newport Beach. Share your flight and hotel or residence details so the team can confirm an approved, practical meeting location.</p></section><div class="seo-card-grid"><article class="seo-card"><h3>Flight coordination</h3><p>We use the provided arrival details to plan timing, while allowing for baggage and flight delays.</p></article><article class="seo-card"><h3>Right-size the vehicle</h3><p>Luxury SUVs and sedans may be the better choice when passengers and luggage are part of the trip.</p></article><article class="seo-card"><h3>Local destinations</h3><p>Continue to Newport Beach, Irvine, Anaheim, Laguna Beach, or another approved service address.</p></article></div><section><h2>What to send with your request</h2><ul><li>Flight number and arrival time</li><li>Driver name, age, and contact details</li><li>Passenger and luggage count</li><li>Final destination and requested vehicle</li></ul></section>`
  }
];

const companyPages = [
  { slug: "about", title: "About Prestige Luxor | LA & OC Exotic Car Rentals", description: "Learn how Prestige Luxor approaches delivery-only exotic car rentals, client approval, and concierge service in LA and Orange County.", eyebrow: "About Prestige Luxor", heading: "The car is only part of the experience.", lead: "Prestige Luxor brings together distinctive vehicles, direct booking support, and planned delivery for private clients, events, brands, and productions.", content: `<section><h2>What we do</h2><p>We are a delivery-only service with no customer-facing storefront. We help clients find and reserve exotic cars, luxury SUVs, convertibles, and performance vehicles for approved addresses across Los Angeles and Orange County.</p></section><section><h2>How we work</h2><p>Every request is reviewed for vehicle availability, driver requirements, dates, mileage, delivery access, and the intended experience. Our public fleet reflects vehicles marked active in the inventory system. A quote is not a guaranteed reservation until the vehicle, driver, documents, deposit, agreement, and payment details are approved.</p></section><section><h2>Talk with the team</h2><p>Call or text ${phoneLabel}, or email Contact@prestigeluxor.com with the vehicle, date, and delivery area you have in mind.</p></section>` },
  { slug: "rental-policies", title: "Rental Policies | Prestige Luxor", description: "Review the general driver, insurance, deposit, mileage, delivery, cancellation, and vehicle-use policies for Prestige Luxor rentals.", eyebrow: "Before You Book", heading: "Rental policies and requirements.", lead: "These general guidelines help you prepare. Your signed rental agreement and confirmed quote control the final terms for a specific booking.", content: `<section><h2>Driver approval</h2><ul><li>A valid driver’s license is required.</li><li>Proof of insurance or other approved coverage may be required.</li><li>Age, driving history, and additional-driver rules vary by vehicle.</li></ul></section><section><h2>Deposit, payment, and agreement</h2><p>A security deposit, signed agreement, and confirmed payment arrangement may be required before the scheduled delivery. Deposit amounts and release timing vary by vehicle and booking.</p></section><section><h2>Delivery-only service</h2><p>Prestige Luxor does not operate a customer-facing rental counter or storefront. Every approved booking includes a confirmed delivery and return plan for an eligible address. Access, timing, distance, and delivery fees vary by location.</p></section><section><h2>Mileage and vehicle use</h2><p>Your quote should identify included mileage and any additional-mileage rate. Track use, racing, reckless driving, smoking, unauthorized drivers, illegal activity, subleasing, and travel outside approved areas are prohibited unless explicitly authorized in writing.</p></section><section><h2>Fuel, damage, and cancellations</h2><p>Return condition, fuel or charge level, tolls, tickets, cleaning, damage, late returns, cancellation, and rescheduling terms are confirmed in the rental agreement.</p></section>` },
  { slug: "privacy", title: "Privacy Policy | Prestige Luxor", description: "Read how Prestige Luxor handles information submitted through quote requests, partner applications, calls, texts, email, and website usage.", eyebrow: "Privacy", heading: "Privacy policy.", lead: "This policy explains the information we may receive and how it may be used when you contact Prestige Luxor or use this website.", content: `<section><h2>Information you provide</h2><p>We may receive contact details, requested dates, vehicle preferences, delivery information, event details, partner-vehicle information, and messages you submit. Driver’s-license, insurance, payment, and agreement information may be requested later through an approved booking process.</p></section><section><h2>How information is used</h2><p>Information may be used to respond, verify availability, evaluate eligibility, prepare quotes, coordinate bookings, prevent fraud, meet legal obligations, and improve service. We do not claim to sell personal information.</p></section><section><h2>Service providers and retention</h2><p>Information may be processed by hosting, database, communications, analytics, payment, insurance, verification, or booking providers as needed. Records may be retained for operational, security, dispute, tax, insurance, and legal purposes.</p></section><section><h2>Your choices</h2><p>To ask about your information or request a correction or deletion where applicable, email Contact@prestigeluxor.com. Do not send sensitive identity or payment information through an unsecured website message.</p></section>` },
  { slug: "terms", title: "Website Terms | Prestige Luxor", description: "Review the website terms, quote limitations, availability notices, and acceptable-use rules for Prestige Luxor.", eyebrow: "Website Terms", heading: "Terms of use.", lead: "By using this website, you agree to these website terms. A separate signed agreement governs any approved vehicle rental.", content: `<section><h2>Website information and quotes</h2><p>Vehicle descriptions, photos, rates, promotions, and availability may change. Online rates are starting points unless expressly confirmed. A submitted form, call, text, or email does not create a reservation.</p></section><section><h2>Rental approval</h2><p>All rentals remain subject to vehicle availability, driver approval, insurance or coverage requirements, deposit, payment, identity verification, and a signed agreement.</p></section><section><h2>Acceptable use and ownership</h2><p>Do not misuse the website, attempt unauthorized access, interfere with service, scrape protected information, impersonate another person, or submit unlawful content. Website branding, design, copy, and owned media remain protected by applicable intellectual-property laws.</p></section><section><h2>Limitations and updates</h2><p>The website is provided on an “as available” basis to the extent permitted by law. These terms may be updated as the business and services change. Contact Contact@prestigeluxor.com with questions.</p></section>` }
];

const locationsDir = join(outDir, "locations");
mkdirSync(locationsDir, { recursive: true });
for (const page of locationPages) {
  const pageOptions = {
    ...page,
    path: `locations/${page.slug}`,
    content: `${page.content}${locationEnhancements(page, { includeFleet: page.slug !== "orange-county-exotic-car-rental" })}`,
  };
  const html = page.slug === "orange-county-exotic-car-rental"
    ? orangeCountyPage(pageOptions)
    : pageShell({ ...pageOptions, eyebrow: "Prestige Luxor Service Area", schemaType: "Service" });
  writeFileSync(join(locationsDir, `${page.slug}.html`), html);
}
for (const page of companyPages) {
  writeFileSync(join(outDir, `${page.slug}.html`), pageShell({ ...page, path: page.slug }));
}

if (existsSync(carDir)) {
  for (const file of readdirSync(carDir).filter((name) => name.endsWith(".html"))) {
    const filePath = join(carDir, file);
    const slug = file.replace(/\.html$/, "");
    let html = readFileSync(filePath, "utf8");
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] || "Exotic Car Rental | Prestige Luxor";
    const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] || "View this exotic rental car from Prestige Luxor in Los Angeles and Orange County.";
    const imagePath = `assets/fleet/${slug}.jpg`;
    const activeCar = activeInventoryBySlug.get(slug);
    const isActive = Boolean(activeCar);
    const absoluteUrl = (value) => {
      if (!value) return "";
      if (/^https?:\/\//i.test(value)) return value;
      return `${siteUrl}/${String(value).replace(/^\//, "")}`;
    };
    const vehicleImages = isActive
      ? [...new Set([...(activeCar.car_photos || []).sort((a, b) => Number(a.position) - Number(b.position)).map(({ url }) => absoluteUrl(url)), absoluteUrl(activeCar.image_url)].filter(Boolean))]
      : [];
    const imageUrl = vehicleImages[0] || (existsSync(join(root, imagePath)) ? `${siteUrl}/${imagePath}` : `${siteUrl}/assets/prestige-luxor-hero.png`);
    const vehicleYear = String(activeCar?.name || "").match(/^\d{4}/)?.[0] || "";
    const vehicleSchema = isActive ? {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": ["Product", "Vehicle"],
          "@id": `${siteUrl}/cars/${slug}#vehicle`,
          name: activeCar.name,
          description: activeCar.summary || description,
          url: `${siteUrl}/cars/${slug}`,
          image: vehicleImages.length ? vehicleImages : [imageUrl],
          sku: activeCar.id || slug,
          brand: { "@type": "Brand", name: activeCar.make },
          model: activeCar.model,
          category: activeCar.category_label || activeCar.category,
          ...(vehicleYear ? { vehicleModelDate: vehicleYear } : {}),
          ...(activeCar.color ? { color: activeCar.color } : {}),
          ...(activeCar.seats ? { vehicleSeatingCapacity: Number(activeCar.seats) } : {}),
          additionalProperty: [
            ...(activeCar.mileage ? [{ "@type": "PropertyValue", name: "Included mileage", value: activeCar.mileage }] : []),
            { "@type": "PropertyValue", name: "Service area", value: "Los Angeles and Orange County" },
          ],
          offers: {
            "@type": "Offer",
            url: `${siteUrl}/cars/${slug}`,
            price: Number(activeCar.price),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
            seller: { "@id": `${siteUrl}/#business` },
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: Number(activeCar.price),
              priceCurrency: "USD",
              unitText: "DAY",
            },
          },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
            { "@type": "ListItem", position: 2, name: "Fleet", item: `${siteUrl}/fleet` },
            { "@type": "ListItem", position: 3, name: activeCar.name, item: `${siteUrl}/cars/${slug}` },
          ],
        },
      ],
    } : null;
    html = html
      .replace(/\/src\/vehicle\.js\?v=[^\"]+/g, "/src/vehicle.js?v=fleet-images-20260818")
      .replace(/\/src\/styles\.css\?v=[^\"]+/g, "/src/styles.css?v=site-theme-20260719")
      .replace(/<body class="(?!site-theme )/, '<body class="site-theme ');
    const metadata = `
    <link rel="canonical" href="${siteUrl}/cars/${slug}" />
    <meta name="robots" content="${isActive ? "index, follow" : "noindex, follow"}" data-inventory-indexing />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prestige Luxor" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${siteUrl}/cars/${slug}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${vehicleSchema ? `<script type="application/ld+json">${escapeJson(vehicleSchema)}</script>` : ""}`;
    html = html.replace("</head>", `${metadata}\n  </head>`);
    writeFileSync(filePath, html);
  }
}

const vercelObservability = `
    <script type="module" src="/src/site-analytics.js?v=conversion-tracking-20260823"></script>
    <script defer src="/_vercel/insights/script.js" data-sdkn="@vercel/analytics"></script>
    <script defer src="/_vercel/speed-insights/script.js" data-sdkn="@vercel/speed-insights"></script>`;

const googleAdsTag = `    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18413260632"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'AW-18413260632');
    </script>`;

function injectGoogleAdsTag(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      injectGoogleAdsTag(entryPath);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;

    const html = readFileSync(entryPath, "utf8");
    if (html.includes("AW-18413260632")) continue;
    writeFileSync(entryPath, html.replace(/<head([^>]*)>/i, (head) => `${head}\n${googleAdsTag}`));
  }
}

function injectVercelObservability(directory, relativePath = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryRelativePath = join(relativePath, entry.name);
    if (entry.isDirectory()) {
      if (entryRelativePath === "admin") continue;
      injectVercelObservability(join(directory, entry.name), entryRelativePath);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;
    const filePath = join(directory, entry.name);
    const html = readFileSync(filePath, "utf8");
    if (html.includes("/_vercel/insights/script.js")) continue;
    writeFileSync(filePath, html.replace("</body>", `${vercelObservability}\n  </body>`));
  }
}

function localModuleGraph(scriptPaths) {
  const collected = new Set();
  const visit = (filePath) => {
    const normalized = resolve(filePath);
    if (collected.has(normalized) || !normalized.startsWith(resolve(outDir)) || !existsSync(normalized)) return;
    collected.add(normalized);
    const source = readFileSync(normalized, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
      const specifier = match[1].split("?")[0];
      if (!specifier.startsWith(".")) continue;
      visit(resolve(dirname(normalized), specifier));
    }
  };
  scriptPaths.forEach(visit);
  return [...collected];
}

async function inlinePublicPageStyles(directory, relativePath = "", cache = new Map()) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryRelativePath = join(relativePath, entry.name);
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entryRelativePath === "admin") continue;
      await inlinePublicPageStyles(entryPath, entryRelativePath, cache);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;

    const html = readFileSync(entryPath, "utf8");
    const stylesheetLinks = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="(\/src\/[^"?]+\.css)(?:\?[^\"]*)?"\s*\/?>/g)];
    if (!stylesheetLinks.length) continue;
    const cssPaths = [...new Set(stylesheetLinks.map(([, href]) => join(outDir, href.replace(/^\//, ""))).filter(existsSync))];
    const directScripts = [...html.matchAll(/<script\s+type="module"\s+src="(\/src\/[^"?]+\.js)(?:\?[^\"]*)?"[^>]*><\/script>/g)]
      .map(([, href]) => join(outDir, href.replace(/^\//, "")))
      .filter(existsSync);
    const scriptPaths = localModuleGraph(directScripts);
    const selectorSignature = [
      ...html.matchAll(/(?:class|id)="([^"]+)"/g),
    ].flatMap((match) => match[1].split(/\s+/)).filter(Boolean).sort().join("|");
    const cacheKey = `${cssPaths.join("|")}::${scriptPaths.join("|")}::${selectorSignature}`;
    let optimizedCss = cache.get(cacheKey);

    if (!optimizedCss) {
      const purged = await new PurgeCSS().purge({
        content: [{ raw: html, extension: "html" }, ...scriptPaths],
        css: cssPaths,
        fontFace: true,
        keyframes: true,
        safelist: {
          standard: ["reveal", "revealed", "active", "selected", "hidden", "visible"],
          greedy: [/(^|-)is-/, /(^|-)has-/, /(^|-)open/, /(^|-)loading/, /(^|-)loaded/, /(^|-)success/, /(^|-)error/],
        },
      });
      const combinedCss = purged.map(({ css }) => css).join("\n");
      optimizedCss = Buffer.from(transform({ filename: entry.name, code: Buffer.from(combinedCss), minify: true }).code).toString("utf8");
      cache.set(cacheKey, optimizedCss);
    }

    let inserted = false;
    const withoutRedundantPreloads = html.replace(/\s*<link\s+rel="preload"\s+href="(\/src\/[^"?]+\.css)(?:\?[^\"]*)?"\s+as="style"\s*\/?>/g, "");
    const optimizedHtml = withoutRedundantPreloads.replace(/<link\s+rel="stylesheet"\s+href="\/src\/[^"?]+\.css(?:\?[^\"]*)?"\s*\/?>/g, () => {
      if (inserted) return "";
      inserted = true;
      return `<style data-page-styles>${optimizedCss}</style>`;
    });
    writeFileSync(entryPath, optimizedHtml);
  }
}

injectGoogleAdsTag(outDir);
injectVercelObservability(outDir);
await inlinePublicPageStyles(outDir);

writeFileSync(
  join(outDir, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
);

const sitemapPages = [
  "",
  "fleet",
  "lamborghini",
  "ferrari",
  "exotic-car-rental",
  "faq",
  "partner",
  "wedding",
  ...companyPages.map(({ slug }) => slug),
  ...locationPages.map(({ slug }) => `locations/${slug}`),
];
const sitemapVehicles = activeInventory.filter(({ slug }) => existsSync(join(carDir, `${slug}.html`)));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPages.map((page) => `  <url><loc>${siteUrl}/${page}</loc></url>`).join("\n")}
${sitemapVehicles
  .map(({ slug, updated_at: updatedAt }) => {
    const lastmod = updatedAt ? `<lastmod>${String(updatedAt).slice(0, 10)}</lastmod>` : "";
    return `  <url><loc>${siteUrl}/cars/${slug}</loc>${lastmod}</url>`;
  })
  .join("\n")}
</urlset>\n`;
writeFileSync(join(outDir, "sitemap.xml"), sitemap);

console.log(`Static site copied to dist/ with ${sitemapVehicles.length} indexable inventory pages.`);
