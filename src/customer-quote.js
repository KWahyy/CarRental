import { quoteMarkup } from './quote-view.js';
const root = document.querySelector("[data-public-quote]");
const params = new URLSearchParams(location.search);
const token = params.get("token") || "";
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const date = (value, time = false) => value ? new Date(value).toLocaleString("en-US", time ? { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" } : { month: "long", day: "numeric", year: "numeric" }) : "—";
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

async function request(options = {}) {
  const response = await fetch(`/api/quotes-public?token=${encodeURIComponent(token)}`, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "This quote could not be loaded.");
  return data;
}

function render(quote) { root.innerHTML = quoteMarkup(quote); }
function showError(error) {
  root.innerHTML = `<section class="public-quote-error"><p class="eyebrow">Prestige Luxor</p><h1>Quote unavailable</h1><p>${escapeHtml(error.message)}</p><a href="tel:+19496200024">Call concierge · (949) 620-0024</a></section>`;
}

root.addEventListener("click", async (event) => {
  const accept = event.target.closest("[data-accept-quote]");
  const pay = event.target.closest("[data-pay-quote]");
  if (!accept && !pay) return;
  const button = accept || pay;
  button.disabled = true;
  const status = root.querySelector("[data-public-status]");
  status.textContent = accept ? "Accepting your quote…" : "Opening secure payment…";
  try {
    const data = await request({ method: "POST", body: JSON.stringify({ token, action: accept ? "accept" : "checkout" }) });
    if (data.url) return location.assign(data.url);
    render(data.quote);
  } catch (error) {
    button.disabled = false;
    status.textContent = error.message;
  }
});

if (document.getElementById('private-page-state')) { /* HTML already contains the authorized response. */ }
else if (!token) showError(new Error("The secure quote token is missing."));
else request().then(({ quote }) => render(quote)).catch(showError);
