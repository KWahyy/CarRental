import { ADMIN_FLEET_REFRESH_KEY } from "./admin-store.js?v=cloud-no-flash-20260626";
import { isSupabaseFleetConfigured, loadFleetFromSupabase } from "./supabase-fleet.js?v=cloud-no-flash-20260626";

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
const brandGrid = document.querySelector("[data-brand-grid]");
const brandDots = document.querySelector("[data-brand-dots]");
const typeGrid = document.querySelector("[data-type-grid]");
const typePrev = document.querySelector("[data-type-prev]");
const typeNext = document.querySelector("[data-type-next]");
const specialsViewport = document.querySelector("[data-specials-viewport]");
const specialPrev = document.querySelector("[data-special-prev]");
const specialNext = document.querySelector("[data-special-next]");
const vehicleSelects = document.querySelectorAll("[data-vehicle-select]");
const filterButtons = document.querySelectorAll("[data-filter]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const header = document.querySelector("[data-header]");
const form = document.querySelector(".booking-form");
const formStatus = document.querySelector("[data-form-status]");
const quoteForm = document.querySelector("[data-quote-form]");
const quoteStatus = document.querySelector("[data-quote-status]");
const CRM_REQUESTS_KEY = "kds-crm-requests";
const diaText = document.querySelector("[data-dia-words]");

let fanCards = [
  {
    slug: "2022-lamborghini-huracan",
    name: "2022 Lamborghini Huracan",
    image: "/assets/fleet/2022-lamborghini-huracan.jpg",
  },
  {
    slug: "2016-ferrari-488-gtb",
    name: "2016 Ferrari 488 GTB",
    image: "/assets/fleet/2016-ferrari-488-gtb.jpg",
  },
  {
    slug: "2017-audi-r8",
    name: "2017 Audi R8",
    image: "/assets/fleet/2017-audi-r8.jpg?v=sharp-20260620",
  },
  {
    slug: "2015-lamborghini-huracan-lp-610-4",
    name: "2015 Lamborghini Huracan LP-610-4",
    image: "/assets/fleet/2015-lamborghini-huracan-lp-610-4.jpg",
  },
  {
    slug: "2018-mclaren-570s-spider",
    name: "2018 McLaren 570s Spider",
    image: "/assets/fleet/2018-mclaren-570s-spider.jpg?v=sharp-20260620",
  },
  {
    slug: "2022-porsche-911-carrera",
    name: "2022 Porsche 911 Carrera",
    image: "/assets/fleet/2022-porsche-911-carrera.jpg",
  },
  {
    slug: "2024-bmw-m4-comp",
    name: "2024 BMW M4-Comp",
    image: "/assets/fleet/2024-bmw-m4-comp.jpg",
  },
  {
    slug: "2021-bmw-m3-comp",
    name: "2021 BMW M3 Comp",
    image: "/assets/fleet/2021-bmw-m3-comp.jpg?v=sharp-20260620",
  },
];

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
  const brands = ["Lamborghini", "Mercedes", "McLaren", "Cadillac", "Porsche", "Ferrari", "Chevy", "Ford", "Audi", "BMW"];
  return brands.find((brand) => car.name.includes(brand)) || car.name.split(" ")[1] || "Other";
}

function brandMark(brand) {
  const logos = {
    Audi: "https://cdn.simpleicons.org/audi/ffffff",
    BMW: "https://cdn.simpleicons.org/bmw/ffffff",
    Cadillac: "https://cdn.simpleicons.org/cadillac/ffffff",
    Chevy: "https://cdn.simpleicons.org/chevrolet/ffffff",
    Ferrari: "https://cdn.simpleicons.org/ferrari/ffffff",
    Ford: "https://cdn.simpleicons.org/ford/ffffff",
    Lamborghini: "https://cdn.simpleicons.org/lamborghini/ffffff",
    McLaren: "https://cdn.simpleicons.org/mclaren/ffffff",
    Porsche: "https://cdn.simpleicons.org/porsche/ffffff",
  };

  if (brand === "Mercedes") {
    return `
      <svg class="brand-logo-mark" aria-hidden="true" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" />
        <path d="M32 9v23l18 14M32 32 14 46M32 32l18 14" />
      </svg>
    `;
  }

  if (!logos[brand]) return `<span class="brand-logo-text">${brand}</span>`;

  return `<img class="brand-logo-mark" src="${logos[brand]}" alt="" loading="lazy" width="104" height="104" />`;
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

function vehicleSlug(car) {
  return car.slug || slugify(car.name);
}

function vehicleLabel(car) {
  return car.name.replace(/^\d{4}\s+/, "");
}

function fanMultiplier() {
  const width = window.innerWidth;
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
          <img src="${car.image}" alt="${car.name}" loading="lazy" width="500" height="760" onerror="this.onerror=null;this.src='/assets/kds-hero.png';" />
          <span>${vehicleLabel(car)}</span>
        </a>
      `,
    )
    .join("");

  fanDots.innerHTML = fanCards.map((_, index) => `<span class="${index === fanCenterIndex ? "active" : ""}"></span>`).join("");
  updateFanCarousel();
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
  const visibleCars = fleet.filter(fleetFilter(filter));
  fanCards = visibleCars.map((car) => ({ slug: car.slug, name: car.name, image: car.image }));
  fanCenterIndex = Math.floor(fanCards.length / 2);
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
  const remoteFleet = await loadFleetFromSupabase();
  if (!remoteFleet) return false;

  refreshFleetFromBase(remoteFleet);
  return true;
}

function activeFleetFilter() {
  return document.querySelector("[data-shop-filter].active")?.dataset.shopFilter || "all";
}

function refreshFleetFromBase(nextBaseFleet = baseFleet) {
  const filter = activeFleetFilter();
  baseFleet = nextBaseFleet;
  fleet = baseFleet.slice();
  fanCards = fleet.slice(0, 8).map((car) => ({ slug: car.slug, name: car.name, image: car.image }));
  fanCenterIndex = Math.floor(fanCards.length / 2);
  renderShopBrowsers();
  setActiveShopFilter(filter);
  renderFleet(filter);
  hydrateVehicleSelect();
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
  hydrateSupabaseFleet();
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
    submitButton.textContent = "Sending request...";

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

if (quoteForm) {
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = quoteForm.querySelector("button[type='submit']");
    const formData = new FormData(quoteForm);
    const addons = ["photographer", "delivery", "chauffeur"]
      .filter((addon) => formData.get(addon))
      .map((addon) => addon.charAt(0).toUpperCase() + addon.slice(1));

    try {
      const storedRequests = JSON.parse(localStorage.getItem(CRM_REQUESTS_KEY)) || [];
      storedRequests.unshift({
        id: `quote-${Date.now()}`,
        name: formData.get("name") || "Website lead",
        phone: formData.get("phone") || "",
        vehicle: formData.get("vehicle") || "Vehicle TBD",
        date: formData.get("date") || "",
        addons,
        message: formData.get("message") || "",
        status: "new",
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(CRM_REQUESTS_KEY, JSON.stringify(storedRequests));
    } catch {
      // Local CRM storage is best-effort until quote requests are moved to Supabase.
    }

    submitButton.disabled = true;
    submitButton.textContent = "Preparing quote...";

    window.setTimeout(() => {
      submitButton.disabled = false;
      submitButton.textContent = "Request Quote";
      if (quoteStatus) quoteStatus.textContent = "Quote request saved. The admin CRM can review it under Requests.";
      quoteForm.reset();
      hydrateVehicleSelect();
    }, 700);
  });
}

let baseFleet = fleet.slice();
hydrateDiaText();
observeReveals();

async function initFleetSections() {
  if (!isSupabaseFleetConfigured) {
    refreshFleetFromBase();
    return;
  }

  renderFleetLoading();
  try {
    const hydrated = await hydrateSupabaseFleet();
    if (!hydrated) refreshFleetFromBase();
  } catch (error) {
    console.warn("Could not initialize cloud fleet:", error);
    refreshFleetFromBase();
  }
}

initFleetSections();
