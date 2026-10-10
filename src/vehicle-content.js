import { verifiedVehicleFacts } from './verified-vehicle-facts.js';
const INTERNAL_COPY = /pixieset|digitlcars|admin crm|rate to confirm|photo set imported/i;

export function vehicleYear(vehicle) {
  if (isVehicleCategory(vehicle)) return "Vehicle category";
  return String(vehicle?.year || vehicle?.name?.match(/^(\d{4})/)?.[1] || verifiedVehicleFacts[vehicle?.slug]?.year || "");
}

export function vehicleDisplayName(vehicle) {
  return String(vehicle?.name || "Vehicle").replace(/^\d{4}\s+/, "");
}

export function bodyTypeForVehicle(vehicle) {
  const label = vehicle?.categoryLabel || vehicle?.category_label || vehicle?.category || "";
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
  return "";
}

export function engineForVehicle(vehicle) {
  return vehicle?.engine || verifiedVehicleFacts[vehicle?.slug]?.engine || "";
}

export function accelerationForVehicle(vehicle) {
  return vehicle?.acceleration || "";
}


export function isVehicleCategory(vehicle) {
  return (vehicle?.listingType || vehicle?.listing_type) === 'category';
}

export function exteriorForVehicle(vehicle) {
  return vehicle?.color || (!isVehicleCategory(vehicle) && verifiedVehicleFacts[vehicle?.slug]?.picturedExterior) || '';
}

export function vehicleListingDisclosure(vehicle) {
  if (isVehicleCategory(vehicle)) return 'Vehicle category listing. Photos are representative; model year, exterior, and exact specification vary. We confirm the assigned vehicle and its details before you reserve.';
  return 'This listing features the pictured vehicle. Availability is confirmed for your dates; any alternative vehicle requires your approval.';
}

// Shared by server and browser so missing fields never flash into placeholder cells.
export function applyVehicleFactVisibility(root) {
  root.querySelectorAll('[data-vehicle-year]').forEach(node => { node.hidden = !node.textContent.trim(); });
  root.querySelectorAll('.vehicle-private-specs > div').forEach(node => {
    node.hidden = !node.querySelector('strong')?.textContent.trim();
  });
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
    exteriorForVehicle(vehicle) ? `Exterior: ${cleanPublicText(exteriorForVehicle(vehicle))}` : "",
    seatsForVehicle(vehicle) ? `${seatsForVehicle(vehicle)} in the listed configuration` : "",
    `${bodyTypeForVehicle(vehicle)} selected for ${recommendedUseLabel(vehicle)}`,
  ];
  return [...new Set([...details, ...tags, ...base].filter(Boolean))].slice(0, 6);
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
  if (make.toLowerCase() === "porsche") return { href: "/porsche", label: "Explore Porsche rentals" };
  if (/rolls/i.test(make)) return { href: "/rolls-royce", label: "Explore Rolls-Royce rentals" };
  return { href: `/fleet?search=${encodeURIComponent(make)}`, label: `Explore ${make || "similar"} rentals` };
}

export const vehicleCityLinks = [
  { href: "/locations/irvine-exotic-car-rental", label: "Irvine" },
  { href: "/locations/riverside-county-exotic-car-rental", label: "Riverside County" },
  { href: "/locations/san-diego-exotic-car-rental", label: "San Diego" },
  { href: "/locations/palm-springs-exotic-car-rental", label: "Palm Springs" },
  { href: "/locations/los-angeles-exotic-car-rental", label: "Los Angeles" },
  { href: "/locations/orange-county-exotic-car-rental", label: "Orange County" },
  { href: "/locations/beverly-hills-luxury-car-rental", label: "Beverly Hills" },
  { href: "/locations/newport-beach-exotic-car-rental", label: "Newport Beach" },
];

export function vehicleFaqItems(vehicle, formatPrice = (value) => `$${Number(value).toLocaleString("en-US")}`) {
  const name = vehicleDisplayName(vehicle);
  const price = formatPrice(vehicle?.price || 0);
  const mileage = vehicle?.mileage || "confirmed with the quote";
  return [
    { question: `What is the starting price for the ${name}?`, answer: `The current starting rate is ${price} per day. Dates, rental length, delivery, mileage, add-ons, driver approval, and availability can change the final quote.` },
    { question: `How many people and bags fit in the ${name}?`, answer: `This listing is configured for ${seatsForVehicle(vehicle)}. ${luggageGuidance(vehicle)}` },
    { question: `What are the driver and insurance requirements?`, answer: `The starting minimum driver age is 18, subject to approval for this specific vehicle. At least one year of driving experience, a valid driver’s license and proof of full-coverage auto insurance are required before confirmation.` },
    { question: `What mileage and security deposit apply?`, answer: `${mileage} is currently listed. Additional mileage is $5 per mile. Refundable security-deposit holds start at $1,000; the exact amount and release terms are disclosed before payment.` },
    { question: `Where can Prestige Luxor deliver the ${name}?`, answer: `Approved delivery is available across Southern California, including Los Angeles, Orange County, San Diego and Palm Springs. Timing and any delivery charge are confirmed for the exact address.` },
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
  return `
    <section class="vehicle-seo-details" data-vehicle-seo aria-labelledby="vehicle-seo-title">
      <header class="vehicle-seo-intro">
        <p class="eyebrow">Vehicle rental guide</p>
        <h2 id="vehicle-seo-title">Plan your drive.</h2>
        <p>${escapeHtml(`Arrange your ${name} rental in Los Angeles, Orange County or across Southern California. Your concierge will confirm delivery and the details for your trip.`)}</p>
      </header>
      <div class="vehicle-seo-planning">
        <article><p class="eyebrow">Best uses</p><h3>Choose it for the right moment.</h3><p>${escapeHtml(`This ${bodyTypeForVehicle(vehicle).toLowerCase()} is recommended for ${recommendedUseLabel(vehicle)}.`)}</p></article>
        <article class="vehicle-walkaround"><p class="eyebrow">Current-condition check</p><h3>Request the walkaround.</h3><p>Ask for the latest video and current-condition photos of this exact vehicle before you approve the booking.</p><a href="sms:+19496200024?body=${encodeURIComponent(`Please send me the latest walkaround video for the ${name}.`)}">Request walkaround video <span aria-hidden="true">↗</span></a></article>
      </div>
      ${vehicleTripPlanningMarkup(vehicle, escapeHtml)}
      <nav class="vehicle-seo-links" aria-label="Related rental pages">
        <a href="${escapeHtml(makeLink.href)}">${escapeHtml(makeLink.label)}</a>
        ${vehicleCityLinks.map((link) => `<a href="${link.href}">${escapeHtml(link.label)} exotic car rentals</a>`).join("")}
      </nav>
      <section class="vehicle-private-faq" aria-labelledby="vehicle-faq-title">
        <header><p class="eyebrow">About this vehicle</p><h2 id="vehicle-faq-title">Your questions, answered.</h2></header>
        <div class="vehicle-private-faq-list">
          ${faqs.map((faq) => `<details><summary>${escapeHtml(faq.question)}<span>+</span></summary><p>${escapeHtml(faq.answer)}</p></details>`).join("")}
        </div>
      </section>
    </section>`;
}

const TRIP_PLANNING = {
  '2022-lamborghini-huracan': {
    heading: 'Plan a trip in this blue Huracán.',
    points: [
      ['Passengers and luggage', 'This listing has two seats. Share the size of your bags before an airport pickup, and ask to see the usable luggage space with the roof in the position you plan to use.'],
      ['Your route and parking', 'For a Newport Beach stay or a Los Angeles event, send the delivery address and mention steep driveways or restricted parking. Confirm access and the return meeting point before booking.'],
      ['Rental length and total', 'Send pickup and return times, even for a one-day trip. Ask for the approved mileage allowance, excess-mile rate, deposit amount and any delivery charges in the final quote.'],
    ],
    links: [['/guides/lamborghini-rental-cost-southern-california', 'Compare Lamborghini starting rates'], ['/guides/lamborghini-huracan-vs-urus-rental', 'Compare Huracán and Urus']],
  },
  'audi-r8-v10-spyder-white': {
    heading: 'Plan your Audi R8 Spyder rental.',
    points: [
      ['Two seats, a clear luggage plan', 'The listed configuration seats the driver and one passenger. For a hotel or airport arrival, share bag dimensions and confirm storage with the roof up and down.'],
      ['Wedding and photo timing', 'For wedding use, confirm entry and exit with your clothing in mind. A separate driver uses one of the two seats. Include photo stops, venue access and return time in your request.'],
      ['Coastal trip or city stay', 'Share your planned route and estimated distance. The final quote should confirm included mileage, additional-mile charges, delivery, driver approval and the deposit before you pay.'],
    ],
    links: [['/wedding', 'Plan wedding transportation'], ['/guides/exotic-car-delivery-hotels-airports', 'Plan hotel or airport delivery']],
  },
  'tesla-cybertruck': {
    heading: 'Plan your Cybertruck rental.',
    points: [
      ['Charging and return level', 'Ask what charge level the truck will have at handoff, what return level is required and how charging costs are handled. Confirm the supplied charging equipment and compatible stops for your route; range depends on the exact vehicle and use.'],
      ['Five seats and cargo planning', 'The published configuration lists five seats. Send passenger count and bag dimensions for cargo confirmation. Ask about the current bed configuration and secure storage before planning airport delivery.'],
      ['Parking and permitted use', 'Check parking height and space limits at your hotel or venue. Confirm your itinerary and mileage before booking. Do not assume towing, off-road driving or production use is included; request any special use in advance.'],
    ],
    links: [['/locations/orange-county-exotic-car-rental', 'Explore Orange County delivery'], ['/rental-policies', 'Review rental requirements']],
  },
};

export function vehicleTripPlanningMarkup(vehicle, escapeHtml = value => String(value ?? '')) {
  const plan = TRIP_PLANNING[vehicle?.slug];
  if (!plan) return '';
  return `<section class="rental-planning-section vehicle-trip-planning" data-trip-planning aria-labelledby="trip-planning-title"><p class="eyebrow">Before you choose your dates</p><h2 id="trip-planning-title">${escapeHtml(plan.heading)}</h2><div class="rental-planning-columns">${plan.points.map(([title,copy]) => `<div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></div>`).join('')}</div><p class="rental-planning-links">${plan.links.map(([href,label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join(' · ')}</p><a href="#vehicle-request">Request this vehicle for your dates →</a></section>`;
}
