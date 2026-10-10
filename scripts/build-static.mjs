import { applySiteChrome } from '../src/site-chrome.js';
import { refineDestinationPage } from './destination-pages.mjs';
import { mapCar, optimizedFleetImageUrl, fleetPictureMarkup } from '../src/supabase-fleet.js';
import { parseHTML } from 'linkedom';
import { applySearchMetadata, sitemapXml, vehicleEntity } from '../src/search-metadata.js';
import { renderPrivateDocument } from '../src/private-render.js';
import { renderPublicDocument } from '../src/public-render.js';
import { loadPublicInventory, inventoryMonth } from '../src/public-inventory.js';
import { homeFleetCard, sortHomeFleet } from "../src/home-fleet-model.js";
import { rentalGuides } from "./rental-guides.mjs";
import { vehicleShellMarkup } from "../src/vehicle-shell.js";
import { vehicleYear as getVehicleYear, vehicleDisplayName, bodyTypeForVehicle, seatsForVehicle, engineForVehicle, accelerationForVehicle } from "../src/vehicle-content.js";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PurgeCSS } from "purgecss";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../src/supabase-config.js";
import {
  publicVehicleDetails,
  publicVehicleSummary,
  publicVehicleTags,
  vehicleFaqItems,
  vehicleSeoDescription,
  vehicleSeoSectionMarkup,
  vehicleSeoTitle,
} from "../src/vehicle-content.js";

const root = process.cwd();
const outDir = join(root, "dist");
let transformCss = ({ code }) => ({ code });
try {
  ({ transform: transformCss } = await import("lightningcss"));
} catch (error) {
  console.warn(`Lightning CSS unavailable; continuing without CSS minification (${error.code || error.message}).`);
}

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
  "src"
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
    "src/site-chrome.js",
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

  const optimized = transformCss({
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
  if (process.env.FLEET_PREVIEW_FILE) {
    if (process.env.VERCEL) throw new Error("Draft inventory previews cannot run on Vercel.");
    return JSON.parse(readFileSync(resolve(process.env.FLEET_PREVIEW_FILE), "utf8"));
  }
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
  const gallery = photos.map((photo) => photo.url).filter(Boolean);
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
    summary: publicVehicleSummary(car),
    image,
    image_url: image,
    gallery: gallery.length ? gallery : [image],
    tags: publicVehicleTags(car),
    details: publicVehicleDetails(car),
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
const formatUsd = (value) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

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

function pageShell({ title, description, path, eyebrow, heading, lead, content, schemaType = "WebPage", area = "", collection = [] }) {
  const canonical = `${siteUrl}/${path}`;
  const isLocationPage = path.startsWith("locations/");
  const isGuide = path === "guides" || path.startsWith("guides/");
  const pageEntity = {
    "@type": schemaType,
    ...(schemaType === "Article" ? { headline: heading, author: { "@type": "Organization", name: "Prestige Luxor", url: `${siteUrl}/about` }, datePublished: "2026-10-08", mainEntityOfPage: canonical } : {}),
    name: heading,
    description,
    url: canonical,
    ...(isLocationPage ? { provider: { "@id": `${siteUrl}/#business` } } : { publisher: { "@id": `${siteUrl}/#business` } }),
    ...(collection.length ? { mainEntity: { "@type": "ItemList", itemListElement: collection.map((car, index) => ({ "@type": "ListItem", position: index + 1, name: car.name, url: `${siteUrl}/cars/${car.slug}` })) } } : {}),
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
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#070606" />
    <title>${title}</title>
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prestige Luxor" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
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
  <body class="site-theme site-content-page${isGuide ? " rental-guide-page" : ""}">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header scrolled" data-header>
      <a class="brand" href="/" aria-label="Prestige Luxor home"><img class="brand-logo brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" /></a>
      <nav class="desktop-nav" aria-label="Primary navigation"><a href="/fleet.html">Fleet</a><a href="/partner.html">Consignment</a></nav>
      <div class="header-actions"><a class="ghost-button" href="tel:${phoneHref}">Call</a><a class="primary-button compact" href="${isLocationPage ? "#location-quote" : "/#quote"}">Reserve</a></div>
      <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-toggle><span></span><span></span></button>
    </header>
    <div class="mobile-menu" data-mobile-menu><a href="/fleet.html">Fleet</a><a href="/partner.html">Consignment</a><a href="tel:${phoneHref}">Call</a><a href="${isLocationPage ? "#location-quote" : "/#quote"}">Reserve</a></div>
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
      <div class="footer-main"><a class="brand footer-brand" href="/" aria-label="Prestige Luxor home"><span class="footer-logo-frame"><img class="brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" loading="lazy" /></span></a><p>Exotic and luxury car rentals with concierge delivery across Southern California.</p><div class="footer-contact"><a href="tel:${phoneHref}">Call ${phoneLabel}</a><a href="sms:${phoneHref}">Text concierge</a><a href="mailto:Contact@prestigeluxor.com">Email</a></div></div>
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
    "lamborghini-huracan-evo-spyder-rental",
    "ferrari-f8-tributo-rental",
    "lamborghini-urus-s-rental",
  ];
  const featuredCars = preferredSlugs
    .map((slug) => activeInventoryBySlug.get(slug))
    .filter(Boolean);

  for (const car of activeInventory) {
    if (featuredCars.length >= 3) break;
    if (!featuredCars.some((featured) => featured.slug === car.slug)) featuredCars.push(car);
  }

  const heroCar = featuredCars[0];
  const heroImage = heroCar ? optimizedFleetImageUrl(publicCarOriginalImage(heroCar), { width: 1800, height: 1200, quality: 85, updatedAt: heroCar.updated_at }) : "/assets/optimized/prestige-luxor-hero.webp";
  const heroImageSrcset = "";
  const heroImagePreconnect = heroImage.startsWith("https://")
    ? `<link rel="preconnect" href="${new URL(heroImage).origin}" crossorigin />`
    : "";
  const fleetCards = featuredCars.map((car) => `
          <article class="oc-showroom-card">
            <a class="oc-showroom-media" href="/cars/${car.slug}" aria-label="View ${car.make} ${car.model}">
              ${fleetPictureMarkup(publicCarOriginalImage(car), { alt: `${car.make} ${car.model} available from Prestige Luxor`, width: 1200, height: 900, loading: "lazy", updatedAt: car.updated_at })}
            </a>
            <div class="oc-showroom-card-copy">
              <div>
                <span>${escapeHtml(car.make)}</span>
                <h3>${escapeHtml(car.model)}</h3>
              </div>
              <p>From <strong>$${Number(car.price).toLocaleString("en-US")}</strong>/day</p>
            </div>
            <p class="oc-car-rental-facts">${escapeHtml(seatsForVehicle(car))} · ${escapeHtml(car.mileage || "Mileage confirmed by quote")}</p>
            <a class="oc-showroom-link" href="/cars/${car.slug}"><span>Photos &amp; rental details</span><span aria-hidden="true">&#8599;</span></a>
            <a class="oc-showroom-link" href="#location-quote" data-location-vehicle="${escapeHtml(car.name)}"><span>Request this car in Orange County</span><span aria-hidden="true">→</span></a>
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
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#080808" />
    ${heroImagePreconnect}
    <title>${title}</title>
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prestige Luxor" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${heroImage.startsWith("http") ? heroImage : `${siteUrl}${heroImage}`}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${escapeJson(schema)}</script>
    <link rel="icon" type="image/png" sizes="48x48" href="/assets/prestige-luxor-favicon-48.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/prestige-luxor-favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/prestige-luxor-favicon-16.png" />
    <link rel="apple-touch-icon" href="/assets/prestige-luxor-apple-touch-icon.png?v=prestige-luxor-20260806" />
  <link rel="stylesheet" href="/src/styles.css?v=site-theme-20260719" />
    <link rel="stylesheet" href="/src/orange-county.css" />
  </head>
  <body class="site-theme fleet-page oc-location-page">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header scrolled" data-header>
      <a class="brand" href="/" aria-label="Prestige Luxor home"><img class="brand-logo brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" /></a>
      <nav class="desktop-nav" aria-label="Primary navigation"><a href="/fleet.html">Fleet</a><a href="/partner.html">Consignment</a></nav>
      <div class="header-actions"><a class="ghost-button" href="tel:${phoneHref}">Call</a><a class="primary-button compact" href="#location-quote">Reserve</a></div>
      <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-toggle><span></span><span></span></button>
    </header>
    <div class="mobile-menu" data-mobile-menu><a href="/fleet.html">Fleet</a><a href="/partner.html">Consignment</a><a href="tel:${phoneHref}">Call</a><a href="#location-quote">Reserve</a></div>

    <main id="main" class="oc-location-main">
      <section class="oc-location-hero" aria-labelledby="oc-location-title">
        <picture class="native-picture"><source srcset="${heroImageSrcset || heroImage}" sizes="100vw" /><img class="oc-location-hero-media" src="${escapeHtml(heroCar ? publicCarOriginalImage(heroCar) : "/assets/prestige-luxor-hero.png")}" alt="${heroCar ? `${heroCar.make} ${heroCar.model}` : "Exotic car"} available for Orange County delivery" width="1600" height="1067" fetchpriority="high" decoding="async" /></picture>
        <div class="oc-location-hero-scrim" aria-hidden="true"></div>
        <div class="oc-location-hero-content">
          <p class="oc-location-kicker">Orange County exotic car rental</p>
          <h1 id="oc-location-title">Exotic car rental.<br /><em>Orange County.</em></h1>
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
          <div><p>Compare listed vehicles</p><h2 id="oc-fleet-title">Find your Orange County drive.</h2></div>
          <a href="/fleet.html">View the full fleet <span aria-hidden="true">&#8594;</span></a>
        </header>
        <div class="oc-showroom-grid">${fleetCards}</div>
      </section>

      <section class="rental-planning-section oc-rental-planning" aria-labelledby="oc-rental-planning-title">
        <p class="eyebrow">Choose around your itinerary</p>
        <h2 id="oc-rental-planning-title">From the coast to your next occasion.</h2>
        <div class="rental-planning-columns">
          <div><h3>Newport Beach &amp; coastal stays</h3><p>Compare a two-seat convertible with a luxury SUV based on passengers and bags. Share the hotel or residence address, parking access and planned route so delivery and mileage can be quoted together.</p><p><a href="/locations/newport-beach-exotic-car-rental">Newport Beach delivery details</a></p></div>
          <div><h3>Irvine &amp; Anaheim plans</h3><p>For a business stay, celebration or hotel handoff, include pickup and return times plus any venue access instructions. Delivery is arranged for your booking; these cities are service areas, not walk-in branches.</p><p><a href="/wedding">Wedding car planning</a></p></div>
          <div><h3>John Wayne Airport arrivals</h3><p>Share your flight timing, passenger count and luggage dimensions. We confirm an eligible meeting point and any delivery charge. A terminal-curbside handoff is not assumed.</p><p><a href="/locations/sna-exotic-car-delivery">SNA delivery arrangements</a></p></div>
        </div>
        <h3>Compare the total, not just the daily rate</h3>
        <p>Displayed prices are starting daily rates. Request the same dates and delivery address for each car, then compare included mileage, excess-mile charges, rental duration, applicable fees and the separate deposit hold. Ask about minimum rental length for your selected vehicle and dates.</p>
        <p><a href="/guides/lamborghini-rental-cost-southern-california">Lamborghini pricing guide</a> · <a href="/rental-policies">Driver, insurance and rental requirements</a></p>
      </section>

      <section class="oc-location-service" aria-labelledby="oc-service-title">
        <div class="oc-service-intro">
          <p>Three steps. No rental counter.</p>
          <h2 id="oc-service-title">A great drive starts here.</h2>
        </div>
        <div class="oc-service-steps">
          <article><span>01</span><h3>Choose the car</h3><p>Send the vehicle, date, and driver details.</p></article>
          <article><span>02</span><h3>Get approved</h3><p>We confirm availability, insurance, deposit, mileage, and delivery.</p></article>
          <article><span>03</span><h3>Take the keys</h3><p>Meet your vehicle at the confirmed handoff.</p></article>
        </div>
      </section>

      ${locationEnhancements({ slug: "orange-county-exotic-car-rental", area: "Orange County" }, { includeFleet: false })}

      <section class="oc-location-final" aria-labelledby="oc-final-title">
        <p>10% off for first-time clients</p>
        <h2 id="oc-final-title">Your first drive, thoughtfully arranged.</h2>
        <div><a class="oc-location-primary" href="#location-quote">Request a quote</a><a class="oc-location-secondary" href="tel:${phoneHref}">Call ${phoneLabel}</a></div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="footer-main"><a class="brand footer-brand" href="/" aria-label="Prestige Luxor home"><span class="footer-logo-frame"><img class="brand-logo-wide" src="/assets/prestige-luxor-logo-light.png" alt="Prestige Luxor" width="1684" height="315" loading="lazy" /></span></a><p>Exotic and luxury car rentals with concierge delivery across Southern California.</p><div class="footer-contact"><a href="tel:${phoneHref}">Call ${phoneLabel}</a><a href="sms:${phoneHref}">Text concierge</a><a href="mailto:Contact@prestigeluxor.com">Email</a></div></div>
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
    slug: "irvine-exotic-car-rental", area: "Irvine",
    title: "Exotic & Luxury Car Rental Irvine | Prestige Luxor",
    description: "Request an exotic or luxury car rental in Irvine. Compare the active fleet and plan hotel, residence or business-address delivery with Prestige Luxor.",
    heading: "Exotic and luxury car rental in Irvine.",
    lead: "Choose a car for an Irvine business stay, celebration or Orange County weekend, with the exact vehicle and delivery address confirmed before booking.",
    content: `<section><h2>Plan around your Irvine stay</h2><p>For meetings or a hotel stay near the Irvine Business Complex, consider passengers, luggage and parking access before choosing between a sports car and a luxury SUV. Tell us your hotel or business address and the time you need the vehicle. Property access and permission for the handoff are confirmed separately; no hotel partnership is implied.</p></section><section><h2>Arriving through John Wayne Airport</h2><p>If you are flying into SNA, send flight details and your onward Irvine address. The concierge will confirm a permitted meeting location and delivery window. Airport terminal pickup is not assumed. Read our <a href="/locations/sna-exotic-car-delivery">SNA delivery guide</a> for the information to include.</p></section><section><h2>Coastal trips and return arrangements</h2><p>Planning time in Newport Beach or another Orange County city? Share the route and return address so your quote can account for the listed mileage allowance and delivery arrangements. Additional mileage is $5 per mile. Confirm the total with your concierge before accepting the quote.</p><p>Compare <a href="/locations/newport-beach-exotic-car-rental">Newport Beach rentals</a>, <a href="/locations/orange-county-exotic-car-rental">Orange County delivery</a> and the <a href="/rental-policies">driver and insurance requirements</a>.</p></section>`
  },
  {
    slug: "riverside-county-exotic-car-rental", area: "Riverside County",
    title: "Riverside County Exotic Car Rental | Prestige Luxor",
    description: "Request exotic or luxury car delivery in Riverside County. Share your address, dates and itinerary for confirmed vehicle availability and delivery pricing.",
    heading: "Exotic car rental requests in Riverside County.",
    lead: "From a Palm Springs resort stay to a private event elsewhere in Riverside County, send the exact address and dates so we can confirm whether delivery works for your booking.",
    content: `<section><h2>Confirm the address before planning the handoff</h2><p>Riverside County covers a wide area. A request in Riverside, Temecula or the Coachella Valley can involve different travel distances and delivery windows. We confirm coverage for your exact address, selected vehicle and dates rather than promising every location or same-day delivery.</p></section><section><h2>Palm Springs and the desert communities</h2><p>For resort stays and celebrations in Palm Springs, Palm Desert or Rancho Mirage, provide the property name, parking access and preferred arrival window. Review our <a href="/locations/palm-springs-exotic-car-rental">Palm Springs rental page</a> for desert-stay planning. A luxury SUV and a two-seat convertible offer different passenger and luggage options; check the exact listing.</p></section><section><h2>Events and longer itineraries</h2><p>For a wedding or private event, include the venue, arrival time, photography schedule and return address. Venue permission and any special access arrangements need confirmation. If the trip starts in Los Angeles or Orange County, share the complete route and expected mileage.</p><p>Your quote confirms the vehicle, included mileage, additional mileage at $5 per mile, delivery charges and security-deposit hold starting from $1,000. Read our <a href="/wedding">wedding rental information</a> and <a href="/rental-policies">rental requirements</a> before requesting dates.</p></section>`
  },
  {
    slug: "san-diego-exotic-car-rental", area: "San Diego",
    title: "Exotic & Luxury Car Rental San Diego | Prestige Luxor",
    description: "Explore exotic and luxury car rentals for San Diego, La Jolla and Coronado. Request vehicle availability, mileage and a confirmed delivery quote.",
    heading: "Exotic car rental in San Diego.",
    lead: "Plan a coastal weekend, hotel stay or special arrival with a vehicle delivered to an agreed San Diego address.",
    content: `<section><h2>Choose for your San Diego itinerary</h2><p>A convertible suits a coastal drive through La Jolla, while a luxury SUV offers more room for passengers and luggage. Compare the actual vehicle specifications and included mileage before choosing your car.</p></section><section><h2>Delivery to hotels, residences and events</h2><p>We serve Southern California, including San Diego, La Jolla, Del Mar and Coronado. Send your dates, exact address, parking access and preferred handoff window. Longer-distance delivery, return arrangements and any fees are confirmed in your quote.</p><p>For airport arrivals, include your flight details and destination. The team will agree on a practical meeting location; terminal delivery is not assumed.</p></section><section><h2>Planning a multi-city trip</h2><p>Traveling between San Diego, Orange County and Los Angeles? Share the route and return address so we can confirm mileage and logistics. View our <a href="/locations/orange-county-exotic-car-rental">Orange County delivery options</a> and <a href="/rental-policies">rental requirements</a>.</p></section>`
  },
  {
    slug: "palm-springs-exotic-car-rental", area: "Palm Springs",
    title: "Exotic & Luxury Car Rental Palm Springs | Prestige Luxor",
    description: "Request an exotic or luxury car rental in Palm Springs, Palm Desert or Rancho Mirage with confirmed delivery, vehicle availability and mileage.",
    heading: "Exotic car rental in Palm Springs.",
    lead: "Choose a vehicle for a desert resort stay, wedding or weekend escape, with delivery and return planned around your itinerary.",
    content: `<section><h2>A car for your desert stay</h2><p>Compare convertibles, performance cars and luxury SUVs for Palm Springs and the surrounding desert communities. Consider passengers, luggage and daytime comfort alongside the look of the vehicle.</p></section><section><h2>Resort and private-address delivery</h2><p>Request delivery to Palm Springs, Palm Desert, Rancho Mirage or Indian Wells. Include your resort or residence address, valet instructions and arrival window. Availability, delivery fees and the return location are confirmed before booking.</p></section><section><h2>Weddings and busy event weekends</h2><p>Send the exact dates and venue early for event requests. Rates and vehicle availability depend on the booking dates. For a ceremony or photo session, share the timing and access requirements with your request. Explore our <a href="/wedding">wedding car rentals</a>.</p></section><section><h2>Confirm the full driving plan</h2><p>Tell us if you are arriving from Los Angeles or Orange County, and whether you need a different return address. Your quote confirms the approved route, included mileage and delivery arrangements. Review our <a href="/rental-policies">rental policies</a> before requesting dates.</p></section>`
  },

  {
    slug: "los-angeles-exotic-car-rental",
    area: "Los Angeles",
    title: "Luxury & Exotic Car Rental Los Angeles | Prestige Luxor",
    description: "Rent an exotic or luxury car in Los Angeles with concierge delivery, flexible booking, and a curated fleet from Prestige Luxor.",
    heading: "Exotic car rental in Los Angeles.",
    lead: "From a weekend in West Hollywood to a production day downtown, Prestige Luxor coordinates the vehicle, timing, and delivery details around your plans.",
    content: `<section><h2>Built around Los Angeles schedules</h2><p>Traffic, venue access, hotel loading zones, and production timing all matter here. Share your address, requested arrival window, dates, and preferred vehicle so our team can confirm a practical handoff plan before approval.</p></section><div class="seo-card-grid"><article class="seo-card"><h3>Private rentals</h3><p>Choose a supercar, convertible, performance sedan, or luxury SUV for personal travel and special occasions.</p></article><article class="seo-card"><h3>Events and content</h3><p>Ask about arrivals, brand activations, photography coordination, and vehicles for content production.</p></article><article class="seo-card"><h3>Concierge delivery</h3><p>Delivery is confirmed by location, schedule, vehicle availability, and access requirements.</p></article></div><section><h2>Popular Los Angeles requests</h2><ul><li>Beverly Hills and West Hollywood hotel delivery</li><li>Hollywood, Downtown LA, and event arrivals</li><li>Malibu day trips and coastal drives</li><li>LAX arrival coordination</li></ul></section>`
  },
  {
    slug: "orange-county-exotic-car-rental",
    area: "Orange County",
    title: "Exotic & Luxury Car Rental Orange County | Prestige Luxor",
    description: "Compare exotic and luxury car rental rates in Orange County. Explore Lamborghini, Ferrari and Rolls-Royce options with hotel, home and SNA delivery by arrangement.",
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
    title: "LAX Luxury & Exotic Car Rental Delivery | Prestige Luxor",
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

// Present the primary service areas before airport-specific delivery resources.
const locationPriority = ['orange-county-exotic-car-rental','los-angeles-exotic-car-rental','newport-beach-exotic-car-rental','beverly-hills-luxury-car-rental','irvine-exotic-car-rental','riverside-county-exotic-car-rental','san-diego-exotic-car-rental','palm-springs-exotic-car-rental','lax-exotic-car-delivery','sna-exotic-car-delivery'];
locationPages.sort((a,b)=>locationPriority.indexOf(a.slug)-locationPriority.indexOf(b.slug));

const companyPages = [
  { slug: "about", title: "About Prestige Luxor | LA & OC Exotic Car Rentals", description: "Learn how Prestige Luxor approaches delivery-only exotic car rentals, client approval, and concierge service in LA and Orange County.", eyebrow: "About Prestige Luxor", heading: "The car is only part of the experience.", lead: "Prestige Luxor brings together distinctive vehicles, direct booking support, and planned delivery for private clients, events, brands, and productions.", content: `<section><h2>What we do</h2><p>We are a delivery-only service with no customer-facing storefront. We help clients find and reserve exotic cars, luxury SUVs, convertibles, and performance vehicles in Southern California, including Orange County, Los Angeles, San Diego and Palm Springs. Riverside County requests are reviewed for the exact address, vehicle and schedule.</p></section><section><h2>How we work</h2><p>Every request is reviewed for vehicle availability, driver requirements, dates, mileage, delivery access, and the intended experience. Our public fleet reflects vehicles marked active in the inventory system. A quote is not a guaranteed reservation until the vehicle, driver, documents, deposit, agreement, and payment details are approved.</p></section><section><h2>Talk with the team</h2><p>Call or text <a href="tel:${phoneHref}">${phoneLabel}</a>, or email <a href="mailto:Contact@prestigeluxor.com">Contact@prestigeluxor.com</a> with the vehicle, date, and delivery area you have in mind. See our <a href="https://www.instagram.com/prestige.luxor/">official Instagram profile</a> and <a href="/#customer-care">customer experience video</a>.</p></section>` },
  { slug: "rental-policies", title: "Rental Policies | Prestige Luxor", description: "Review the general driver, insurance, deposit, mileage, delivery, cancellation, and vehicle-use policies for Prestige Luxor rentals.", eyebrow: "Before You Book", heading: "Rental policies and requirements.", lead: "These general guidelines help you prepare. Your signed rental agreement and confirmed quote control the final terms for a specific booking.", content: `<section><h2>Driver approval</h2><ul><li>A valid driver’s license is required.</li><li>Proof of full-coverage auto insurance is required before confirmation.</li><li>The minimum age starts at 18, subject to vehicle-specific approval, with at least one year of driving experience. Additional-driver rules are confirmed for each rental.</li></ul></section><section><h2>Deposit, payment, and agreement</h2><p>A security deposit, signed agreement, and confirmed payment arrangement may be required before the scheduled delivery. Security-deposit holds start at $1,000; the exact amount and release timing are confirmed for the vehicle and booking before payment.</p></section><section><h2>Delivery-only service</h2><p>Prestige Luxor does not operate a customer-facing rental counter or storefront. Every approved booking includes a confirmed delivery and return plan for an eligible address. Access, timing, distance, and delivery fees vary by location.</p></section><section><h2>Mileage and vehicle use</h2><p>The vehicle page lists its included mileage. Additional mileage is $5 per mile; your quote confirms the allowance and full charges. Track use, racing, reckless driving, smoking, unauthorized drivers, illegal activity, subleasing, and travel outside approved areas are prohibited unless explicitly authorized in writing.</p></section><section><h2>Fuel, damage, and cancellations</h2><p>Return condition, fuel or charge level, tolls, tickets, cleaning, damage, late returns, cancellation, and rescheduling terms are confirmed in the rental agreement.</p></section>` },
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
  let html = page.slug === "orange-county-exotic-car-rental"
    ? orangeCountyPage(pageOptions)
    : pageShell({ ...pageOptions, eyebrow: "Prestige Luxor Service Area", schemaType: "Service" });
  html = refineDestinationPage(html, page, activeInventory, locationEnhancements(page, { includeFleet: false }));
  writeFileSync(join(locationsDir, `${page.slug}.html`), html);
}
for (const page of companyPages) {
  writeFileSync(join(outDir, `${page.slug}.html`), pageShell({ ...page, path: page.slug }));
}

// New Supabase listings must receive a product page even without a checked-in HTML file.
mkdirSync(carDir, { recursive: true });
const vehiclePageTemplate = readFileSync(join(root, "scripts", "vehicle-page-template.html"), "utf8");
for (const car of activeInventory) {
  const target = join(carDir, `${car.slug}.html`);
  if (!existsSync(target)) writeFileSync(target, vehiclePageTemplate.replaceAll("__VEHICLE_SLUG__", car.slug));
}

if (existsSync(carDir)) {
  for (const file of readdirSync(carDir).filter((name) => name.endsWith(".html"))) {
    const filePath = join(carDir, file);
    const slug = file.replace(/\.html$/, "");
    let html = readFileSync(filePath, "utf8");
    const sourceTitle = html.match(/<title>(.*?)<\/title>/)?.[1] || "Exotic Car Rental | Prestige Luxor";
    const sourceDescription = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] || "View this exotic rental car from Prestige Luxor in Los Angeles and Orange County.";
    const imagePath = `assets/fleet/${slug}.jpg`;
    const activeCar = activeInventoryBySlug.get(slug);
    const isActive = Boolean(activeCar);
    const title = isActive ? vehicleSeoTitle(activeCar) : sourceTitle;
    const description = isActive ? vehicleSeoDescription(activeCar, formatUsd) : sourceDescription;
    const absoluteUrl = (value) => {
      if (!value) return "";
      if (/^https?:\/\//i.test(value)) return value;
      return `${siteUrl}/${String(value).replace(/^\//, "")}`;
    };
    const vehicleImages = isActive
      ? [...new Set([...(activeCar.car_photos || []).sort((a, b) => Number(a.position) - Number(b.position)).map(({ url }) => absoluteUrl(url)), absoluteUrl(activeCar.image_url)].filter(Boolean))]
      : [];
    const imageUrl = vehicleImages[0] || (existsSync(join(root, imagePath)) ? `${siteUrl}/${imagePath}` : `${siteUrl}/assets/prestige-luxor-hero.png`);
    const vehicleSchema = isActive ? { "@context": "https://schema.org", "@graph": [vehicleEntity(mapCar(activeCar))] } : null;
    html = html
      .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
      .replace(/\/src\/vehicle\.js\?v=[^\"]+/g, "/src/vehicle.js?v=product-images-20260901")
      .replace(/\/src\/styles\.css\?v=[^\"]+/g, "/src/styles.css?v=site-theme-20260719")
      .replace(/<body class="(?!site-theme )/, '<body class="site-theme ');
    if (isActive) {
      let shell = vehicleShellMarkup(vehicleSeoSectionMarkup(activeCar, { formatPrice: formatUsd, escapeHtml }));
      const facts = {
        year: getVehicleYear(activeCar), title: vehicleDisplayName(activeCar), category: activeCar.category_label || activeCar.category,
        price: `${formatUsd(activeCar.price)} / day`, seats: seatsForVehicle(activeCar),
        summary: publicVehicleSummary(activeCar), engine: engineForVehicle(activeCar),
        acceleration: accelerationForVehicle(activeCar), type: bodyTypeForVehicle(activeCar), color: activeCar.color || "Confirm exterior",
        mileage: activeCar.mileage ? activeCar.mileage : "Confirm included mileage",
        "mileage-short": activeCar.mileage || "Confirm",
      };
      for (const [key, value] of Object.entries(facts)) shell = shell.replace(new RegExp(`(data-vehicle-${key}>)[^<]*`, "g"), (_, prefix) => prefix + escapeHtml(value || "Confirm details"));
      shell = shell.replace('data-gallery-main alt=""', `data-gallery-main src="${escapeHtml(publicCarImage(activeCar, { width: 1200, height: 825, quality: 82 }))}" alt="${escapeHtml(activeCar.name)} rental vehicle"`)
        .replace('<ul data-vehicle-details></ul>', `<ul data-vehicle-details>${publicVehicleDetails(activeCar).map(detail => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`)
        .replace('name="vehicle" type="hidden"', `name="vehicle" type="hidden" value="${escapeHtml(activeCar.name)}"`);
      html = html.replace(/(<main[^>]*data-vehicle-page[^>]*>)[\s\S]*?<\/main>/, (_, opening) => `${opening}${shell}</main>`).replace(/ is-loading-vehicle/g, "");
    }
    if (vehicleSchema && slug === "2022-lamborghini-huracan") vehicleSchema["@graph"] = vehicleSchema["@graph"].filter(entity => entity["@type"] !== "FAQPage");
    const metadata = `
    <link rel="canonical" href="${siteUrl}/cars/${slug}" />
    <meta name="robots" content="${isActive ? "index, follow" : "noindex, follow"}" data-inventory-indexing />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prestige Luxor" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${siteUrl}/cars/${slug}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${vehicleSchema ? `<script type="application/ld+json">${escapeJson(vehicleSchema)}</script>` : ""}`;
    html = html.replace("</head>", `${metadata}\n  </head>`);
    writeFileSync(filePath, html);
  }
}

const vercelObservability = `
    <script type="module" src="/src/site-analytics.js?v=conversion-tracking-20260906"></script>
    <script defer src="/_vercel/insights/script.js" data-sdkn="@vercel/analytics"></script>
    <script defer src="/_vercel/speed-insights/script.js" data-sdkn="@vercel/speed-insights"></script>`;

const googleAdsTag = `    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18413260632"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'AW-18413260632');

      function gtag_report_lead_conversion(url) {
        var callback = function () {
          if (typeof(url) != 'undefined') {
            window.location = url;
          }
        };
        gtag('event', 'conversion', {
          'send_to': 'AW-18413260632/U4oyCOnQ2u8cENiekMxE',
          'value': 1.0,
          'currency': 'USD',
          'event_callback': callback
        });
        return false;
      }

      function gtag_report_call_conversion(url) {
        var navigated = false;
        var callback = function () {
          if (navigated) return;
          navigated = true;
          if (typeof(url) != 'undefined') {
            window.location = url;
          }
        };
        gtag('event', 'conversion', {
          'send_to': 'AW-18413260632/ooYTCITp2u8cENiekMxE',
          'value': 1.0,
          'currency': 'USD',
          'event_callback': callback
        });
        if (typeof(url) != 'undefined') {
          window.setTimeout(callback, 1000);
        }
        return false;
      }
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
      optimizedCss = Buffer.from(transformCss({ filename: entry.name, code: Buffer.from(combinedCss), minify: true }).code).toString("utf8");
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

const brandPages = [
  { slug: "porsche", name: "Porsche", cars: activeInventory.filter(car => /porsche/i.test(car.make)), copy: "Compare the available 911, Macan and Panamera models for your dates. Review the exact seating, daily rate and mileage on each vehicle page, then request a confirmed quote for your delivery address." },
  { slug: "rolls-royce", name: "Rolls-Royce", cars: activeInventory.filter(car => /rolls/i.test(car.make)), copy: "Explore the available Cullinan and Dawn for a resort stay, celebration or wedding arrival. Compare the actual vehicle details and request dates; driver requirements, delivery and any event arrangements are confirmed with your quote." },
].filter(page => page.cars.length);
function collectionCards(cars, variant = "collection") {
  return cars.map((car, index) => `<article class="showroom-card showroom-card-${variant}" data-vehicle-slug="${escapeHtml(car.slug)}"><a class="showroom-card-media" href="/cars/${car.slug}" aria-label="View ${escapeHtml(car.name)}" data-fleet-card-link data-vehicle="${escapeHtml(car.name)}" data-vehicle-slug="${car.slug}">${publicCarPicture(car, { alt: car.name, loading: index < 3 ? "eager" : "lazy" })}</a><div class="showroom-card-body"><div class="showroom-card-title"><span>${escapeHtml(car.make)}</span><h3>${escapeHtml(car.name)}</h3></div><strong>${formatUsd(car.price)}<small>/day</small></strong></div><a class="showroom-request" href="/cars/${car.slug}">View vehicle &amp; request dates</a></article>`).join("");
}
const guidePages = rentalGuides(activeInventory, { escapeHtml, formatUsd });
mkdirSync(join(outDir, "guides"), { recursive: true });
for (const page of guidePages) {
  writeFileSync(join(outDir, `${page.path}.html`), pageShell({ ...page, schemaType: "Article", eyebrow: "Prestige Luxor rental guides" }));
}
writeFileSync(join(outDir, "guides.html"), pageShell({ path: "guides", title: "Southern California Exotic Car Rental Guides | Prestige Luxor", heading: "Plan your Southern California rental.", eyebrow: "Rental guides", description: "Compare Lamborghini rental costs, choose between Huracán and Urus, and plan hotel or airport delivery with Prestige Luxor.", lead: "Practical answers using our published fleet and booking process. Compare options, understand the quote and plan your delivery before you reserve.", content: guidePages.map(page => `<section><h2><a href="/${page.path}">${escapeHtml(page.heading)}</a></h2><p>${escapeHtml(page.description)}</p><p><a href="/${page.path}">Read the guide →</a></p></section>`).join("") }));
const regionLinks = `<nav class="seo-delivery-nav" aria-label="Explore delivery areas and rental resources">
  <div class="seo-delivery-heading"><p>KEEP EXPLORING</p><h2>Southern California delivery.</h2></div>
  <div class="seo-delivery-columns">
    <section class="seo-delivery-areas" aria-label="Delivery areas"><h3>Find your destination</h3><ul>${locationPages.map(page => `<li><a href="/locations/${page.slug}">${escapeHtml(page.area)}<span aria-hidden="true">↗</span></a></li>`).join("")}</ul></section>
    <section aria-label="Car brands"><h3>Explore by make</h3><ul>${[{slug:'lamborghini',name:'Lamborghini'},{slug:'ferrari',name:'Ferrari'},...brandPages].map(page=>`<li><a href="/${page.slug}">${escapeHtml(page.name)}<span aria-hidden="true">↗</span></a></li>`).join('')}</ul></section>
    <section class="seo-delivery-guides" aria-label="Rental guides"><h3>Plan your drive</h3><p>Rental pricing, vehicle comparisons, and delivery guides.</p><a href="/guides">Explore the guides <span aria-hidden="true">↗</span></a></section>
  </div>
</nav>`;
for (const page of brandPages) {
  const html = pageShell({ path: page.slug, schemaType: "CollectionPage", collection: page.cars, title: `${page.name} Rental Los Angeles & Southern California | Prestige Luxor`, description: `Explore ${page.name} rentals with Prestige Luxor. Compare active vehicles, daily rates and delivery options across Southern California.`, eyebrow: `${page.name} collection`, heading: `${page.name} rentals in Southern California.`, lead: page.copy, content: `<section><h2>Explore available ${page.name} models</h2><div class="fleet-showroom-grid">${collectionCards(page.cars)}</div></section><section><h2>Delivery and rental requirements</h2><p>Delivery is available across Southern California, subject to the confirmed vehicle, dates and address. Your quote covers mileage, driver eligibility, insurance requirements, security deposit and any delivery fees. <a href="/rental-policies">Review rental policies</a>.</p></section>${regionLinks}` });
  writeFileSync(join(outDir, `${page.slug}.html`), html);
}
const homePath = join(outDir, "index.html");
writeFileSync(homePath, readFileSync(homePath, "utf8").replace('<div class="home-fleet-grid" data-home-fleet-grid></div>', `<div class="home-fleet-grid" data-home-fleet-grid>${sortHomeFleet(publicFleetSnapshot).slice(0,9).map(car => homeFleetCard(car, publicCarPicture(activeInventoryBySlug.get(car.slug), {alt:car.name}))).join("")}</div>`).replace('Browse the collection</p>', `${publicFleetSnapshot.length} cars · Showing ${Math.min(9,publicFleetSnapshot.length)}</p>`));
const fleetPath = join(outDir, "fleet.html");
writeFileSync(fleetPath, readFileSync(fleetPath, "utf8").replace('Choose the<br /><em>arrival.</em>', 'Exotic &amp; luxury<br /><em>car rentals.</em>').replace('<div class="fleet-showroom-grid" data-fleet-grid></div>', `<div class="fleet-showroom-grid" data-fleet-grid>${collectionCards(activeInventory)}</div>`).replace('<div class="fleet-popular-grid" data-popular-grid></div>', `<div class="fleet-popular-grid" data-popular-grid>${collectionCards(locationFeaturedCars(), "popular")}</div>`));
for (const brand of ["lamborghini", "ferrari"]) {
 const path = join(outDir, `${brand}.html`);
 let html = readFileSync(path, "utf8");
 const cars = activeInventory.filter(car => String(car.make).toLowerCase().includes(brand));
 html = html.replace(/(<div class="lambo-grid"[^>]*>)[\s\S]*?<\/div>/, (_, opening) => opening + cars.map(car => `<article class="lambo-card"><a class="lambo-card-media" href="/cars/${car.slug}">${publicCarPicture(car, {alt: car.name})}</a><div class="lambo-card-body"><h3>${escapeHtml(car.name)}</h3><p>${formatUsd(car.price)} / day</p><a href="/cars/${car.slug}">View vehicle &amp; request dates</a></div></article>`).join("") + "</div>");
 writeFileSync(path, html);
}
function normalizePublicLinks(directory, relative = "") {
 for (const entry of readdirSync(directory, { withFileTypes: true })) {
  const path = join(directory, entry.name), key = join(relative, entry.name);
  if (entry.isDirectory()) { if (!["admin", "assets"].includes(key)) normalizePublicLinks(path, key); continue; }
  if (!/\.(html|js)$/.test(entry.name) || key.startsWith("src/admin")) continue;
  let source = readFileSync(path, "utf8");
  source = source.replace(/(href=["'](?:https:\/\/www\.prestigeluxor\.com)?\/[^"'?#]*?)\.html(?=["'?#])/g, "$1");
  if (entry.name.endsWith(".html") && /<main/.test(source) && !source.includes('class="seo-delivery-nav"') && !/name="robots" content="noindex/.test(source)) source = source.replace("</main>", `${regionLinks}</main>`);
  if (entry.name.endsWith(".html")) {
   source = source.replace("</head>", '<link rel="stylesheet" href="/src/seo-navigation.css" /></head>');
   const {document}=parseHTML(source); applySiteChrome(document,{path:'/'+key.replace(/\.html$/,'')}); applySearchMetadata(document); source='<!doctype html>\n'+document.documentElement.outerHTML;
  }
  writeFileSync(path, source);
 }
}
normalizePublicLinks(outDir);

injectGoogleAdsTag(outDir);
injectVercelObservability(outDir);
const responseInventory = await loadPublicInventory().catch(() => ({special:null,month:inventoryMonth()}));
const renderPaths = ['index','fleet','lamborghini','ferrari','wedding',...activeInventory.map(car=>'cars/'+car.slug)];
for (const route of renderPaths) {
 const path=join(outDir,route+'.html');
 if(existsSync(path)) writeFileSync(path,renderPublicDocument(readFileSync(path,'utf8'),activeInventory,{...responseInventory,path:'/'+route}));
}
function addStabilityStyles(directory) {
 for(const entry of readdirSync(directory,{withFileTypes:true})) {
  const path=join(directory,entry.name);
  if(entry.isDirectory()) {if(!['assets','admin','src'].includes(entry.name))addStabilityStyles(path);}
  else if(entry.name.endsWith('.html'))writeFileSync(path,readFileSync(path,'utf8').replace('</head>','<link rel="stylesheet" href="/src/render-stability.css" /><link rel="stylesheet" href="/src/vehicle-gallery.css" /></head>'));
 }
}
for (const page of ['quote','agreement']) {
 const path=join(outDir,page+'.html');writeFileSync(path,renderPrivateDocument(readFileSync(path,'utf8'),page));
}
addStabilityStyles(outDir);
await inlinePublicPageStyles(outDir);

writeFileSync(
  join(outDir, "robots.txt"),
  `# Public pages are available to Googlebot, Bingbot, OAI-SearchBot and PerplexityBot.\n# Search access is independent of model-training crawler policies.\nUser-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`
);

const sitemapPages = [
  "",
  "fleet",
  "guides",
  ...guidePages.map(({ path }) => path),
  "lamborghini",
  "ferrari",
  ...brandPages.map(({ slug }) => slug),
  "faq",
  "partner",
  "wedding",
  ...companyPages.map(({ slug }) => slug),
  ...locationPages.map(({ slug }) => `locations/${slug}`),
];
const sitemapVehicles = activeInventory.filter(({ slug }) => existsSync(join(carDir, `${slug}.html`)));
const sitemap = sitemapXml(sitemapPages,sitemapVehicles);
writeFileSync(join(outDir, "sitemap.xml"), sitemap);

console.log(`Static site copied to dist/ with ${sitemapVehicles.length} indexable inventory pages.`);

// Vercel gives files precedence over rewrites. Keep response templates private so
// the public route always reaches the handler (including quotes and agreements).
const templateDir=join(root,'server-pages');
rmSync(templateDir,{recursive:true,force:true});
for(const route of [...renderPaths,'quote','agreement']) {
 const destination=join(templateDir,route+'.html');
 mkdirSync(dirname(destination),{recursive:true});
 renameSync(join(outDir,route+'.html'),destination);
}

// A compiled vehicle shell supports active cars added after the last deployment.
if (sitemapVehicles.length) cpSync(join(templateDir,'cars',sitemapVehicles[0].slug+'.html'),join(templateDir,'vehicle-template.html'));
writeFileSync(join(templateDir,'seo-routes.json'),JSON.stringify({pages:sitemapPages,fleet:activeInventory.map(({slug,updated_at})=>({slug,updated_at}))}));
renameSync(join(outDir,'sitemap.xml'),join(templateDir,'sitemap.xml'));
