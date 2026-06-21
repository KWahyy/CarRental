const fleet = [
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

const fleetGrid = document.querySelector("[data-fleet-grid]");
const vehicleSelect = document.querySelector("[data-vehicle-select]");
const filterButtons = document.querySelectorAll("[data-filter]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const header = document.querySelector("[data-header]");
const form = document.querySelector(".booking-form");
const formStatus = document.querySelector("[data-form-status]");

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatCategory(category) {
  const label = category.split(" ")[0];
  return label === "suv" ? "SUV" : label;
}

function renderFleet(filter = "all") {
  const visibleCars = fleet.filter((car) => filter === "all" || car.category.includes(filter));

  fleetGrid.innerHTML = visibleCars
    .map(
      (car) => `
        <article class="car-card reveal" data-category="${car.category}">
          <div class="car-image-wrap">
            <img
              src="${car.image}"
              alt="${car.name}"
              loading="lazy"
              width="1000"
              height="667"
              onerror="this.onerror=null;this.src='/assets/kds-hero.png';"
            />
            <span>${car.mileage}</span>
          </div>
          <div class="car-card-body">
            <p class="car-category">${formatCategory(car.category)}</p>
            <h3>${car.name}</h3>
            <div class="car-meta">
              <strong>${formatPrice(car.price)}<small>/day</small></strong>
              <a href="#booking" aria-label="Request ${car.name}">Request</a>
            </div>
            <div class="tag-row">
              ${car.tags.map((tag) => `<span>${tag}</span>`).join("")}
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  observeReveals();
}

function hydrateVehicleSelect() {
  vehicleSelect.innerHTML = fleet.map((car) => `<option>${car.name} - ${formatPrice(car.price)}/day</option>`).join("");
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Sending request...";

  window.setTimeout(() => {
    submitButton.disabled = false;
    submitButton.innerHTML =
      '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg> Send request';
    formStatus.textContent = "Request captured for demo. Connect this form to email, CRM, or booking software next.";
    form.reset();
    hydrateVehicleSelect();
  }, 700);
});

renderFleet();
hydrateVehicleSelect();
observeReveals();
