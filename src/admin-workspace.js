import { canViewFinancials } from "./crm-permissions.js";

const startup = document.querySelector("[data-auth-pending]");
document.querySelector("[data-workspace-bootstrap]").addEventListener("error", () => {
  if (startup.hidden) return;
  startup.querySelector("[data-startup-message]").textContent = "Couldn’t connect to the workspace.";
  startup.querySelector("[data-retry-startup]").hidden = false;
});
startup.querySelector("[data-retry-startup]").addEventListener("click", () => location.reload());

const directory = document.getElementById("desk-directory");
const launcher = document.querySelector("[data-workspace-menu]");
const workspace = document.getElementById("workspace-content");
const anchors = [...document.querySelectorAll("[data-desk-anchor]")];
const sidebar = document.getElementById("desk-sidebar");
const rail = sidebar.querySelector(".desk-rail-inner");
const closeButton = rail.querySelector("[data-close-directory]");
const wideLayout = matchMedia("(min-width: 1100px)");
const sectionButton = id => document.querySelector(`[data-crm-section="${CSS.escape(id)}"]`);
const activeSection = () => workspace.querySelector(".active[data-section-panel]")?.dataset.sectionPanel;
const pageNames = {overview:"Overview", vehicles:"Fleet", bookings:"Bookings", requests:"Quotes", invoices:"Invoices", agreements:"Rental agreements", customers:"Customers", settings:"Settings"};
let focusAfterClose;
let followingHistory = false;

function placeNavigation() {
  const focusInNav = rail.contains(document.activeElement);
  if (wideLayout.matches) {
    if (directory.open) {
      focusAfterClose = sectionButton(activeSection() || "overview");
      directory.close();
    }
    sidebar.append(rail);
  } else {
    directory.append(rail);
    if (focusInNav) launcher.focus({preventScroll:true});
  }
}
placeNavigation();
wideLayout.addEventListener("change",placeNavigation);

launcher.addEventListener("click", () => {
  focusAfterClose = launcher;
  directory.inert = false;
  directory.showModal();
  launcher.setAttribute("aria-expanded","true");
  closeButton.focus();
});
closeButton.addEventListener("click", () => directory.close());
rail.addEventListener("click", event => {
  const button = event.target.closest("[data-crm-section]");
  const anchor = event.target.closest("[data-desk-anchor]");
  if (button?.dataset.crmSection === "overview" && event.isTrusted) {
    if (location.hash) {
      const url = new URL(location.href);
      url.hash = "";
      history.replaceState(null,"",url);
    }
    window.scrollTo({top:0,behavior:"instant"});
  }
  if (!directory.open) return;
  if (button || anchor || event.target.closest("[data-sign-out]")) {
    focusAfterClose = anchor ? document.getElementById(anchor.hash.slice(1)) : workspace;
    directory.close();
  }
});
directory.addEventListener("click", event => {
  if (event.target !== directory) return;
  const box = directory.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) directory.close();
});
directory.addEventListener("close", () => {
  if (directory.open) return;
  // A closing drawer remains painted briefly; its controls should leave the tab order now.
  directory.inert = true;
  launcher.setAttribute("aria-expanded","false");
  if (focusAfterClose && !focusAfterClose.closest("[hidden]")) {
    if (focusAfterClose.matches("section")) focusAfterClose.tabIndex = -1;
    focusAfterClose.focus({preventScroll:true});
  }
  focusAfterClose = null;
});
function selectAnchor(id) {
  for (const link of anchors) {
    if (link.hash === "#" + id) link.setAttribute("aria-current","location");
    else link.removeAttribute("aria-current");
  }
}
let scrollFrame = 0;
function followScroll() {
  if (scrollFrame || activeSection() !== "overview") return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    let id = "overview";
    for (const link of anchors) {
      const target = document.getElementById(link.hash.slice(1));
      if (!link.hidden && target?.getClientRects().length && target.getBoundingClientRect().top <= 120) id = target.id;
    }
    selectAnchor(id);
  });
}
window.addEventListener("scroll", followScroll, {passive:true});
window.addEventListener("prestige:overview-leads", event => {
  const badge = document.querySelector("[data-lead-count]");
  const count = Number(event.detail?.count);
  badge.hidden = !(count > 0);
  badge.textContent = count > 99 ? "99+" : String(count || "");
});
window.addEventListener("prestige:desk-page", ({detail}) => {
  const {section, previous} = detail;
  const isOverview = section === "overview";
  document.title = pageNames[section] + " · Prestige Luxor";
  document.querySelector("[data-desk-overview-nav]").hidden = !isOverview;
  const role = document.documentElement.dataset.crmRole;
  document.querySelector('[data-desk-anchor][href="#revenue"]').hidden = !canViewFinancials(role);
  document.querySelector("[data-desk-account-label]").textContent = role === "viewer" ? "Read-only access" : "Team workspace";
  const url = new URL(location.href);
  const requested = url.searchParams.get("page");
  if (requested !== section && !followingHistory && !url.hash.includes("access_token=")) {
    url.searchParams.set("page",section);
    if (previous && previous !== section) url.hash = "";
    history[requested && previous !== section ? "pushState" : "replaceState"](null,"",url);
  }
  if (previous !== section) window.scrollTo({top:0,behavior:"instant"});
  if (isOverview) followScroll();
});
window.addEventListener("popstate", () => {
  const section = new URL(location.href).searchParams.get("page") || "overview";
  if (!Object.hasOwn(pageNames, section) || section === activeSection() || document.querySelector("[data-admin-view]").hidden) return;
  followingHistory = true;
  try { sectionButton(section)?.click(); } finally { followingHistory = false; }
});

const template = document.querySelector("[data-agreement-template-form]");
const terms = template.querySelector("[data-agreement-template-terms]");
const status = template.querySelector("[data-agreement-template-status]");
const body = template.elements.body;
function updatePaper() {
  document.querySelector("[data-paper-title]").textContent = template.elements.title.value.trim() || "Rental agreement";
  const readable = raw => raw.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key) => "〔" + key.replaceAll("_"," ") + "〕");
  document.querySelector("[data-paper-body]").textContent = readable(body.value);
  const list = document.createDocumentFragment();
  for (const term of terms.querySelectorAll("[data-template-term]")) {
    const line = document.createElement("p");
    const title = document.createElement("strong");
    title.textContent = term.querySelector('[name="term_title"]').value;
    line.append(title, "  " + readable(term.querySelector('[name="term_body"]').value));
    list.append(line);
  }
  document.querySelector("[data-paper-terms]").replaceChildren(list);
  const version = status.textContent.match(/version\s+(\d+)/i);
  if (version) document.querySelector("[data-template-version]").textContent = "Version " + version[1];
}
template.addEventListener("input",updatePaper);
new MutationObserver(updatePaper).observe(terms,{childList:true});
new MutationObserver(updatePaper).observe(status,{childList:true,characterData:true,subtree:true});
template.querySelector("[data-template-insert]").addEventListener("click", () => {
  body.setRangeText("{{" + template.querySelector("[data-template-token]").value + "}}", body.selectionStart, body.selectionEnd, "end");
  body.focus();
  body.dispatchEvent(new Event("input",{bubbles:true}));
});
