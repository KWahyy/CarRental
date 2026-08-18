import { submitQuoteRequest } from "./quote-api.js?v=lead-conversion-20260720";

const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const form = document.querySelector("[data-wedding-form]");
const status = document.querySelector("[data-wedding-status]");
const reveals = document.querySelectorAll(".reveal");
const driverPreference = form?.querySelector("[data-wedding-driver]");
const insuranceSection = form?.querySelector("[data-wedding-insurance]");
const insuranceFields = insuranceSection ? [...insuranceSection.querySelectorAll("input")] : [];

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
    { threshold: 0.16 }
  );

  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add("revealed"));
}

function valueOf(formData, key) {
  return String(formData.get(key) || "").trim();
}

function syncInsuranceSection() {
  if (!driverPreference || !insuranceSection) return;
  const needsInsurance = driverPreference.value === "Self-drive";
  insuranceSection.hidden = !needsInsurance;
  insuranceFields.forEach((field) => {
    field.disabled = !needsInsurance;
    field.required = needsInsurance;
  });
}

if (form) {
  driverPreference?.addEventListener("change", syncInsuranceSection);
  syncInsuranceSection();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const submitButton = form.querySelector("button[type='submit']");
    const service = valueOf(formData, "service");
    const venue = valueOf(formData, "venue");
    const chauffeur = valueOf(formData, "chauffeur");
    const insuranceProvider = valueOf(formData, "insuranceProvider");
    const insurancePolicyholder = valueOf(formData, "insurancePolicyholder");
    const notes = valueOf(formData, "notes");
    const message = [
      `Wedding service: ${service}`,
      `Venue or city: ${venue}`,
      `Driver preference: ${chauffeur}`,
      `Insurance provider: ${insuranceProvider || (chauffeur === "Self-drive" ? "Not provided" : "Not required for requested service")}`,
      `Name on policy: ${insurancePolicyholder || "Not provided"}`,
      "",
      "Timeline and notes:",
      notes || "Not provided",
    ].join("\n");

    const payload = {
      requestType: "wedding",
      source: "wedding",
      name: valueOf(formData, "name"),
      phone: valueOf(formData, "phone"),
      email: valueOf(formData, "email"),
      insuranceProvider,
      vehicle: valueOf(formData, "vehicle"),
      date: valueOf(formData, "date"),
      addons: [service, chauffeur].filter(Boolean),
      message,
      company: "",
      pageUrl: window.location.href,
    };

    submitButton.disabled = true;
    submitButton.textContent = "Sending your plan...";
    form.setAttribute("aria-busy", "true");
    if (status) {
      status.dataset.tone = "";
      status.textContent = "Sending securely to our private booking desk...";
    }

    try {
      await submitQuoteRequest(payload);
      form.reset();
      syncInsuranceSection();
      submitButton.textContent = "Plan received";
      if (status) {
        status.dataset.tone = "success";
        status.textContent = "Your wedding plan is in. Our desk will contact you with availability and next steps.";
      }
    } catch (error) {
      submitButton.textContent = "Request wedding plan";
      if (status) {
        status.dataset.tone = "error";
        status.textContent = error.message || "We could not send your request. Please call us directly.";
      }
    } finally {
      submitButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
}
