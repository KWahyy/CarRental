const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const searchInput = document.querySelector("[data-faq-search]");
const filterButtons = [...document.querySelectorAll("[data-faq-filter]")];
const categories = [...document.querySelectorAll("[data-faq-category]")];
const emptyState = document.querySelector("[data-faq-empty]");
let activeFilter = "all";

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function filterQuestions() {
  const query = normalize(searchInput?.value);
  let visibleCount = 0;

  categories.forEach((category) => {
    const categoryMatches = activeFilter === "all" || category.dataset.faqCategory === activeFilter;
    let categoryVisibleCount = 0;

    category.querySelectorAll("[data-faq-item]").forEach((item) => {
      const queryMatches = !query || normalize(item.textContent).includes(query);
      const isVisible = categoryMatches && queryMatches;
      item.hidden = !isVisible;
      if (isVisible) categoryVisibleCount += 1;
    });

    category.hidden = categoryVisibleCount === 0;
    visibleCount += categoryVisibleCount;
  });

  if (emptyState) emptyState.hidden = visibleCount !== 0;
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.faqFilter || "all";
    filterButtons.forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("active", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    filterQuestions();
  });
});

searchInput?.addEventListener("input", filterQuestions);

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
  if (document.activeElement?.matches("input, textarea, select")) return;
  event.preventDefault();
  searchInput?.focus();
});
