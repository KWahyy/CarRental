const INTERNAL_COPY = /pixieset|digitlcars|admin crm|rate to confirm|photo set imported/i;

export function vehicleYear(vehicle) {
  return String(vehicle?.year || vehicle?.name?.match(/^(\d{4})/)?.[1] || "Year confirmed with availability");
}

export function vehicleDisplayName(vehicle) {
  return String(vehicle?.name || "Vehicle").replace(/^\d{4}\s+/, "");
}

export function bodyTypeForVehicle(vehicle) {
  const label = vehicle?.categoryLabel || vehicle?.category || "";
  const joined = `${vehicle?.name || ""} ${label} ${vehicle?.summary || ""}`.toLowerCase();
  if (/convertible|spyder|spider|gtc|dawn|portofino|open-air/.test(joined)) return "Convertible";
  if (/cybertruck|f150|truck/.test(joined)) return "Truck";
  if (/suv|g63|g-wagon|g wagon|gle|gls|escalade|urus|defender|range rover|cullinan|macan/.test(joined)) return "SUV";
  if (/sedan|m3|m5|c63|s63|panamera|model s/.test(joined)) return "Sedan";
  if (/m4|continental|coupe/.test(joined)) return "Coupe";
  return label || "Performance vehicle";
}

export function seatsForVehicle(vehicle) {
  const exactSeats = Number(vehicle?.seats);
  if (Number.isFinite(exactSeats) && exactSeats > 0) return `${exactSeats} seats`;
  const body = bodyTypeForVehicle(vehicle);
  if (body === "SUV" || body === "Sedan" || body === "Truck") return "Confirm seating";
  return "2 seats";
}

export function engineForVehicle(vehicle) {
  const name = String(vehicle?.name || "").toLowerCase();
  const make = String(vehicle?.make || "").toLowerCase();
  if (name.includes("huracan") || name.includes("r8")) return "V10";
  if (name.includes("cybertruck") || name.includes("tesla")) return "Electric";
  if (name.includes("corvette")) return "V8";
  if (/urus|g63|g-wagon|g wagon|gls|gle|escalade|cullinan|defender|range rover/.test(name)) return "V8 / SUV";
  if (make.includes("rolls") || make.includes("bentley")) return "Twin-turbo power";
  if (make.includes("ferrari") || make.includes("mclaren")) return "Performance powertrain";
  if (make.includes("lotus")) return "Mid-engine performance";
  if (make.includes("bmw")) return "BMW M performance";
  if (make.includes("porsche")) return "Porsche performance";
  return "Performance";
}

export function accelerationForVehicle(vehicle) {
  const name = String(vehicle?.name || "").toLowerCase();
  const make = String(vehicle?.make || "").toLowerCase();
  if (name.includes("huracan")) return "Approx. 2.9 sec";
  if (make.includes("ferrari") || make.includes("mclaren") || name.includes("r8") || name.includes("corvette")) return "Approx. 3.1 sec";
  if (name.includes("urus")) return "Approx. 3.6 sec";
  if (name.includes("tesla") || name.includes("plaid")) return "Approx. 2.1 sec";
  if (make.includes("bmw")) return "Model dependent";
  return "Configuration dependent";
}

function cleanPublicText(value) {
  return String(value || "")
    .replaceAll("KD's Exotics", "Prestige Luxor")
    .replaceAll("KDs Exotics", "Prestige Luxor")
    .trim();
}

function isUsefulPublicFact(value) {
  const text = cleanPublicText(value);
  return Boolean(text) && !INTERNAL_COPY.test(text) && !text.includes("$") && text.length <= 130;
}

export function publicVehicleSummary(vehicle) {
  const existing = cleanPublicText(vehicle?.summary);
  if (existing && !INTERNAL_COPY.test(existing) && !/added to the .* showroom/i.test(existing)) return existing;

  const name = vehicleDisplayName(vehicle);
  const color = cleanPublicText(vehicle?.color);
  const body = bodyTypeForVehicle(vehicle);
  const colorLead = color && !name.toLowerCase().includes(color.toLowerCase()) ? `${color} ` : "";
  if (body === "SUV") return `The ${colorLead}${name} combines a commanding arrival with ${seatsForVehicle(vehicle)} for airport plans, events, and concierge delivery across Los Angeles and Orange County.`;
  if (body === "Convertible") return `The ${colorLead}${name} is an open-air choice for coastal drives, wedding arrivals, and photo-ready experiences in Los Angeles and Orange County.`;
  if (body === "Sedan" || body === "Coupe") return `The ${colorLead}${name} balances performance and comfort for dinners, business travel, weekend plans, and private delivery across Los Angeles and Orange County.`;
  if (body === "Truck") return `The ${colorLead}${name} delivers a distinctive, high-impact arrival for events, productions, and private bookings across Los Angeles and Orange County.`;
  return `The ${colorLead}${name} is a focused performance choice for VIP arrivals, coastal drives, events, and content-ready bookings across Los Angeles and Orange County.`;
}

export function publicVehicleDetails(vehicle) {
  const details = Array.isArray(vehicle?.details) ? vehicle.details.map(cleanPublicText).filter(isUsefulPublicFact) : [];
  const tags = Array.isArray(vehicle?.tags) ? vehicle.tags.map(cleanPublicText).filter(isUsefulPublicFact) : [];
  const base = [
    vehicle?.color ? `${cleanPublicText(vehicle.color)} exterior configuration` : "Exterior finish confirmed with current availability",
    `${seatsForVehicle(vehicle)} in the listed configuration`,
    `${bodyTypeForVehicle(vehicle)} selected for ${recommendedUseLabel(vehicle)}`,
  ];
  return [...new Set([...details, ...tags, ...base])].slice(0, 6);
}

export function publicVehicleTags(vehicle) {
  const tags = Array.isArray(vehicle?.tags) ? vehicle.tags.map(cleanPublicText) : [];
  return tags.filter((tag) => isUsefulPublicFact(tag) || /^\$[\d,]+(?:\.00)?\s+[^$]+$/.test(tag));
}

export function luggageGuidance(vehicle) {
  const body = bodyTypeForVehicle(vehicle);
  if (body === "SUV" || body === "Truck") return "Best for group luggage; send bag count and sizes for exact cargo confirmation.";
  if (body === "Sedan") return "Suitable for light-to-moderate luggage; confirm bag dimensions before delivery.";
  if (body === "Convertible") return "Pack light. Convertible cargo space varies with the roof position.";
  return "Light luggage only; confirm exact bag dimensions before delivery.";
}

export function recommendedUseLabel(vehicle) {
  const body = bodyTypeForVehicle(vehicle);
  if (body === "SUV") return "airport arrivals, group plans, weddings, and luxury travel";
  if (body === "Convertible") return "coastal drives, weddings, photoshoots, and weekend escapes";
  if (body === "Sedan") return "business travel, dinners, daily driving, and discreet arrivals";
  if (body === "Coupe") return "date nights, coastal drives, events, and refined performance";
  if (body === "Truck") return "events, productions, statement arrivals, and group plans";
  return "VIP arrivals, weddings, nightlife, photoshoots, and special occasions";
}

export function makePageLink(vehicle) {
  const make = String(vehicle?.make || "");
  if (make.toLowerCase() === "lamborghini") return { href: "/lamborghini", label: "Explore Lamborghini rentals" };
  if (make.toLowerCase() === "ferrari") return { href: "/ferrari", label: "Explore Ferrari rentals" };
  return { href: `/fleet?search=${encodeURIComponent(make)}`, label: `Explore ${make || "similar"} rentals` };
}

export const vehicleCityLinks = [
  { href: "/locations/los-angeles-exotic-car-rental", label: "Los Angeles" },
  { href: "/locations/orange-county-exotic-car-rental", label: "Orange County" },
  { href: "/locations/beverly-hills-exotic-car-rental", label: "Beverly Hills" },
  { href: "/locations/newport-beach-exotic-car-rental", label: "Newport Beach" },
];

export function vehicleFaqItems(vehicle, formatPrice = (value) => `$${Number(value).toLocaleString("en-US")}`) {
  const name = vehicleDisplayName(vehicle);
  const price = formatPrice(vehicle?.price || 0);
  const mileage = vehicle?.mileage || "confirmed with the quote";
  return [
    { question: `What is the starting price for the ${name}?`, answer: `The current starting rate is ${price} per day. Dates, rental length, delivery, mileage, add-ons, driver approval, and availability can change the final quote.` },
    { question: `How many people and bags fit in the ${name}?`, answer: `This listing is configured for ${seatsForVehicle(vehicle)}. ${luggageGuidance(vehicle)}` },
    { question: `What are the driver and insurance requirements?`, answer: `The starting minimum driver age is 18, subject to approval for this specific vehicle. A valid driver’s license and proof of active auto insurance are required before confirmation.` },
    { question: `What mileage and security deposit apply?`, answer: `${mileage} is currently listed. The refundable security-deposit hold is vehicle- and driver-specific; the exact amount and release terms are disclosed before payment.` },
    { question: `Where can Prestige Luxor deliver the ${name}?`, answer: `Approved delivery is available across Los Angeles and Orange County, including Beverly Hills, Newport Beach, Malibu, Irvine, Anaheim, and nearby destinations. Timing and any delivery charge are confirmed for the exact address.` },
    { question: `Can I see a walkaround video before renting the ${name}?`, answer: `Yes. Ask the concierge for the latest walkaround video and current-condition photos for this exact vehicle before approving the reservation.` },
  ];
}

export function vehicleSeoTitle(vehicle) {
  return `${vehicleDisplayName(vehicle)} Rental Los Angeles | Prestige Luxor`;
}

export function vehicleSeoDescription(vehicle, formatPrice = (value) => `$${Number(value).toLocaleString("en-US")}`) {
  const name = vehicleDisplayName(vehicle);
  const colorValue = cleanPublicText(vehicle?.color);
  const color = colorValue && !name.toLowerCase().includes(colorValue.toLowerCase()) ? `${colorValue} ` : "";
  return `Rent the ${color}${name} in Los Angeles or Orange County from ${formatPrice(vehicle?.price || 0)}/day. ${vehicle?.mileage || "Mileage confirmed by quote"}; concierge delivery available.`;
}

export function vehicleSeoSectionMarkup(vehicle, {
  formatPrice = (value) => `$${Number(value).toLocaleString("en-US")}`,
  escapeHtml = (value) => String(value ?? ""),
} = {}) {
  if (!vehicle) return "";
  const name = vehicleDisplayName(vehicle);
  const makeLink = makePageLink(vehicle);
  const faqs = vehicleFaqItems(vehicle, formatPrice);
  const facts = [
    ["Year", vehicleYear(vehicle)],
    ["Model", vehicle.model || name],
    ["Exterior", vehicle.color || "Confirm current finish"],
    ["Configuration", bodyTypeForVehicle(vehicle)],
    ["Starting rate", `${formatPrice(vehicle.price)}/day`],
    ["Seating", seatsForVehicle(vehicle)],
    ["Luggage", luggageGuidance(vehicle)],
    ["Included mileage", vehicle.mileage || "Confirmed by quote"],
    ["Minimum age", "18+; vehicle approval required"],
    ["Security deposit", "Vehicle-specific refundable hold"],
    ["Insurance", "Active auto insurance required"],
    ["Recommended for", recommendedUseLabel(vehicle)],
  ];
  return `
    <section class="vehicle-seo-details" data-vehicle-seo aria-labelledby="vehicle-seo-title">
      <header class="vehicle-seo-intro">
        <p class="eyebrow">Vehicle rental guide</p>
        <h2 id="vehicle-seo-title">${escapeHtml(name)} rental details for Los Angeles and Orange County.</h2>
        <p>${escapeHtml(publicVehicleSummary(vehicle))}</p>
      </header>
      <div class="vehicle-seo-facts" aria-label="${escapeHtml(name)} rental facts">
        ${facts.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
      </div>
      <div class="vehicle-seo-planning">
        <article><p class="eyebrow">Best uses</p><h3>Choose it for the right moment.</h3><p>${escapeHtml(`This ${bodyTypeForVehicle(vehicle).toLowerCase()} is recommended for ${recommendedUseLabel(vehicle)}.`)}</p></article>
        <article class="vehicle-walkaround"><p class="eyebrow">Current-condition check</p><h3>Request the walkaround.</h3><p>Ask for the latest video and current-condition photos of this exact vehicle before you approve the booking.</p><a href="sms:+19496200024?body=${encodeURIComponent(`Please send me the latest walkaround video for the ${name}.`)}">Request walkaround video <span aria-hidden="true">↗</span></a></article>
      </div>
      <nav class="vehicle-seo-links" aria-label="Related rental pages">
        <a href="${escapeHtml(makeLink.href)}">${escapeHtml(makeLink.label)}</a>
        ${vehicleCityLinks.map((link) => `<a href="${link.href}">${escapeHtml(link.label)} exotic car rentals</a>`).join("")}
      </nav>
      <section class="vehicle-private-faq" aria-labelledby="vehicle-faq-title">
        <header><p class="eyebrow">About this vehicle</p><h2 id="vehicle-faq-title">Questions,<br /><em>answered.</em></h2></header>
        <div class="vehicle-private-faq-list">
          ${faqs.map((faq) => `<details><summary>${escapeHtml(faq.question)}<span>+</span></summary><p>${escapeHtml(faq.answer)}</p></details>`).join("")}
        </div>
      </section>
    </section>`;
}
