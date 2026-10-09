import {readTripSearch,tripSearchParams,tripSummary} from './rental-search.js';
import { parseHTML } from 'linkedom';
import { homeFleetCard, sortHomeFleet, fleetCategory } from './home-fleet-model.js';
import { fleetPictureMarkup, fleetImageSources, optimizedFleetImageUrl, mapCar } from './supabase-fleet.js';
import { vehicleShellMarkup } from './vehicle-shell.js';
import { vehicleSeoTitle, vehicleSeoDescription, vehicleYear, vehicleDisplayName, publicVehicleDetails, publicVehicleSummary, vehicleSeoSectionMarkup, seatsForVehicle, engineForVehicle, accelerationForVehicle, bodyTypeForVehicle } from './vehicle-content.js';
export const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const formatPrice = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);
const put = (doc, selector, html) => {const node=doc.querySelector(selector);if(node)node.innerHTML=html;};
const text = (doc, selector, value) => doc.querySelectorAll(selector).forEach(node=>node.textContent=value);
export function normalizePublicFleet(rows) {return rows.map(row=>row.car_photos ? mapCar(row) : row);}
function renderHome(document,fleet,special,month) {
const rotating=document.querySelector('[data-dia-words]');
if(rotating){const words=rotating.dataset.diaWords.split(',').map(word=>word.trim()).filter(Boolean);rotating.innerHTML=`<span data-arrival-current>${escapeHtml(words[0])}</span>`+words.map(word=>`<span class="arrival-phrase-reserve" aria-hidden="true">${escapeHtml(word)}</span>`).join('');}
const hero=document.querySelector('[data-hero-search]');
if(hero) {
 const select=hero.querySelector('select[name="deliveryCity"]');
 if(select && !hero.querySelector('.hero-city-trigger')) {
  select.hidden=true;
  select.insertAdjacentHTML('afterend',`<button type="button" class="hero-city-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="hero-city-options"><span>${escapeHtml(select.querySelector('option[selected]')?.textContent || select.querySelector('option')?.textContent)}</span><span class="hero-city-chevron" aria-hidden="true"></span></button>`);
 }
 hero.querySelectorAll('input[type="date"]').forEach(input=>{
  if(input.parentElement.querySelector('.hero-date-trigger'))return;
  input.hidden=true;input.parentElement.classList.add('date-enhanced');
  input.insertAdjacentHTML('afterend',`<button type="button" class="hero-date-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHtml(input.getAttribute('aria-label'))}: Select date"><span>Select date</span><span class="hero-calendar-icon" aria-hidden="true"></span></button>`);
 });
}

function brandFor(car) {
  const source = `${car.make || ""} ${car.name || ""}`.toLowerCase();
  const brands = [
    ["Rolls-Royce", /rolls[ -]?royce|cullinan|\bdawn\b/],
    ["Mercedes-Benz", /mercedes|maybach|\bamg\b|g[ -]?wagon/],
    ["Land Rover", /land rover|range rover|defender/],
    ["Chevrolet", /chevrolet|chevy|corvette|\bc8\b/],
    ["Lamborghini", /lamborghini/],
    ["McLaren", /mclaren/],
    ["Cadillac", /cadillac|escalade/],
    ["Porsche", /porsche/],
    ["Ferrari", /ferrari/],
    ["Bentley", /bentley|continental/],
    ["Tesla", /tesla/],
    ["Lotus", /lotus|emira/],
    ["Ford", /\bford\b|f-?150|raptor/],
    ["Audi", /\baudi\b/],
    ["BMW", /\bbmw\b/],
  ];

  return brands.find(([, pattern]) => pattern.test(source))?.[0] || "Other";
}

function brandMark(brand) {
  const logos = {
    Audi: "/assets/brand-logos/audi.svg",
    BMW: "/assets/brand-logos/bmw.svg",
    Bentley: "/assets/brand-logos/bentley.svg",
    Cadillac: "/assets/brand-logos/cadillac.svg",
    Chevrolet: "/assets/brand-logos/chevrolet.svg",
    Ferrari: "/assets/brand-logos/ferrari.svg",
    Ford: "/assets/brand-logos/ford.svg",
    Lamborghini: "/assets/brand-logos/lamborghini.svg",
    McLaren: "/assets/brand-logos/mclaren.svg",
    Porsche: "/assets/brand-logos/porsche.svg",
    "Rolls-Royce": "/assets/brand-logos/rolls-royce.svg",
    Tesla: "/assets/brand-logos/tesla.svg",
  };

  const monochromeLogos = {
    "Land Rover": "/assets/brand-logos/land-rover.svg",
    Lotus: "/assets/brand-logos/lotus.svg",
  };

  if (brand === "Mercedes-Benz") {
    return `
      <svg class="brand-logo-mark" aria-hidden="true" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" />
        <path d="M32 9v23l18 14M32 32 14 46M32 32l18 14" />
      </svg>
    `;
  }

  if (monochromeLogos[brand]) {
    return `<img class="brand-logo-mark brand-logo-monochrome" src="${monochromeLogos[brand]}" alt="" width="160" height="96" />`;
  }

  if (!logos[brand]) return `<span class="brand-logo-text">${brand}</span>`;

  return `<img class="brand-logo-mark" src="${logos[brand]}" alt="" width="104" height="104" />`;
}

function bodyTypeFor(car) {
  const name = String(car?.name || "").toLowerCase();
  const feature = cleanFeature(car).toLowerCase();

  if (feature.includes("convertible") || name.includes("spider")) return "Convertible";
  if (name.includes("gle") || name.includes("g63") || name.includes("escalade") || name.includes("urus")) return "SUV";
  if (name.includes("f150")) return "Truck";
  if (name.includes("m3")) return "Sedan";
  return "Coupe";
}

function typeLabel(type) {
  if (type === "Coupe") return "Coupe | Sports";
  if (type === "All") return "All options";
  return type;
}

function typeVisual(type) {
  const shapes = {
    All: `
      <ellipse class="type-car-shadow" cx="162" cy="111" rx="116" ry="9" />
      <path class="type-car-body" d="M31 90c9-19 21-31 42-34l38-6h55c24 0 48 10 67 27l18 4c14 3 25 13 31 24l-20 7H55l-24-22Z" />
      <path class="type-window" d="M86 58h72c25 0 42 10 59 25H68l18-25Z" />
      <path class="type-detail" d="M112 58 94 83M160 58l28 25M64 91h32M225 91h37" />
      <circle class="type-tire" cx="86" cy="105" r="19" />
      <circle class="type-rim" cx="86" cy="105" r="8" />
      <circle class="type-tire" cx="232" cy="105" r="19" />
      <circle class="type-rim" cx="232" cy="105" r="8" />
    `,
    Convertible: `
      <ellipse class="type-car-shadow" cx="163" cy="112" rx="116" ry="9" />
      <path class="type-car-body" d="M31 91c8-13 18-22 37-25l38-6h58c28 0 53 9 74 25l20 4c13 3 22 11 29 21l-19 6H53L31 91Z" />
      <path class="type-window" d="M101 62h56l30 23H82l19-23Z" />
      <path class="type-detail" d="M81 65c19-21 55-31 94-25M111 62 96 86M160 62l24 23M69 92h29M226 92h39" />
      <path class="type-seat" d="M151 67c5-7 13-8 19-2l-4 18h-20l5-16Z" />
      <circle class="type-tire" cx="86" cy="107" r="19" />
      <circle class="type-rim" cx="86" cy="107" r="8" />
      <circle class="type-tire" cx="232" cy="107" r="19" />
      <circle class="type-rim" cx="232" cy="107" r="8" />
    `,
    Coupe: `
      <ellipse class="type-car-shadow" cx="163" cy="112" rx="121" ry="9" />
      <path class="type-car-body" d="M25 92c13-18 30-28 58-31l36-9h51c31 0 52 12 75 31l26 5c12 2 21 10 27 21l-21 7H47L25 92Z" />
      <path class="type-window" d="M91 60h73c25 0 43 10 62 25H70l21-25Z" />
      <path class="type-detail" d="M115 60 99 85M165 60l31 25M61 93h39M232 93h40M205 78l32 4" />
      <circle class="type-tire" cx="85" cy="107" r="20" />
      <circle class="type-rim" cx="85" cy="107" r="8" />
      <circle class="type-tire" cx="238" cy="107" r="20" />
      <circle class="type-rim" cx="238" cy="107" r="8" />
    `,
    SUV: `
      <ellipse class="type-car-shadow" cx="162" cy="112" rx="119" ry="9" />
      <path class="type-car-body" d="M30 88V55c0-8 6-14 14-15l43-5h77c24 0 44 9 61 26l23 6c14 4 26 16 32 31l-18 15H55L30 88Z" />
      <path class="type-window" d="M56 51h108c19 0 35 8 50 24H55l1-24Z" />
      <path class="type-detail" d="M91 51v25M134 51v25M166 51l24 25M51 88h45M222 88h43M53 40l37-5" />
      <circle class="type-tire" cx="83" cy="106" r="20" />
      <circle class="type-rim" cx="83" cy="106" r="8" />
      <circle class="type-tire" cx="232" cy="106" r="20" />
      <circle class="type-rim" cx="232" cy="106" r="8" />
    `,
    Sedan: `
      <ellipse class="type-car-shadow" cx="162" cy="112" rx="113" ry="8" />
      <path class="type-car-body" d="M34 91c10-16 24-24 48-27l34-9h50c26 0 47 10 68 29l21 4c13 3 22 11 29 21l-19 6H56L34 91Z" />
      <path class="type-window" d="M86 62h78c24 0 41 9 59 23H67l19-23Z" />
      <path class="type-detail" d="M111 62 98 85M156 62v23M185 70l24 15M66 92h33M225 92h37" />
      <circle class="type-tire" cx="86" cy="106" r="18" />
      <circle class="type-rim" cx="86" cy="106" r="7" />
      <circle class="type-tire" cx="230" cy="106" r="18" />
      <circle class="type-rim" cx="230" cy="106" r="7" />
    `,
    Truck: `
      <ellipse class="type-car-shadow" cx="162" cy="113" rx="118" ry="9" />
      <path class="type-car-body" d="M29 88V53c0-7 5-12 12-12h94c11 0 19 7 23 17h58l33 30 32 9-18 17H55L29 88Z" />
      <path class="type-window" d="M53 52h78c11 0 18 8 22 23H53V52Z" />
      <path class="type-detail" d="M88 52v24M153 58h63l26 29M58 88h43M223 88h42" />
      <circle class="type-tire" cx="84" cy="107" r="20" />
      <circle class="type-rim" cx="84" cy="107" r="8" />
      <circle class="type-tire" cx="230" cy="107" r="20" />
      <circle class="type-rim" cx="230" cy="107" r="8" />
    `,
  };

  return `
    <svg class="type-preview" aria-hidden="true" viewBox="0 0 320 140">
      ${shapes[type] || shapes.Coupe}
    </svg>
  `;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanFeature(car) {
  const firstTag = Array.isArray(car?.tags) ? car.tags.find((tag) => typeof tag === "string" && tag.trim()) : "";
  return String(firstTag || "").replace("...", "").replace(/\s+/g, " ").trim();
}

const brandGrid=document.querySelector("[data-brand-grid]"),brandDots=document.querySelector("[data-brand-dots]"),typeGrid=document.querySelector("[data-type-grid]");
function renderShopBrowsers() {
  const brands = [...new Set(fleet.map(brandFor))].sort((a, b) => a.localeCompare(b));
  const availableTypes = new Set(fleet.map(bodyTypeFor));
  const types = ["SUV", "Convertible", "Coupe", "Sedan", "Truck"].filter((type) => availableTypes.has(type));
  types.push("All");

  brandGrid.innerHTML = brands
    .map((brand) => {
      const count = fleet.filter((car) => brandFor(car) === brand).length;
      return `
        <button class="shop-tile brand-tile" type="button" data-shop-filter="brand:${brand}">
          ${brandMark(brand)}
          <span class="brand-name">${brand}</span>
          <strong>${count} ${count === 1 ? "car" : "cars"}</strong>
        </button>
      `;
    })
    .join("");

  brandDots.innerHTML = brands.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("");

  typeGrid.innerHTML = types
    .map((type) => {
      const value = type === "All" ? "all" : `type:${type}`;
      const count = type === "All" ? fleet.length : fleet.filter((car) => bodyTypeFor(car) === type).length;
      return `
        <button class="type-card ${value === "all" ? "active" : ""}" type="button" data-shop-filter="${value}" aria-label="Browse ${typeLabel(type)} rentals, ${count} options">
          ${typeVisual(type)}
          <span>${typeLabel(type)}</span>
        </button>
      `;
    })
    .join("");
}

if(brandGrid && brandDots && typeGrid) renderShopBrowsers();
const cars=sortHomeFleet(fleet);
put(document,'[data-home-fleet-grid]',cars.slice(0,9).map(car=>homeFleetCard(car,fleetPictureMarkup(car.image,{alt:car.name,width:600,height:400,quality:78,updatedAt:car.updatedAt,loading:'lazy'}))).join(''));
put(document,'[data-home-fleet-categories]',['All','Exotic','Luxury','SUV','Classic','Truck'].filter(category=>category==='All'||cars.some(c=>fleetCategory(c)===category)).map(category=>`<button type="button" data-category="${category}" aria-pressed="${category==='All'}">${category}</button>`).join(''));
text(document,'[data-home-fleet-count]',`${cars.length} ${cars.length===1?'car':'cars'}${cars.length>9?' · Showing 9':''}`);
const more=document.querySelector('[data-home-fleet-more]');if(more)more.hidden=cars.length<=9;
const empty=document.querySelector('[data-home-fleet-empty]');if(empty)empty.hidden=cars.length>0;
const monthLabel=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-02T12:00:00Z'));
text(document,'#monthly-specials-title',special?.headline?.trim()||`${monthLabel} special`);
text(document,'[data-specials-description]',special?.description?.trim()||"This month's featured active inventory is available for delivery across Los Angeles and Orange County. Ask for current dates and rates.");
const selected=(special?.car_slugs||[]).map(slug=>cars.find(c=>c.slug===slug)).filter(Boolean).slice(0,2);
put(document,'[data-specials-rail]',selected.length ? selected.map(car=>`<article class="special-card">${fleetPictureMarkup(car.image,{alt:car.name+' monthly rental special',width:1200,height:900,quality:78,updatedAt:car.updatedAt,loading:'lazy'})}<div class="special-card-copy"><span>${escapeHtml(monthLabel)} feature</span><h3>${escapeHtml(car.name.replace(/^\d{4}\s+/,''))}</h3><p>${escapeHtml(car.color||car.categoryLabel||car.category)}</p><div class="special-card-offer"><b>10% off</b><div><del>${formatPrice(car.price)}</del><strong>${formatPrice(Math.round(car.price*.9))}</strong><small>/day</small></div></div><a href="/cars/${car.slug}">View special</a></div></article>`).join('') : '<div class="specials-empty"><strong>New monthly specials are coming soon.</strong><span>Call or text us for current availability.</span></div>');
document.querySelectorAll('[data-special-prev],[data-special-next]').forEach(n=>n.hidden=selected.length<2);
}
function renderFleet(document,cars,search="") {
const activeType="all",activeBrand="all";
const typeFilters=document.querySelector("[data-type-filters]"),brandFilters=document.querySelector("[data-brand-filters]"),brandRail=document.querySelector("[data-brand-rail]"),brandDots=document.querySelector("[data-fleet-brand-dots]");
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

function vehicleDisplay(car) {
  const brand = brandFor(car);
  const model = car.model || car.name.replace(/^\d{4}\s+/, "").replace(brand, "").trim();

  return { brand, model };
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

renderFilterButtons();
const ordered=sortHomeFleet(cars);
put(document,'[data-popular-grid]',ordered.slice(0,3).map((car,i)=>cardMarkup(car,'popular',i===0)).join(''));
const query=search.trim().toLowerCase();
const visible=ordered.filter(car=>query.split(/\s+/).filter(Boolean).every(token=>[car.name,car.make,car.model,car.color,car.category,car.categoryLabel,bodyTypeFor(car)].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(token)));
const searchInput=document.querySelector('[data-fleet-search]');if(searchInput)searchInput.setAttribute('value',search);
const clear=document.querySelector('[data-clear-search]');if(clear)clear.hidden=!search;
put(document,'[data-fleet-grid]',visible.length?visible.map((car,index)=>cardMarkup(car)+((index+1)%12===0&&index!==visible.length-1?`<aside class="fleet-concierge-break"><div><p class="eyebrow">Need a recommendation?</p><h2>Tell us the date, budget, and occasion.</h2><p>We will review the collection and suggest vehicles that fit your plans.</p></div><button type="button" data-concierge-match>Help me choose</button></aside>`:'')).join(''):`<div class="fleet-empty-state"><strong>No vehicles found</strong><p>Try a different make, model, color, or filter.</p><button type="button" data-reset-fleet>Show all vehicles</button></div>`);
text(document,'[data-fleet-count]',`${visible.length} ${visible.length===1?'vehicle':'vehicles'}`);
text(document,'[data-fleet-filter-note]',search?`Search: “${search}”`:'All cars');
}
function renderMarque(document,fleet) {
const marque=document.body.dataset.marque||"Lamborghini",marqueLower=marque.toLowerCase();
function slugFor(car) {
  return car.slug || String(car.name || marqueLower).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function originalImage(car) {
  return car.image || car.image_url || car.gallery?.[0] || "/assets/optimized/prestige-luxor-hero.webp";
}

function displayModel(car) {
  const prefix = new RegExp(`^\\d{4}\\s+${marque}\\s+`, "i");
  const makeOnly = new RegExp(`^${marque}\\s+`, "i");
  return String(car.model || car.name || marque).replace(prefix, "").replace(makeOnly, "");
}

const cars=fleet.filter(car=>(car.make||car.name).toLowerCase().includes(marqueLower)).sort((a,b)=>a.price-b.price);
  const markup = cars.map((car, index) => {
    const model = displayModel(car);
    const year = String(car.name || "").match(/^\d{4}/)?.[0] || "Available";
    return `
      <article class="lambo-card">
        <a class="lambo-card-media" href="/cars/${escapeHtml(slugFor(car))}" aria-label="View ${escapeHtml(car.name)}">
          ${fleetPictureMarkup(originalImage(car), { alt: `${car.name} available for rent from Prestige Luxor`, width: 900, height: 675, quality: 76, updatedAt: car.updatedAt || car.updated_at, loading: index < 3 ? "eager" : "lazy", fetchPriority: index === 0 ? "high" : "" })}
        </a>
        <div class="lambo-card-body">
          <div><span>${escapeHtml(year)} · ${escapeHtml(marque)}</span><h3>${escapeHtml(model)}</h3></div>
          <p class="lambo-card-price"><span>From</span><strong>${escapeHtml(formatPrice(car.price))}</strong><small>/day</small></p>
        </div>
        <button type="button" data-select-lamborghini="${escapeHtml(car.name)}" aria-pressed="false"><span data-select-label>Check This Car</span><span aria-hidden="true">↗</span></button>
      </article>`;
  }).join("");
put(document,'[data-lamborghini-grid]',markup);
put(document,'[data-lamborghini-select]','<option value="">Choose a vehicle</option>'+cars.map(car=>`<option value="${escapeHtml(car.name)}">${escapeHtml(car.name)} — ${formatPrice(car.price)}/day</option>`).join(''));
text(document,'[data-lamborghini-note]',`${cars.length} ${marque} ${cars.length===1?'vehicle':'vehicles'} currently listed. Rates and availability are verified for your dates.`);
const form=document.querySelector('[data-lamborghini-form]');if(form)form.classList.add('is-stepped');
document.querySelectorAll('[data-form-step]').forEach(step=>step.classList.toggle('is-active',step.dataset.formStep==='1'));
text(document,'[data-lamborghini-summary]',`${marque} not selected · date not selected to date not selected · delivery location not entered`);
}
function renderVehicle(document,car,vehicleFleet,special,month) {
const page=document.querySelector('[data-vehicle-page]'); if(!page||!car)return;
page.innerHTML=vehicleShellMarkup(vehicleSeoSectionMarkup(car,{formatPrice,escapeHtml}));
const title=vehicleDisplayName(car);
const facts={year:vehicleYear(car),title,category:car.categoryLabel,price:formatPrice(car.price)+'/day',summary:publicVehicleSummary(car),mileage:car.mileage,'mileage-short':String(car.mileage||'').match(/\d+/)?.[0]||'Confirm',color:car.color||'Confirm exterior',make:car.make,model:car.model,engine:engineForVehicle(car),seats:seatsForVehicle(car),acceleration:accelerationForVehicle(car),type:bodyTypeForVehicle(car)};
for(const [key,value] of Object.entries(facts))text(document,`[data-vehicle-${key}]`,value||'');
document.title=vehicleSeoTitle(car);
const description=document.querySelector('meta[name="description"]');if(description)description.setAttribute('content',vehicleSeoDescription(car,formatPrice));
const h=document.querySelector('[data-vehicle-title]');h.classList.toggle('vehicle-title-long',title.length>18);h.classList.toggle('vehicle-title-extra-long',title.length>28);
const gallery=[...new Set([...(car.gallery||[]),car.image].filter(Boolean))].slice(0,3);
const src=fleetImageSources(gallery[0],{width:1200,height:825,quality:82,updatedAt:car.updatedAt});
document.querySelectorAll('link[rel="preload"][as="image"]').forEach(link=>{link.setAttribute('href',src.optimized);link.removeAttribute('imagesrcset');link.removeAttribute('imagesizes');link.removeAttribute('type');});
const discounted=(special?.car_slugs||[]).slice(0,2).includes(car.slug);
document.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{try{const data=JSON.parse(script.textContent);for(const entity of data['@graph']||[]){if(entity.offers && entity.url?.endsWith('/cars/'+car.slug)){entity.name=car.name;entity.image=src.fallback;entity.offers.price=discounted?Math.round(car.price*.9):car.price;if(entity.offers.priceSpecification)entity.offers.priceSpecification.price=entity.offers.price;}}script.textContent=JSON.stringify(data).replaceAll('<','\\u003c');}catch{}});
const source=document.querySelector('[data-gallery-source]');source.setAttribute('srcset',src.optimized);if(/\.webp(?:\?|$)/i.test(src.optimized))source.setAttribute('type','image/webp');
const image=document.querySelector('[data-gallery-main]');image.setAttribute('draggable','false');image.setAttribute('src',src.fallback);image.setAttribute('alt',car.name+' photo 1');
put(document,'[data-gallery-thumbs]',gallery.map((url,i)=>`<button class="vehicle-side-thumb ${i===0?'active':''}" type="button" data-gallery-image="${escapeHtml(url)}" data-gallery-index="${i}" aria-label="Show photo ${i+1} of ${escapeHtml(car.name)}">${fleetPictureMarkup(url,{alt:'',width:360,height:240,quality:78,updatedAt:car.updatedAt,loading:'lazy'})}</button>`).join(''));
text(document,'[data-gallery-count]',`1 / ${gallery.length}`);put(document,'[data-gallery-dots]',gallery.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join(''));
document.querySelectorAll('[data-gallery-prev],[data-gallery-next]').forEach(button=>button.hidden=gallery.length<2);
const field=document.querySelector('[name="vehicle"]');if(field)field.setAttribute('value',car.name);
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
                <span>${escapeHtml(rate.label)}</span>
                <strong>${rate.discount}%<small> savings</small></strong>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="tag-row vehicle-feature-tags">
        ${featureTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
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
            ${escapeHtml(detail)}
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
if((special?.car_slugs||[]).slice(0,2).includes(car.slug)){
 const label=new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(new Date(month+'-02T12:00:00Z'));
 document.querySelectorAll('[data-vehicle-price]').forEach(price=>{price.classList.add('vehicle-special-price');price.setAttribute('aria-label',`${label} special: 10% off, ${formatPrice(Math.round(car.price*.9))} per day, regularly ${formatPrice(car.price)} per day`);price.innerHTML=`<span class="vehicle-special-label">${label} special · 10% off</span><span class="vehicle-special-values" aria-hidden="true"><del>${formatPrice(car.price)}</del><b>${formatPrice(Math.round(car.price*.9))}</b><small>/day</small></span>`;});
 }
}
export function renderPublicDocument(html, rows, {special=null,month=new Date().toISOString().slice(0,7),path='/',search=''}={}) {
 const fleet=normalizePublicFleet(rows),{document}=parseHTML(html),params=new URLSearchParams(search),trip=readTripSearch(search);
 if(document.body.classList.contains('home-page'))renderHome(document,fleet,special,month);
 if(document.body.classList.contains('fleet-page'))renderFleet(document,fleet,params.get('search')?.trim()||'');
 if(document.body.classList.contains('lamborghini-page'))renderMarque(document,fleet);
 const slug=document.body.dataset.vehicleSlug||document.querySelector('[data-vehicle-page]')?.dataset.vehicleSlug||path.split('/').pop()?.replace(/\.html$/,'');
 if(document.querySelector('[data-vehicle-page]'))renderVehicle(document,fleet.find(c=>c.slug===slug),fleet,special,month);
 document.documentElement.dataset.publicRendered='true';
 let state=document.querySelector('#public-page-state');if(!state){state=document.createElement('script');state.id='public-page-state';state.type='application/json';document.head.append(state);}
 state.textContent=JSON.stringify({fleet,special,month,search}).replaceAll('<','\\u003c');
 // Native select options are already present when the form becomes interactive.
 document.querySelectorAll('[data-vehicle-select]').forEach(select=>{select.innerHTML='<option value="">Select a vehicle</option>'+fleet.map(c=>`<option>${escapeHtml(c.name)} - ${formatPrice(c.price)}/day</option>`).join('');});
 if(trip.city||trip.pickup) {
  const summary=tripSummary(trip);
  const hero=document.querySelector('[data-hero-search]');
  if(hero){
   const city=hero.querySelector('[name="deliveryCity"]');
   if([...city.querySelectorAll('option')].some(option=>option.getAttribute('value')===trip.city)){
    city.querySelectorAll('option').forEach(option=>option.toggleAttribute('selected',option.getAttribute('value')===trip.city));
    text(document,'.hero-city-trigger > span:first-child',trip.city);
   }
   for(const [name,value] of [['pickup',trip.pickup],['return',trip.returnDate]])if(value){
    const input=hero.querySelector(`[name="${name}"]`);input.setAttribute('value',value);input.removeAttribute('data-empty');
    const trigger=input.parentElement.querySelector('.hero-date-trigger');trigger.classList.add('has-date');trigger.firstElementChild.textContent=tripSummary({pickup:value});trigger.setAttribute('aria-label',input.getAttribute('aria-label')+': '+trigger.firstElementChild.textContent);
   }
  }
  const fleetHero=document.querySelector('.fleet-editorial-hero');
  if(fleetHero){document.querySelector('.rental-trip-banner')?.remove();fleetHero.insertAdjacentHTML('afterend',`<aside class="rental-trip-banner" aria-label="Your rental plans"><strong>${escapeHtml(summary)}</strong><span>Browse the collection below. Your dates and delivery are confirmed after you request a car.</span><a href="/?${escapeHtml(tripSearchParams(trip).toString())}#rental-search">Edit trip</a></aside>`);}
  document.querySelectorAll('[data-vehicle-request-form],[data-availability-form]').forEach(form=>{
   for(const [name,value] of [['deliveryLocation',trip.city],['date',trip.pickup],['returnDate',trip.returnDate]]){
    const input=form.querySelector(`[name="${name}"]`);if(!input||!value)continue;
    if(input.getAttribute('type')==='datetime-local'){input.setAttribute('type','date');const label=input.closest('label')?.querySelector('span');if(label?.firstChild)label.firstChild.textContent=name==='date'?'Pickup date':'Return date ';}
    input.setAttribute('value',value);
   }
   form.querySelector('.rental-trip-note')?.remove();form.insertAdjacentHTML('afterbegin',`<p class="rental-trip-note">${escapeHtml(summary)}. Confirm exact handoff times with your concierge.</p>`);
  });
 }
 const requestedVehicle=params.get('vehicle');if(requestedVehicle)document.querySelectorAll('[data-vehicle-select] option').forEach(option=>option.toggleAttribute('selected',option.textContent.startsWith(requestedVehicle)));
 return '<!doctype html>\n'+document.documentElement.outerHTML.replace(/(href=["'][^"'?#]*?)\.html(?=["'?#])/g,'$1');
}
