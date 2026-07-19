import { submitQuoteRequest } from "./quote-api.js?v=lead-delivery-20260718b";

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
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const submitButton = form.querySelector("button[type='submit']");
    const lines = [
      `Year: ${valueOf(formData, "year") || "Not provided"}`,
      `Mileage: ${valueOf(formData, "mileage") || "Not provided"}`,
      `Availability: ${valueOf(formData, "availability")}`,
      "",
      "Notes:",
      valueOf(formData, "notes") || "Not provided",
    ];

    const payload = {
      requestType: "partner",
      source: "partner-vehicle-review",
      name: valueOf(formData, "name"),
      phone: valueOf(formData, "phone"),
      email: valueOf(formData, "email"),
      insuranceProvider: "",
      vehicle: valueOf(formData, "vehicle"),
      date: "",
      addons: ["Owner partner application"],
      message: lines.join("\n"),
      company: "",
      pageUrl: window.location.href,
    };

    submitButton.disabled = true;
    submitButton.textContent = "Sending for review...";
    form.setAttribute("aria-busy", "true");
    if (status) {
      status.dataset.tone = "";
      status.textContent = "Saving your vehicle review securely...";
    }

    try {
      await submitQuoteRequest(payload);
      form.reset();
      if (status) {
        status.dataset.tone = "success";
        status.textContent = "Vehicle received. Our team will contact you after a private review.";
      }
      submitButton.textContent = "Review received";
    } catch (error) {
      if (status) {
        status.dataset.tone = "error";
        status.textContent = error.message || "We could not save your vehicle. Please call us directly.";
      }
      submitButton.textContent = "Submit for review";
    } finally {
      submitButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
}
