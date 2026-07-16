const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const form = document.querySelector("[data-partner-form]");
const status = document.querySelector("[data-partner-status]");
const reveals = document.querySelectorAll(".reveal");

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add("revealed"));
}

function valueOf(formData, key) {
  return String(formData.get(key) || "").trim();
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const lines = [
      "New KD's Exotics private vehicle review",
      "",
      `Name: ${valueOf(formData, "name")}`,
      `Phone: ${valueOf(formData, "phone")}`,
      `Email: ${valueOf(formData, "email")}`,
      `Vehicle: ${valueOf(formData, "vehicle")}`,
      `Year: ${valueOf(formData, "year") || "Not provided"}`,
      `Mileage: ${valueOf(formData, "mileage") || "Not provided"}`,
      `Availability: ${valueOf(formData, "availability")}`,
      "",
      "Notes:",
      valueOf(formData, "notes") || "Not provided",
    ];

    const subject = encodeURIComponent("KD's Exotics Private Vehicle Review");
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:bookings@kdsexotics.com?subject=${subject}&body=${body}`;

    if (status) {
      status.textContent = "Private review draft opened. Attach vehicle photos before sending if available.";
    }
  });
}
