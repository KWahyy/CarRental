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

function statusCopy(quote) {
  if (quote.status === "converted") return ["Reservation confirmed", "Your payment was received and the Prestige Luxor team is preparing your rental agreement."];
  if (Number(quote.deposit_paid_amount) >= Number(quote.amount_required) && quote.accepted_at) return ["Reservation payment received", "Your quote is accepted. Our concierge team will finalize your rental agreement."];
  if (quote.accepted_at) return ["Quote accepted", "Complete the reservation payment below to secure the vehicle."];
  return ["Prepared exclusively for you", "Review the rental details, pricing, and refundable security deposit before accepting."];
}

function render(quote) {
  const [headline, subhead] = statusCopy(quote);
  const lines = (quote.line_items || []).map((item) => `<p><span>${escapeHtml(item.description)}${Number(item.quantity) !== 1 ? ` · ${item.quantity} × ${money(item.rate)}` : ""}</span><strong>${money(item.amount)}</strong></p>`).join("");
  const canAccept = !quote.accepted_at && !["expired", "declined", "cancelled", "converted"].includes(quote.status);
  const amountDue = Math.max(Number(quote.amount_required || 0) - Number(quote.deposit_paid_amount || 0), 0);
  const canPay = Boolean(quote.accepted_at) && amountDue > 0 && !["expired", "declined", "cancelled", "converted"].includes(quote.status);
  const unavailable = ["expired", "declined", "cancelled"].includes(quote.status);
  root.innerHTML = `<section class="public-quote-hero">
      <div class="public-quote-hero-copy"><p class="eyebrow">${escapeHtml(quote.quote_number)}</p><h1>${escapeHtml(headline)}</h1><p>${escapeHtml(subhead)}</p></div>
      ${quote.vehicle_image_url ? `<img src="${escapeHtml(quote.vehicle_image_url)}" alt="${escapeHtml(quote.vehicle_name)}" width="1400" height="900">` : ""}
      <div class="public-quote-vehicle"><span>Your vehicle</span><h2>${escapeHtml(quote.vehicle_name)}</h2><p>${date(quote.start_at, true)} <i>to</i> ${date(quote.end_at, true)}</p></div>
    </section>
    <div class="public-quote-grid"><article class="public-quote-card pricing"><header><div><span>Rental proposal</span><h2>${money(quote.rental_total)}</h2></div><small>Valid until ${date(quote.expires_at, true)}</small></header>
      <div class="public-money-lines"><p><span>Base rental</span><strong>${money(Number(quote.rate_amount) * Number(quote.duration_value || 1))}</strong></p>${lines}${Number(quote.discount_amount) ? `<p class="discount"><span>${escapeHtml(quote.discount_label || "Discount")}</span><strong>−${money(quote.discount_amount)}</strong></p>` : ""}${Number(quote.tax_amount) ? `<p><span>Tax</span><strong>${money(quote.tax_amount)}</strong></p>` : ""}<p class="total"><span>Rental total</span><strong>${money(quote.rental_total)}</strong></p><p><span>Required to reserve</span><strong>${money(quote.amount_required)}</strong></p><p><span>Remaining rental balance</span><strong>${money(quote.remaining_balance)}</strong></p></div>
      <div class="public-security"><span>Refundable security deposit</span><strong>${money(quote.security_deposit)}</strong><p>Separate from your rental total. This is handled as a refundable hold under the rental agreement.</p></div>
    </article>
    <aside><article class="public-quote-card customer"><span>Prepared for</span><h3>${escapeHtml(quote.customer_name)}</h3><p>${escapeHtml(quote.customer_message || "Your Prestige Luxor concierge prepared this private rental proposal.")}</p></article>
      <article class="public-quote-card action"><p data-public-status>${unavailable ? "This quote is no longer active. Contact our concierge for an updated proposal." : "Vehicle availability is secured after your reservation payment is received."}</p>
        ${canAccept ? `<button type="button" data-accept-quote>Accept Quote</button>` : ""}
        ${canPay ? `<button type="button" data-pay-quote>Pay ${money(amountDue)} to Reserve</button>` : ""}
        ${Number(quote.deposit_paid_amount) ? `<div class="payment-received"><span>Reservation payment received</span><strong>${money(quote.deposit_paid_amount)}</strong></div>` : ""}
        <a href="tel:+19496200024">Questions? Call your concierge</a>
      </article></aside></div>`;
}

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

if (!token) showError(new Error("The secure quote token is missing."));
else request().then(({ quote }) => render(quote)).catch(showError);
