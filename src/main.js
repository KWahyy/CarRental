import './brand-carousel.js';
import { readTripSearch } from './rental-search.js';
import { brandFor, sortBrands } from './vehicle-brands.js';
import { fleet as websiteFleet } from "./live-fleet.js";
import { cacheSafeFleetImageUrl, fleetPictureMarkup, isSupabaseFleetConfigured, loadMonthlySpecialFromSupabase, optimizedFleetImageUrl } from "./supabase-fleet.js?v=native-picture-flow-20260901";
import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260906";

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
    image: "/assets/prestige-luxor-hero.png",
    tags: ["Shelter Green / Level kit + wheels...", "$200.00 3-5 days", "$175.00 6-7 days"],
  },
  {
    name: "2020 Lamborghini Urus",
    category: "suv luxury",
    price: 750,
    mileage: "100 miles/day",
    image: "/assets/prestige-luxor-hero.png",
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
    image: "/assets/prestige-luxor-hero.png",
    tags: ["Torch Red / exhaust / splitter", "$225.00 3-5 days", "$200.00 6-7 days"],
  },
];

const fanStage = document.querySelector("[data-fan-stage]");
const fanPrev = document.querySelector("[data-fan-prev]");
const fanNext = document.querySelector("[data-fan-next]");
const fanDots = document.querySelector("[data-fan-dots]");
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
const form = document.querySelector(".booking-form");
const formStatus = document.querySelector("[data-form-status]");
const quoteForm = document.querySelector("[data-quote-form]");
const quoteStatus = document.querySelector("[data-quote-status]");
const quoteTyping = document.querySelector("[data-quote-typing]");
const quoteProgressText = document.querySelector("[data-quote-progress-text]");
const quoteProgressPercent = document.querySelector("[data-quote-progress-percent]");
const quoteProgressBar = document.querySelector("[data-quote-progress-bar]");
const quoteOptional = document.querySelector("[data-quote-optional]");
const CRM_REQUESTS_KEY = "prestige-luxor-crm-requests";
const diaText = document.querySelector("[data-dia-words]");
const BEST_FAN_LIMIT = 9;
let monthlySpecialRenderVersion = 0;
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

let fanCards = getFeaturedFanCards(fleet);

let fanCenterIndex = Math.floor(fanCards.length / 2);
let fanPointer = null;
let fanDidDrag = false;

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

  if (!logos[brand]) return `<span class="brand-logo-text">${escapeHtml(brand)}</span>`;

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

function originalImageFor(car) {
  if (!car) return "/assets/prestige-luxor-hero.png";
  const image = car.image || car.gallery?.[0] || "/assets/prestige-luxor-hero.png";
  return cacheSafeFleetImageUrl(image, car.updatedAt || car.updated_at);
}

function primaryImageFor(car) {
  return optimizedFleetImageUrl(originalImageFor(car), {
    width: 1200,
    height: 900,
    quality: 78,
    updatedAt: car?.updatedAt || car?.updated_at || "",
  });
}

function isUsableFanCar(car) {
  if (!car) return false;
  const image = primaryImageFor(car);
  return car?.name && vehicleSlug(car) && image && !image.includes("prestige-luxor-hero");
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
    source: originalImageFor(car),
    updatedAt: car.updatedAt || car.updated_at || "",
  }));
}

function setFeaturedFanCards(sourceFleet = fleet) {
  fanCards = getFeaturedFanCards(sourceFleet);
  fanCenterIndex = window.matchMedia("(max-width: 820px)").matches ? 0 : Math.floor(fanCards.length / 2);
}

function shortestFanOffset(index) {
  const total = fanCards.length;
  let offset = index - fanCenterIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

function updateFanCarousel() {
  if (!fanStage) return;
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

  const stageWidth = fanStage.getBoundingClientRect().width;
  const mobileStep = Math.max(stageWidth - 72, 250);

  fanItems.forEach((card, index) => {
    const offset = shortestFanOffset(index);
    const isCurrent = offset === 0;
    const isPreview = offset === 1;
    const isVisible = isCurrent || isPreview;

    card.style.setProperty("--fan-x", `${offset * mobileStep}px`);
    card.style.setProperty("--fan-y", "0px");
    card.style.setProperty("--fan-rot", "0deg");
    card.style.setProperty("--fan-scale", isCurrent ? "1" : "0.94");
    card.style.setProperty("--fan-opacity", isVisible ? "1" : "0");
    card.style.zIndex = isCurrent ? "2" : isPreview ? "1" : "0";
    card.setAttribute("aria-hidden", String(!isCurrent));
    card.setAttribute("aria-current", isCurrent ? "true" : "false");
    card.tabIndex = isCurrent ? 0 : -1;
  });

  const currentCount = fanDots.querySelector("[data-fan-current]");
  if (currentCount) currentCount.textContent = String(fanCenterIndex + 1);
  fanDots.style.setProperty("--fan-progress", String((fanCenterIndex + 1) / Math.max(fanCards.length, 1)));
}

function cycleFan(direction) {
  if (!fanCards.length) return;
  fanCenterIndex = (fanCenterIndex + direction + fanCards.length) % fanCards.length;
  updateFanCarousel();
}

function renderFanCarousel() {
  if (!fanStage) return;
  fanStage.innerHTML = fanCards
    .map(
      (car) => `
        <a class="fan-card" href="/cars/${vehicleSlug(car)}.html" aria-label="View ${car.name}">
          ${fleetPictureMarkup(car.source, { alt: car.name, width: 500, height: 375, quality: 74, updatedAt: car.updatedAt, loading: "lazy" })}
          <span class="fan-card-copy"><small>Featured vehicle</small><strong>${vehicleLabel(car)}</strong><b>View vehicle <i aria-hidden="true">→</i></b></span>
        </a>
      `,
    )
    .join("");

  fanDots.innerHTML = `<div class="fan-count"><b data-fan-current>${fanCenterIndex + 1}</b> of ${fanCards.length}</div>`;
  updateFanCarousel();
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
  if (!fanStage) return;
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
  fanDots.innerHTML = '<div class="fan-count fan-count-loading">Loading vehicles…</div>';
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
  const firstTag = Array.isArray(car?.tags) ? car.tags.find((tag) => typeof tag === "string" && tag.trim()) : "";
  return String(firstTag || "").replace("...", "").replace(/\s+/g, " ").trim();
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
  if (!fanStage) { document.dispatchEvent(new CustomEvent("home-fleet-filter", { detail: filter })); return; }
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
  const gap = Number.parseFloat(getComputedStyle(typeGrid).columnGap) || 0;
  const distance = card ? card.getBoundingClientRect().width + gap : typeGrid.clientWidth;
  typeGrid.scrollBy({ left: direction * distance, behavior: "smooth" });
}

function scrollSpecials(direction) {
  if (!specialsViewport) return;
  const rail = specialsViewport.querySelector(".specials-rail");
  const card = rail?.querySelector(".special-card");
  const gap = rail ? Number.parseFloat(getComputedStyle(rail).columnGap) || 0 : 0;
  const distance = card ? card.getBoundingClientRect().width + gap : specialsViewport.clientWidth;
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

function monthlySpecialRate(car) {
  const original = Math.max(Number(car?.price || 0), 0);
  return { original, discounted: Math.round(original * 0.9) };
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
  const specialCars = isSupabaseFleetConfigured ? selectedCars : monthlyFallbackCars(fleetSnapshot, month);

  specialsTitle.textContent = configuredSpecial?.headline?.trim() || `${monthLabel} special`;
  specialsDescription.textContent = configuredSpecial?.description?.trim() || "This month's featured active inventory is available for delivery across Los Angeles and Orange County. Ask for current dates and rates.";

  specialsRail.innerHTML = specialCars.length
    ? specialCars
        .map((car) => {
          const rate = monthlySpecialRate(car);
          return `
            <article class="special-card">
              ${fleetPictureMarkup(originalImageFor(car), { alt: `${car.name} monthly rental special`, width: 1200, height: 900, quality: 78, updatedAt: car.updatedAt || car.updated_at, loading: "lazy" })}
              <div class="special-card-copy">
                <span>${escapeHtml(monthLabel)} feature</span>
                <h3>${escapeHtml(car.name.replace(/^\s*(?:19|20)\d{2}\s+/, ""))}</h3>
                <p>${escapeHtml(car.color || car.categoryLabel || car.category || "Delivery available in LA & OC")}</p>
                <div class="special-card-offer"><b>10% off</b><div><del>$${rate.original.toLocaleString()}</del><strong>$${rate.discounted.toLocaleString()}</strong><small>/day</small></div></div>
                <a href="/cars/${escapeHtml(vehicleSlug(car))}.html">View special</a>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="specials-empty"><strong>New monthly specials are coming soon.</strong><span>Call or text us for current availability.</span></div>`;


  const hasMultiple = specialCars.length > 1;
  if (specialPrev) specialPrev.hidden = !hasMultiple;
  if (specialNext) specialNext.hidden = !hasMultiple;
}

function renderShopBrowsers() {
  const brands = sortBrands(fleet.map(brandFor));
  const availableTypes = new Set(fleet.map(bodyTypeFor));
  const types = ["SUV", "Convertible", "Coupe", "Sedan", "Truck"].filter((type) => availableTypes.has(type));
  types.push("All");

  brandGrid.innerHTML = brands
    .map((brand) => {
      const count = fleet.filter((car) => brandFor(car) === brand).length;
      return `
        <button class="shop-tile brand-tile" type="button" data-shop-filter="brand:${escapeHtml(brand)}">
          ${brandMark(brand)}
          <span class="brand-name">${escapeHtml(brand)}</span>
          <strong>${count} ${count === 1 ? "car" : "cars"}</strong>
        </button>
      `;
    })
    .join("");

  brandDots.innerHTML = brands.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("");

  if (typeGrid) typeGrid.innerHTML = types
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
    const previousValue = select.value;
    select.innerHTML = `<option value="">Select a vehicle</option>${options}`;
    if ([...select.options].some(option => option.value === previousValue)) select.value = previousValue;
    if (!requestedVehicle) return;
    const matchingOption = [...select.options].find((option) => option.textContent.startsWith(requestedVehicle));
    if (matchingOption) select.value = matchingOption.value;
  });
  updateReservationPreview();
}

function hydrateDiaText() {
  if (!diaText) return;

  const words = diaText.dataset.diaWords?.split(",").map((word) => word.trim()).filter(Boolean) || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (words.length < 2 || reduceMotion) return;

  const phrase = diaText.querySelector("[data-arrival-current]") || diaText;
  let index = 0;
  window.setInterval(() => {
    diaText.classList.add("swapping");

    window.setTimeout(() => {
      index = (index + 1) % words.length;
      phrase.textContent = words[index];
      diaText.classList.remove("swapping");
    }, 220);
  }, 3000);
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

fanPrev?.addEventListener("click", () => cycleFan(-1));
fanNext?.addEventListener("click", () => cycleFan(1));
fanStage?.addEventListener("pointerdown", (event) => {
  if (!window.matchMedia("(max-width: 820px)").matches || !event.isPrimary) return;
  fanPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  fanDidDrag = false;
  fanStage.setPointerCapture?.(event.pointerId);
  fanStage.classList.add("is-dragging");
});
fanStage?.addEventListener("pointermove", (event) => {
  if (!fanPointer || event.pointerId !== fanPointer.id) return;
  const deltaX = event.clientX - fanPointer.x;
  const deltaY = event.clientY - fanPointer.y;
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
  fanDidDrag = Math.abs(deltaX) > 8;
  const activeCard = fanStage.querySelector('.fan-card[aria-current="true"]');
  activeCard?.style.setProperty("--fan-drag-x", `${Math.max(-72, Math.min(72, deltaX * 0.42))}px`);
});
const finishFanSwipe = (event) => {
  if (!fanPointer || event.pointerId !== fanPointer.id) return;
  const deltaX = event.clientX - fanPointer.x;
  const deltaY = event.clientY - fanPointer.y;
  fanStage.querySelectorAll(".fan-card").forEach((card) => card.style.removeProperty("--fan-drag-x"));
  fanStage.classList.remove("is-dragging");
  fanPointer = null;
  if (Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY)) cycleFan(deltaX < 0 ? 1 : -1);
};
fanStage?.addEventListener("pointerup", finishFanSwipe);
fanStage?.addEventListener("pointercancel", finishFanSwipe);
fanStage?.addEventListener("click", (event) => {
  if (!fanDidDrag) return;
  event.preventDefault();
  fanDidDrag = false;
}, true);
typePrev?.addEventListener("click", () => scrollTypeBrowser(-1));
typeNext?.addEventListener("click", () => scrollTypeBrowser(1));
specialPrev?.addEventListener("click", () => scrollSpecials(-1));
specialNext?.addEventListener("click", () => scrollSpecials(1));
window.addEventListener("resize", updateFanCarousel);

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
  const fullText = "Our team will contact you to confirm your car, dates, and final price.";
  quoteTyping.textContent = fullText;
  quoteTyping.closest(".quote-typing-line")?.classList.add("typing-complete");
}

function syncReservationCarPicker() {
  const trigger = quoteForm?.querySelector('[data-car-trigger]');
  if (!trigger) return;
  const value = quoteForm.elements.vehicle.value;
  const car = fleet.find(car => value === `${car.name} - ${formatPrice(car.price)}/day` || value === car.name);
  quoteForm.querySelector('#reservation-car-choice').textContent = car ? car.name.replace(/^\d{4}\s+/, '') : 'Search by make or model';
  trigger.classList.toggle('has-selection',Boolean(car));
}

if (quoteForm?.querySelector('[data-car-picker]')) {
  const picker = quoteForm.querySelector('[data-car-picker]');
  const trigger = picker.querySelector('[data-car-trigger]');
  const panel = picker.querySelector('[data-car-panel]') || picker.querySelector('#reservation-car-panel');
  const search = picker.querySelector('[data-car-search]');
  const results = picker.querySelector('[data-car-results]');
  const close = (focus = false) => { panel.hidden = true; trigger.setAttribute('aria-expanded','false'); if (focus) trigger.focus(); };
  const render = () => {
    const terms = search.value.toLowerCase().trim().split(/\s+/);
    const cars = fleet.filter(car => terms.every(term => car.name.toLowerCase().includes(term)));
    results.replaceChildren();
    for (const car of cars) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'reservation-car-result';
      const img = document.createElement('img'); img.src = cacheSafeFleetImageUrl(car.image); img.alt = ''; img.width = 88; img.height = 60; img.loading = 'lazy';
      const text = document.createElement('span'); text.textContent = car.name.replace(/^\d{4}\s+/, '');
      const value = `${car.name} - ${formatPrice(car.price)}/day`;
      button.setAttribute('aria-pressed',String(quoteForm.elements.vehicle.value === value));
      button.append(img,text);
      button.addEventListener('click', () => {
        const select = quoteForm.elements.vehicle;
        if (![...select.options].some(option => option.value === value)) select.add(new Option(value,value));
        select.value = value;
        quoteForm.elements.vehicle.dispatchEvent(new Event('change',{bubbles:true}));
        picker.querySelector('[data-car-error]').hidden = true;
        trigger.removeAttribute('aria-invalid'); close(true);
      });
      results.append(button);
    }
    picker.querySelector('[data-car-empty]').hidden = cars.length > 0;
  };
  trigger.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    search.value = ''; render(); panel.hidden = false; trigger.setAttribute('aria-expanded','true'); search.focus();
  });
  search.addEventListener('input',render);
  picker.addEventListener('keydown', event => {
    if (panel.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (event.target === search && event.key === 'Enter') { event.preventDefault(); results.querySelector('button')?.click(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); const buttons = [...results.querySelectorAll('button')];
      const current = buttons.indexOf(document.activeElement);
      buttons[Math.max(0,Math.min(buttons.length-1,current+(event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    }
    event.stopPropagation();
  });
  picker.addEventListener('focusout', event => { if (event.relatedTarget && !picker.contains(event.relatedTarget)) close(); });
  document.addEventListener('click', event => { if (!picker.contains(event.target)) close(); });
}

function updateReservationPreview() {
  if (!quoteForm?.querySelector('[data-reservation-step]')) return;
  syncReservationCarPicker();
  const choice = quoteForm.elements.vehicle.value;
  const car = fleet.find(car => choice === `${car.name} - ${formatPrice(car.price)}/day` || choice === car.name);
  const image = document.querySelector('[data-reservation-image]');
  document.querySelector('[data-reservation-car]').textContent = car?.name || 'It starts with the right car.';
  document.querySelector('[data-reservation-price]').textContent = car ? `From ${formatPrice(car.price)}/day · Final pricing confirmed personally` : 'Choose from our current collection.';
  if (car?.image) { image.src = cacheSafeFleetImageUrl(car.image); image.alt = car.name; image.hidden = false; }
  else { image.hidden = true; image.removeAttribute('src'); }
}

if (quoteForm?.querySelector('[data-reservation-step]')) {
  const first = quoteForm.querySelector('[data-reservation-step="1"]');
  const second = quoteForm.querySelector('[data-reservation-step="2"]');
  const trip = readTripSearch(location.search);
  quoteForm.elements.date.value = trip.pickup;
  quoteForm.elements.returnDate.value = trip.returnDate;
  const syncDatePlaceholders = () => {
    for (const name of ['date', 'returnDate']) {
      const field = quoteForm.elements[name];
      field.toggleAttribute('data-empty', !field.value);
    }
  };
  quoteForm.addEventListener('input', syncDatePlaceholders);
  quoteForm.addEventListener('change', syncDatePlaceholders);
  window.addEventListener('pageshow', syncDatePlaceholders);
  syncDatePlaceholders();
  const validateDates = () => {
    const pickup = quoteForm.elements.date, end = quoteForm.elements.returnDate;
    end.min = pickup.value || localDateValue();
    end.setCustomValidity(end.value && pickup.value && end.value <= pickup.value ? 'Choose a return date after your pickup date.' : '');
  };
  const showStep = step => {
    first.hidden = step === 2;
    second.hidden = step === 1;
    second.querySelectorAll('input').forEach(input => input.disabled = step === 1);
    quoteForm.querySelectorAll('[data-reservation-step-label]').forEach(label => {
      if (Number(label.dataset.reservationStepLabel) === step) label.setAttribute('aria-current','step');
      else label.removeAttribute('aria-current');
    });
    if (step === 2) {
      const format = value => value ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`)) : '';
      quoteForm.querySelector('[data-reservation-summary]').textContent = `${quoteForm.elements.vehicle.value} · ${format(quoteForm.elements.date.value)}${quoteForm.elements.returnDate.value ? ' – '+format(quoteForm.elements.returnDate.value) : ''}`;
      quoteForm.elements.name.focus();
    } else quoteForm.querySelector('[data-car-trigger]').focus();
  };
  quoteForm.querySelector('[data-reservation-next]').addEventListener('click', () => {
    validateDates();
    if (!quoteForm.elements.vehicle.value) {
      quoteForm.querySelector('[data-car-error]').hidden = false;
      const trigger = quoteForm.querySelector('[data-car-trigger]');
      trigger.setAttribute('aria-invalid','true'); trigger.focus(); return;
    }
    const invalid = [...first.querySelectorAll('input,select')].find(field => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    showStep(2);
  });
  quoteForm.querySelector('[data-reservation-back]').addEventListener('click', () => showStep(1));
  quoteForm.addEventListener('change', () => { validateDates(); updateReservationPreview(); });
  quoteForm.addEventListener('invalid', event => {
    if (first.contains(event.target) && first.hidden) showStep(1);
  },true);
  quoteForm.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !first.hidden && event.target.tagName === 'INPUT') {
      event.preventDefault(); quoteForm.querySelector('[data-reservation-next]').click();
    }
  });
  document.querySelector('[data-reservation-image]')?.addEventListener('error', event => { event.target.hidden = true; });
  validateDates();
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
    if (quoteForm.querySelector('[data-reservation-step="2"]')?.hidden) {
      quoteForm.querySelector('[data-reservation-next]').click();
      return;
    }
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
      quoteStatus.textContent = "Submitting your reservation request...";
    }

    const payload = {
      source: "homepage-private-quote",
      name: formData.get("name") || "",
      phone: formData.get("phone") || "",
      email: formData.get("email") || "",
      date: formData.get("date") || "",
      vehicle: formData.get("vehicle") || "Vehicle TBD",
      addons,
      message: [formData.get("message"), formData.get("returnDate") && `Return date: ${formData.get("returnDate")}`, readTripSearch(location.search).city && `Delivery city: ${readTripSearch(location.search).city}`].filter(Boolean).join('\n'),
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
        quoteStatus.textContent = `Reservation request received for ${payload.vehicle}. Pending confirmation — a Prestige Luxor team member will contact you to confirm availability, the final price, and next steps. No payment has been taken.`;
      }
      quoteForm.querySelectorAll("input, select, textarea").forEach(field => { field.disabled = true; });
      const back = quoteForm.querySelector('[data-reservation-back]');
      if (back) back.hidden = true;
      quoteForm.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
      quoteForm.querySelectorAll(".is-invalid").forEach((label) => label.classList.remove("is-invalid"));
      window.setTimeout(updateQuoteProgress, 0);
    } catch (error) {
      if (quoteStatus) {
        quoteStatus.dataset.tone = "error";
        quoteStatus.textContent = error.message || "We could not save this request. Please call or text us directly.";
      }
    } finally {
      submitButton.disabled = quoteStatus?.dataset.tone === "success";
      submitButton.classList.remove("is-sending");
      quoteForm.removeAttribute("aria-busy");
      submitButton.textContent = quoteStatus?.dataset.tone === "success" ? "Request received" : "Request reservation";
    }
  });
}

if (quoteOptional) {
  quoteOptional.querySelector('summary')?.addEventListener('click', () => {
    if (!quoteOptional.dataset.interacted && window.matchMedia('(max-width: 640px)').matches) quoteOptional.open = false;
    quoteOptional.dataset.interacted = 'true';
  });
}

let baseFleet = fleet.slice();
hydrateDiaText();
initLazyMedia();

function initFleetSections() {
  // Server-rendered sections already contain the response inventory.
  if (!document.documentElement.dataset.publicRendered) refreshFleetFromBase();
}

initFleetSections();
