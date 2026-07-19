import { ADMIN_FLEET_REFRESH_KEY } from "./admin-store.js?v=fleet-consistency-20260715";
import { fleet as websiteFleet } from "./fleet-data.js?v=fleet-consistency-20260715";
import { cacheSafeFleetImageUrl, isSupabaseFleetConfigured, loadFleetFromSupabase, loadMonthlySpecialFromSupabase } from "./supabase-fleet.js?v=fleet-consistency-20260715";
import { submitQuoteRequest } from "./quote-api.js?v=lead-delivery-20260718b";

let fleet = [
  {
    name: "2021 BMW M3 Comp",
    category: "sports luxury",
    price: 250,
    mileage: "100 miles/day",
    image: "/assets/fleet/2021-bmw-m3-comp.jpg?v=sharp-20260620",
    tags: ["Blue exterior / Silverstone Interi...", "$225.00 3-5 days", "$200.00 6-7 days"],
    sourceLink:
      "https://www.dropbox.com/scl/fo/akd7tpm7qkjhhex8frh4j/AHCjt8LqBIs7AEWWmdco5ow?rlkey=qjsbleguir0199bvlhqi5lycf&e=1&dl=0",
  },
  {
    name: "2022 Porsche 911 Carrera",
    category: "supercar",
    price: 400,
    mileage: "100 miles/day",
    image: "/assets/fleet/2022-porsche-911-carrera.jpg",
    tags: ["Red - Carbon wing, upgraded exhaust", "$350.00 3-5 days", "$325.00 6-7 days"],
    sourceLink: "https://drive.google.com/drive/folders/1rBDiBMThTUrhmgE19FZirWqfqKMfpas-",
  },
  {
    name: "2017 Audi R8",
    category: "supercar",
    price: 500,
    mileage: "100 miles/day",
    image: "/assets/fleet/2017-audi-r8.jpg?v=sharp-20260620",
    tags: ["Matte Black - Carbon, Exhaust, Tun...", "$450.00 3-5 days", "$425.00 6-7 days"],
    sourceLink:
      "https://www.dropbox.com/scl/fo/j8q7hlfql4kgux3tcq2xn/ADgtRdBqa0v4qz0wOoJUVUY?rlkey=mo4sbpcgx5gygfu23pagc90bx&e=1&st=bd1rbdyv&dl=0",
  },
  {
    name: "2015 Lamborghini Huracan LP-610-4",
    category: "supercar",
    price: 800,
    mileage: "100 miles/day",
    image: "/assets/fleet/2015-lamborghini-huracan-lp-610-4.jpg",
    tags: ["British Racing Green full 1016 kit...", "$750.00 3-5 days", "$725.00 6-7 days"],
    sourceLink: "https://drive.google.com/drive/folders/1PVW8DTW8L_y6LZXPJstSOswPBnc3rspN",
  },
  {
    name: "2022 Lamborghini Huracan",
    category: "supercar",
    price: 800,
    mileage: "100 miles/day",
    image: "/assets/fleet/2022-lamborghini-huracan.jpg",
    tags: ["Blue convertible", "$750.00 3-5 days", "$725.00 6-7 days"],
  },
  {
    name: "2016 Ferrari 488 GTB",
    category: "supercar",
    price: 750,
    mileage: "100 miles/day",
    image: "/assets/fleet/2016-ferrari-488-gtb.jpg",
    tags: ["Red with Exhaust", "$725.00 3-5 days", "$700.00 6-7 days"],
    sourceLink: "https://drive.google.com/drive/folders/1YOY6w9ZSN-5PRJfuEekLQe5i93BSb1Nh",
  },
  {
    name: "2018 McLaren 570s Spider",
    category: "supercar",
    price: 650,
    mileage: "100 miles/day",
    image: "/assets/fleet/2018-mclaren-570s-spider.jpg?v=sharp-20260620",
    tags: ["Blue with full downpipes/exhaust t...", "$600.00 3-5 days", "$550.00 6-7 days"],
    sourceLink:
      "https://www.dropbox.com/scl/fo/muq977w4b2zrvxu2ox764/AF0sJVyBF9pX4GY5qq3lPyE?rlkey=v2f1cw7robv2b7yvujckcx50c&st=uy3h2bzr&dl=0",
  },
  {
    name: "2019 Mercedes G63 AMG",
    category: "suv luxury",
    price: 400,
    mileage: "100 miles/day",
    image: "/assets/fleet/2022-mercedes-gle53-amg.jpg?v=sharp-20260620",
    tags: ["Matte Black with White interior", "$350.00 3-5 days", "$325.00 6-7 days"],
  },
  {
    name: "2022 Mercedes GLE53 AMG",
    category: "suv luxury",
    price: 300,
    mileage: "100 miles/day",
    image: "/assets/fleet/2022-mercedes-gle53-amg.jpg?v=sharp-20260620",
    tags: ["Matte Black Massaging seats 100k s...", "$250.00 3-5 days", "$200.00 6-7 days"],
    sourceLink:
      "https://www.dropbox.com/scl/fo/io7znpwthu7611qxgyerd/ANEuolwop6xxZQ1AwPkideA?rlkey=y9b8uh02labysjdgf5j7qaiqx&e=1&st=1wm7yala&dl=0",
  },
  {
    name: "2022 Cadillac Escalade",
    category: "suv luxury",
    price: 300,
    mileage: "100 miles/day",
    image: "/assets/fleet/2022-cadillac-escalade.jpg?v=sharp-20260620",
    tags: ["Dark Blue / Captains chairs", "$250.00 3-5 days", "$200.00 6-7 days"],
    sourceLink:
      "https://www.dropbox.com/scl/fo/zxel6k9jtdfol98yj813t/AF3J628o1zgZhGR4LzYxZ9M?rlkey=zew30lqd1niv8tdnh7m3glgyq&e=4&st=tee2smce&dl=0",
  },
  {
    name: "2026 Ford F150 Raptor",
    category: "suv luxury",
    price: 250,
    mileage: "100 miles/day",
    image: "/assets/kds-hero.png",
    tags: ["Shelter Green / Level kit + wheels...", "$200.00 3-5 days", "$175.00 6-7 days"],
  },
  {
    name: "2020 Lamborghini Urus",
    category: "suv luxury",
    price: 750,
    mileage: "100 miles/day",
    image: "/assets/kds-hero.png",
    tags: ["Matte Black with orange interior /...", "$700.00 3-5 days", "$650.00 6-7 days"],
  },
  {
    name: "2024 BMW M4-Comp",
    category: "sports luxury",
    price: 300,
    mileage: "100 miles/day",
    image: "/assets/fleet/2024-bmw-m4-comp.jpg",
    tags: ["Skyscraper gray with ivory white i...", "$250.00 3-5 days", "$225.00 6-7 days"],
    sourceLink: "https://drive.google.com/drive/folders/1Ow3IByK9lzBPrkUKhAYIviqQH5djb7N5",
  },
  {
    name: "2026 Chevy C8 Corvette",
    category: "supercar",
    price: 250,
    mileage: "100 miles/day",
    image: "/assets/kds-hero.png",
    tags: ["Torch Red / exhaust / splitter", "$225.00 3-5 days", "$200.00 6-7 days"],
  },
];

const fanStage = document.querySelector("[data-fan-stage]");
const fanPrev = document.querySelector("[data-fan-prev]");
const fanNext = document.querySelector("[data-fan-next]");
const fanDots = document.querySelector("[data-fan-dots]");
let fanImageObserver;
const brandGrid = document.querySelector("[data-brand-grid]");
const brandDots = document.querySelector("[data-brand-dots]");
const typeGrid = document.querySelector("[data-type-grid]");
const typePrev = document.querySelector("[data-type-prev]");
const typeNext = document.querySelector("[data-type-next]");
const specialsViewport = document.querySelector("[data-specials-viewport]");
const specialPrev = document.querySelector("[data-special-prev]");
const specialNext = document.querySelector("[data-special-next]");
const specialsRail = document.querySelector("[data-specials-rail]");
const specialsTitle = document.querySelector("[data-specials-title]");
const specialsDescription = document.querySelector("[data-specials-description]");
const vehicleSelects = document.querySelectorAll("[data-vehicle-select]");
const filterButtons = document.querySelectorAll("[data-filter]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const header = document.querySelector("[data-header]");
const form = document.querySelector(".booking-form");
const formStatus = document.querySelector("[data-form-status]");
const quoteForm = document.querySelector("[data-quote-form]");
const quoteStatus = document.querySelector("[data-quote-status]");
const quoteTyping = document.querySelector("[data-quote-typing]");
const quoteProgressText = document.querySelector("[data-quote-progress-text]");
const quoteProgressPercent = document.querySelector("[data-quote-progress-percent]");
const quoteProgressBar = document.querySelector("[data-quote-progress-bar]");
const CRM_REQUESTS_KEY = "kds-crm-requests";
const diaText = document.querySelector("[data-dia-words]");
const CLOUD_FLEET_TIMEOUT_MS = 3500;
const BEST_FAN_LIMIT = 9;
let monthlySpecialRenderVersion = 0;
let cloudHomeRefreshPromise = null;
const BEST_FAN_SLUGS = [
  "2022-lamborghini-huracan",
  "lamborghini-huracan-blue",
  "lamborghini-huracan-evo",
  "2015-lamborghini-huracan-lp-610-4",
  "ferrari-f8",
  "ferrari-488-spider-grey",
  "ferrari-portofino",
  "2016-ferrari-488-gtb",
  "mclaren-570s",
  "2018-mclaren-570s-spider",
  "mclaren-720s-turquoise",
  "2017-audi-r8",
  "audi-r8-black",
  "porsche-911-carrera-gts",
  "rolls-royce-dawn-convertible-white",
  "rolls-royce-cullinan-white",
  "lamborghini-widebody-urus-black",
];

fleet = websiteFleet.slice();

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

let fanCards = getFeaturedFanCards(fleet);

const fanPositions = [
  { x: -34, y: 0.8, rot: -8, scale: 0.8, z: 1 },
  { x: -23, y: 0.4, rot: -5, scale: 0.88, z: 2 },
  { x: -12, y: 0.1, rot: -2, scale: 0.94, z: 3 },
  { x: 0, y: 0, rot: 0, scale: 1, z: 8 },
  { x: 12, y: 0.1, rot: 2, scale: 0.94, z: 3 },
  { x: 23, y: 0.4, rot: 5, scale: 0.88, z: 2 },
  { x: 34, y: 0.8, rot: 8, scale: 0.8, z: 1 },
];

let fanCenterIndex = Math.floor(fanCards.length / 2);

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatCategory(category) {
  const label = category.split(" ")[0];
  if (label === "suv") return "SUV";
  if (label === "sports") return "Sport";
  if (label === "supercar") return "Exotic";
  return label;
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
  const name = car.name.toLowerCase();
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function vehicleSlug(car) {
  return car.slug || slugify(car.name);
}

function vehicleLabel(car) {
  return car.name.replace(/^\d{4}\s+/, "");
}

function primaryImageFor(car) {
  if (!car) return "/assets/kds-hero.png";
  const image = car.image || car.gallery?.[0] || "/assets/kds-hero.png";
  return cacheSafeFleetImageUrl(image, car.updatedAt || car.updated_at);
}

function isUsableFanCar(car) {
  if (!car) return false;
  const image = primaryImageFor(car);
  return car?.name && vehicleSlug(car) && image && !image.includes("kds-hero");
}

function isPremiumFanCandidate(car) {
  const text = `${car.name} ${car.make || ""} ${car.model || ""} ${car.category || ""}`.toLowerCase();
  return /lamborghini|ferrari|mclaren|rolls|r8|porsche/.test(text);
}

function addUniqueFanCar(list, car) {
  if (!isUsableFanCar(car)) return;
  const slug = vehicleSlug(car);
  if (list.some((item) => vehicleSlug(item) === slug)) return;
  list.push(car);
}

function getFeaturedFanCards(sourceFleet = fleet) {
  const bySlug = new Map(sourceFleet.map((car) => [vehicleSlug(car), car]));
  const selected = [];

  BEST_FAN_SLUGS.forEach((slug) => addUniqueFanCar(selected, bySlug.get(slug)));

  if (selected.length < BEST_FAN_LIMIT) {
    sourceFleet
      .filter((car) => isUsableFanCar(car) && isPremiumFanCandidate(car))
      .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
      .forEach((car) => addUniqueFanCar(selected, car));
  }

  return selected.slice(0, BEST_FAN_LIMIT).map((car) => ({
    slug: vehicleSlug(car),
    name: car.name,
    image: primaryImageFor(car),
  }));
}

function setFeaturedFanCards(sourceFleet = fleet) {
  fanCards = getFeaturedFanCards(sourceFleet);
  fanCenterIndex = Math.floor(fanCards.length / 2);
}

function fanMultiplier() {
  const width = window.innerWidth;
  if (width >= 2200) return 1.35;
  if (width < 480) return 0.34;
  if (width < 640) return 0.46;
  if (width < 768) return 0.58;
  if (width < 1024) return 0.78;
  return 1;
}

function shortestFanOffset(index) {
  const total = fanCards.length;
  let offset = index - fanCenterIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

function updateFanCarousel() {
  const multiplier = fanMultiplier();
  const fanItems = fanStage.querySelectorAll(".fan-card");
  const isDesktopGrid = window.matchMedia("(min-width: 821px)").matches;

  if (isDesktopGrid) {
    fanItems.forEach((card, index) => {
      const isVisible = index < 6;
      card.style.setProperty("--fan-opacity", isVisible ? "1" : "0");
      card.style.zIndex = isVisible ? "1" : "0";
      card.setAttribute("aria-hidden", String(!isVisible));
      card.tabIndex = isVisible ? 0 : -1;
    });
    return;
  }

  fanItems.forEach((card, index) => {
    const offset = shortestFanOffset(index);
    const isVisible = Math.abs(offset) <= 3;
    const slot = offset + 3;
    const position = fanPositions[slot] || fanPositions[3];

    card.style.setProperty("--fan-x", `${position.x * multiplier}rem`);
    card.style.setProperty("--fan-y", `${position.y * multiplier}rem`);
    card.style.setProperty("--fan-rot", `${position.rot}deg`);
    card.style.setProperty("--fan-scale", String(position.scale));
    card.style.setProperty("--fan-opacity", isVisible ? "1" : "0");
    card.style.zIndex = isVisible ? String(position.z) : "0";
    card.setAttribute("aria-hidden", String(!isVisible));
    card.tabIndex = isVisible ? 0 : -1;
  });

  fanDots.querySelectorAll("span").forEach((dot, index) => {
    dot.classList.toggle("active", index === fanCenterIndex);
  });
}

function cycleFan(direction) {
  if (!fanCards.length) return;
  fanCenterIndex = (fanCenterIndex + direction + fanCards.length) % fanCards.length;
  updateFanCarousel();
}

function renderFanCarousel() {
  fanStage.innerHTML = fanCards
    .map(
      (car) => `
        <a class="fan-card" href="/cars/${vehicleSlug(car)}.html" aria-label="View ${car.name}">
          <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-fan-image="${car.image}" alt="${car.name}" loading="lazy" decoding="async" width="500" height="375" onerror="this.onerror=null;this.src='/assets/kds-hero.png';" />
          <span>${vehicleLabel(car)}</span>
        </a>
      `,
    )
    .join("");

  fanDots.innerHTML = fanCards.map((_, index) => `<span class="${index === fanCenterIndex ? "active" : ""}"></span>`).join("");
  updateFanCarousel();
  observeFanImages();
}

function loadFanImages() {
  fanStage.querySelectorAll("img[data-fan-image]").forEach((image) => {
    image.src = image.dataset.fanImage;
    image.removeAttribute("data-fan-image");
  });
}

function observeFanImages() {
  fanImageObserver?.disconnect();
  if (!("IntersectionObserver" in window)) {
    loadFanImages();
    return;
  }

  fanImageObserver = new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loadFanImages();
      observer.disconnect();
    },
    { rootMargin: "240px 0px" },
  );
  fanImageObserver.observe(fanStage);
}

function activateLazyVideo(video) {
  if (!video || video.dataset.mediaLoaded === "true") return;
  video.dataset.mediaLoaded = "true";
  video.querySelectorAll("source[data-src]").forEach((source) => {
    source.src = source.dataset.src;
    source.removeAttribute("data-src");
  });
  video.load();

  const revealVideo = () => {
    video.classList.add("is-ready");
    video.play().catch(() => {});
  };
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) revealVideo();
  else video.addEventListener("canplay", revealVideo, { once: true });
}

function initLazyMedia() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollVideos = document.querySelectorAll("[data-scroll-video]");
  if (!scrollVideos.length || reducedMotion) return;
  if (!("IntersectionObserver" in window)) {
    scrollVideos.forEach(activateLazyVideo);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        activateLazyVideo(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "180px 0px" },
  );
  scrollVideos.forEach((video) => observer.observe(video));
}

function renderFleetLoading() {
  fanCards = Array.from({ length: 7 }, (_, index) => ({
    slug: "",
    name: `Loading vehicle ${index + 1}`,
    image: "",
  }));
  fanCenterIndex = Math.floor(fanCards.length / 2);
  fanStage.innerHTML = fanCards
    .map(
      () => `
        <div class="fan-card fan-card-loading" aria-hidden="true">
          <span></span>
        </div>
      `,
    )
    .join("");
  fanDots.innerHTML = fanCards.map((_, index) => `<span class="${index === fanCenterIndex ? "active" : ""}"></span>`).join("");
  updateFanCarousel();
  if (brandGrid) brandGrid.innerHTML = "";
  if (typeGrid) typeGrid.innerHTML = "";
}

function fleetFilter(filter) {
  if (filter === "all") return () => true;
  if (filter.startsWith("brand:")) {
    const brand = filter.replace("brand:", "");
    return (car) => brandFor(car) === brand;
  }
  if (filter.startsWith("type:")) {
    const type = filter.replace("type:", "");
    return (car) => bodyTypeFor(car) === type;
  }

  return (car) => car.category.includes(filter);
}

function seatsFor(car) {
  if (car.category.includes("suv")) return "5";
  if (car.name.includes("M3")) return "5";
  if (car.name.includes("M4")) return "4";
  return "2";
}

function cleanFeature(car) {
  return car.tags[0].replace("...", "").replace(/\s+/g, " ");
}

function renderSpec(label, value) {
  return `
    <div class="car-pill">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function parseRate(tag) {
  const match = tag.match(/\$([\d,]+)(?:\.00)?\s+(.+)/);
  if (!match) return null;

  return {
    price: `$${match[1]}`,
    term: match[2],
  };
}

function renderRateGrid(car) {
  const rates = car.tags.slice(1, 3).map(parseRate).filter(Boolean);
  if (!rates.length) return "";

  return `
    <div class="car-rate-grid" aria-label="${car.name} multi-day rates">
      ${rates
        .map(
          (rate) => `
            <div class="car-rate">
              <span>${rate.term}</span>
              <strong>${rate.price}<small>/day</small></strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderFleet(filter = "all") {
  setFeaturedFanCards(fleet.filter(fleetFilter(filter)));
  renderFanCarousel();
}

function setActiveShopFilter(filter) {
  document.querySelectorAll("[data-shop-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.shopFilter === filter);
  });
}

function scrollTypeBrowser(direction) {
  if (!typeGrid) return;
  const card = typeGrid.querySelector(".type-card");
  const distance = card ? card.getBoundingClientRect().width + 28 : typeGrid.clientWidth * 0.8;
  typeGrid.scrollBy({ left: direction * distance, behavior: "smooth" });
}

function scrollSpecials(direction) {
  if (!specialsViewport) return;
  const card = specialsViewport.querySelector(".special-card");
  const distance = card ? card.getBoundingClientRect().width + 28 : specialsViewport.clientWidth * 0.82;
  specialsViewport.scrollBy({ left: direction * distance, behavior: "smooth" });
}

function currentSpecialMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthlyFallbackCars(cars, month) {
  if (!cars.length) return [];
  const monthSeed = Number(month.replace("-", ""));
  const start = monthSeed % cars.length;
  return Array.from({ length: Math.min(2, cars.length) }, (_, index) => cars[(start + index) % cars.length]);
}

async function renderMonthlySpecials() {
  if (!specialsRail || !specialsTitle || !specialsDescription) return;
  const renderVersion = ++monthlySpecialRenderVersion;
  const fleetSnapshot = fleet.slice();
  const month = currentSpecialMonth();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${month}-02T12:00:00`));
  const configuredSpecial = isSupabaseFleetConfigured ? await loadMonthlySpecialFromSupabase(month) : null;
  if (renderVersion !== monthlySpecialRenderVersion) return;

  const carsBySlug = new Map(fleetSnapshot.map((car) => [vehicleSlug(car), car]));
  const selectedCars = Array.isArray(configuredSpecial?.car_slugs)
    ? configuredSpecial.car_slugs.map((slug) => carsBySlug.get(slug)).filter(Boolean).slice(0, 2)
    : [];
  const specialCars = selectedCars.length ? selectedCars : monthlyFallbackCars(fleetSnapshot, month);

  specialsTitle.textContent = configuredSpecial?.headline?.trim() || `${monthLabel} special`;
  specialsDescription.textContent = configuredSpecial?.description?.trim() || "This month's featured active inventory is available for delivery across Los Angeles and Orange County. Ask for current dates and rates.";

  specialsRail.innerHTML = specialCars.length
    ? specialCars
        .map(
          (car) => `
            <article class="special-card">
              <img src="${escapeHtml(primaryImageFor(car))}" alt="${escapeHtml(car.name)} monthly rental special" width="1536" height="1024" loading="lazy" />
              <div class="special-card-copy">
                <span>${escapeHtml(monthLabel)} feature</span>
                <h3>${escapeHtml(car.name.replace(/^\s*(?:19|20)\d{2}\s+/, ""))}</h3>
                <p>${escapeHtml(car.color || car.categoryLabel || car.category || "Delivery available in LA & OC")}</p>
                <a href="/cars/${escapeHtml(vehicleSlug(car))}.html">View special</a>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="specials-empty"><strong>New monthly specials are coming soon.</strong><span>Call or text us for current availability.</span></div>`;

  const hasMultiple = specialCars.length > 1;
  if (specialPrev) specialPrev.hidden = !hasMultiple;
  if (specialNext) specialNext.hidden = !hasMultiple;
}

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

function hydrateVehicleSelect() {
  if (!vehicleSelects.length) return;
  const options = fleet.map((car) => `<option>${car.name} - ${formatPrice(car.price)}/day</option>`).join("");
  const requestedVehicle = new URLSearchParams(window.location.search).get("vehicle");

  vehicleSelects.forEach((select) => {
    select.innerHTML = `<option value="">Select a vehicle</option>${options}`;
    if (!requestedVehicle) return;
    const matchingOption = [...select.options].find((option) => option.textContent.startsWith(requestedVehicle));
    if (matchingOption) select.value = matchingOption.value;
  });
}

function hydrateDiaText() {
  if (!diaText) return;

  const words = diaText.dataset.diaWords?.split(",").map((word) => word.trim()).filter(Boolean) || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (words.length < 2 || reduceMotion) return;

  let index = 0;
  window.setInterval(() => {
    diaText.classList.add("swapping");

    window.setTimeout(() => {
      index = (index + 1) % words.length;
      diaText.textContent = words[index];
      diaText.classList.remove("swapping");
    }, 220);
  }, 3000);
}

async function hydrateSupabaseFleet() {
  const remoteFleet = await withTimeout(loadFleetFromSupabase(), CLOUD_FLEET_TIMEOUT_MS, null);
  if (!Array.isArray(remoteFleet)) return false;

  // Supabase is the inventory source of truth. Bundled data only supplies
  // media for matching inventory records; it never adds extra vehicles.
  const bundledBySlug = new Map(websiteFleet.map((car) => [car.slug || slugify(car.name), car]));
  const fleetWithBundledMedia = remoteFleet.map((car) => {
    const bundled = bundledBySlug.get(car.slug || slugify(car.name));
    if (car.gallery?.length || !bundled?.gallery?.length) return car;
    return { ...car, image: bundled.image, gallery: bundled.gallery };
  });
  refreshFleetFromBase(fleetWithBundledMedia);
  return true;
}

function activeFleetFilter() {
  return document.querySelector("[data-shop-filter].active")?.dataset.shopFilter || "all";
}

function refreshFleetFromBase(nextBaseFleet = baseFleet) {
  const filter = activeFleetFilter();
  baseFleet = nextBaseFleet;
  fleet = baseFleet.slice();
  renderShopBrowsers();
  setActiveShopFilter(filter);
  renderFleet(filter);
  hydrateVehicleSelect();
  renderMonthlySpecials();
}

function observeReveals() {
  const revealEls = document.querySelectorAll(".reveal:not(.revealed)");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -40px" },
  );

  revealEls.forEach((el) => observer.observe(el));
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderFleet(button.dataset.filter);
  });
});

document.addEventListener("click", (event) => {
  const shopButton = event.target.closest("[data-shop-filter]");
  if (!shopButton) return;

  setActiveShopFilter(shopButton.dataset.shopFilter);
  renderFleet(shopButton.dataset.shopFilter);
});

fanPrev.addEventListener("click", () => cycleFan(-1));
fanNext.addEventListener("click", () => cycleFan(1));
typePrev?.addEventListener("click", () => scrollTypeBrowser(-1));
typeNext?.addEventListener("click", () => scrollTypeBrowser(1));
specialPrev?.addEventListener("click", () => scrollSpecials(-1));
specialNext?.addEventListener("click", () => scrollSpecials(1));
window.addEventListener("resize", updateFanCarousel);
window.addEventListener("storage", (event) => {
  if (event.key !== ADMIN_FLEET_REFRESH_KEY) return;
  void refreshHomeFleetFromCloud();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refreshHomeFleetFromCloud();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) void refreshHomeFleetFromCloud();
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
    header.classList.toggle("scrolled", window.scrollY > 24);
  },
  { passive: true },
);

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Sending private request...";

    window.setTimeout(() => {
      submitButton.disabled = false;
      submitButton.innerHTML =
        '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg> Send request';
      if (formStatus) formStatus.textContent = "Request captured for demo. Connect this form to email, CRM, or booking software next.";
      form.reset();
      hydrateVehicleSelect();
    }, 700);
  });
}

function localDateValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function updateQuoteProgress() {
  if (!quoteForm) return;
  const requiredFields = [...quoteForm.querySelectorAll("[required]")];
  const completed = requiredFields.filter((field) => field.value.trim() && field.checkValidity()).length;
  const percent = requiredFields.length ? Math.round((completed / requiredFields.length) * 100) : 0;

  if (quoteProgressText) quoteProgressText.textContent = `${completed} of ${requiredFields.length} details complete`;
  if (quoteProgressPercent) quoteProgressPercent.textContent = `${percent}%`;
  if (quoteProgressBar) quoteProgressBar.style.transform = `scaleX(${percent / 100})`;

  quoteForm.querySelectorAll("label").forEach((label) => {
    const field = label.querySelector("input:not([type='checkbox']), select, textarea");
    if (!field || !field.name || field.name === "company") return;
    label.classList.toggle("is-complete", Boolean(field.value.trim()) && field.checkValidity());
  });

  quoteForm.querySelectorAll(".quote-addons label").forEach((label) => {
    label.classList.toggle("is-selected", Boolean(label.querySelector("input")?.checked));
  });
}

function initQuoteTyping() {
  if (!quoteTyping) return;
  const fullText = "A concierge will review your request before anything is confirmed.";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timerId = 0;
  let started = false;
  let interrupted = false;

  const finish = () => {
    window.clearTimeout(timerId);
    quoteTyping.textContent = fullText;
    quoteTyping.closest(".quote-typing-line")?.classList.add("typing-complete");
  };

  const typeNext = (index = 0) => {
    if (interrupted || index >= fullText.length) {
      finish();
      return;
    }
    quoteTyping.textContent = fullText.slice(0, index + 1);
    timerId = window.setTimeout(() => typeNext(index + 1), index < 11 ? 34 : 22);
  };

  const start = () => {
    if (started) return;
    started = true;
    if (reduceMotion) {
      finish();
      return;
    }
    quoteTyping.textContent = "";
    typeNext();
  };

  quoteForm?.addEventListener("focusin", () => {
    interrupted = true;
    finish();
  }, { once: true });

  if (!("IntersectionObserver" in window)) {
    start();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    start();
  }, { threshold: 0.35 });
  observer.observe(quoteTyping.closest(".quote-section") || quoteTyping);
}

if (quoteForm) {
  const rentalDate = quoteForm.elements.date;
  if (rentalDate) rentalDate.min = localDateValue();

  quoteForm.addEventListener("input", (event) => {
    updateQuoteProgress();
    const field = event.target.closest("input:not([type='checkbox']), select, textarea");
    if (!field || !field.required || !field.checkValidity()) return;
    field.removeAttribute("aria-invalid");
    field.closest("label")?.classList.remove("is-invalid");
  });
  quoteForm.addEventListener("change", updateQuoteProgress);
  quoteForm.addEventListener("focusout", (event) => {
    const field = event.target.closest("input:not([type='checkbox']), select, textarea");
    if (!field || !field.required) return;
    field.setAttribute("aria-invalid", String(!field.checkValidity()));
    field.closest("label")?.classList.toggle("is-invalid", !field.checkValidity());
  });

  initQuoteTyping();
  window.setTimeout(updateQuoteProgress, 0);

  quoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = quoteForm.querySelector("button[type='submit']");
    const formData = new FormData(quoteForm);
    const addons = ["photographer", "delivery", "chauffeur"]
      .filter((addon) => formData.get(addon))
      .map((addon) => addon.charAt(0).toUpperCase() + addon.slice(1));

    submitButton.disabled = true;
    submitButton.textContent = "Sending request...";
    submitButton.classList.add("is-sending");
    quoteForm.setAttribute("aria-busy", "true");
    if (quoteStatus) {
      quoteStatus.dataset.tone = "";
      quoteStatus.textContent = "Saving your quote request...";
    }

    const payload = {
      source: "homepage-private-quote",
      name: formData.get("name") || "",
      phone: formData.get("phone") || "",
      email: formData.get("email") || "",
      insuranceProvider: formData.get("insuranceProvider") || "",
      date: formData.get("date") || "",
      vehicle: formData.get("vehicle") || "Vehicle TBD",
      addons,
      message: formData.get("message") || "",
      company: formData.get("company") || "",
      pageUrl: window.location.href,
    };

    try {
      const result = await submitQuoteRequest(payload);

      try {
        const storedRequests = JSON.parse(localStorage.getItem(CRM_REQUESTS_KEY)) || [];
        storedRequests.unshift({
          id: result.id || `quote-${Date.now()}`,
          name: payload.name || "Website lead",
          phone: payload.phone || "",
          email: payload.email || "",
          insuranceProvider: payload.insuranceProvider || "",
          vehicle: payload.vehicle || "Vehicle TBD",
          date: payload.date || "",
          addons,
          message: payload.message || "",
          status: "new",
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(CRM_REQUESTS_KEY, JSON.stringify(storedRequests));
      } catch {
        // Local mirror is best-effort only; Supabase is the source of truth.
      }

      if (quoteStatus) {
        quoteStatus.dataset.tone = "success";
        quoteStatus.textContent = "Private request received. A concierge will follow up shortly.";
      }
      quoteForm.reset();
      hydrateVehicleSelect();
      quoteForm.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
      quoteForm.querySelectorAll(".is-invalid").forEach((label) => label.classList.remove("is-invalid"));
      window.setTimeout(updateQuoteProgress, 0);
    } catch (error) {
      if (quoteStatus) {
        quoteStatus.dataset.tone = "error";
        quoteStatus.textContent = error.message || "We could not save this request. Please call or text us directly.";
      }
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove("is-sending");
      quoteForm.removeAttribute("aria-busy");
      submitButton.textContent = "Send Private Request";
    }
  });
}

let baseFleet = fleet.slice();
hydrateDiaText();
observeReveals();
initLazyMedia();

async function initFleetSections() {
  // Never hide usable inventory behind a cloud request. The bundled fleet is
  // generated from the active website inventory and can render immediately;
  // Supabase then refreshes it in place when the latest records arrive.
  refreshFleetFromBase();

  if (!isSupabaseFleetConfigured) {
    return;
  }

  await refreshHomeFleetFromCloud();
}

async function refreshHomeFleetFromCloud() {
  if (!isSupabaseFleetConfigured) return false;
  if (cloudHomeRefreshPromise) return cloudHomeRefreshPromise;

  cloudHomeRefreshPromise = hydrateSupabaseFleet()
    .catch((error) => {
      console.warn("Could not refresh cloud fleet:", error);
      return false;
    })
    .finally(() => {
      cloudHomeRefreshPromise = null;
    });

  return cloudHomeRefreshPromise;
}

initFleetSections();
