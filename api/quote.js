import { emailFrame, emailDetails, emailButton } from "./_email-template.js";
import { sendBusinessEmail } from "./_email.js";
import { db } from "./_invoice-core.js";

const MAX_TEXT_LENGTH = 3000;
const QUOTE_NOTIFICATION_EMAIL = "Contact@prestigeluxor.com";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const origin = cleanString(req.headers.origin, 240);
  const allowedOrigins = new Set([
    "https://www.prestigeluxor.com",
    "https://prestigeluxor.com",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
  ]);

  if (allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function cleanString(value, maxLength = MAX_TEXT_LENGTH) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return cleanString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAddons(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, 80)).filter(Boolean).slice(0, 12);
}

function attributionSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const labels = {
    source: "Acquisition source",
    channel: "Acquisition channel",
    submission_page: "Submission page",
    utm_source: "Source",
    utm_medium: "Medium",
    utm_campaign: "Campaign",
    utm_content: "Content",
    utm_term: "Keyword",
    gclid: "GCLID",
    gbraid: "GBRAID",
    wbraid: "WBRAID",
    landing_page: "Landing page",
    first_referrer: "First referrer",
  };
  const summary = Object.entries(labels)
    .map(([key, label]) => value[key] ? `${label}: ${cleanString(value[key], 500)}` : "")
    .filter(Boolean)
    .join("\n");
  const latest = value.latest_touch;
  return [summary, latest && typeof latest === 'object' ? `Latest touch: ${cleanString(latest.source,240)} (${cleanString(latest.channel,80)})\nLatest landing page: ${cleanString(latest.landing_page,500)}` : ''].filter(Boolean).join('\n');
}

function phoneHref(value) {
  const phone = cleanString(value, 80);
  const prefix = phone.startsWith("+") ? "+" : "";
  return `${prefix}${phone.replace(/\D/g, "")}`;
}

function safeWebUrl(value, fallback = "https://www.prestigeluxor.com") {
  try {
    const url = new URL(cleanString(value, 600));
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : fallback;
  } catch {
    return fallback;
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

async function insertQuote(payload, req) {
  const rows = await db("quote_requests", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: payload.name,
      phone: payload.phone,
      email: payload.email || null,
      vehicle: payload.vehicle || "Vehicle TBD",
      rental_date: payload.date || null,
      addons: payload.addons,
      message: [payload.insuranceProvider ? `Insurance provider: ${payload.insuranceProvider}` : "", payload.message, attributionSummary(payload.attribution)]
        .filter(Boolean)
        .join("\n\n"),
      source:
        payload.requestType === "availability"
          ? "fleet-availability"
          : payload.requestType === "partner"
            ? "partner-vehicle-review"
            : payload.source || "website",
      page_url: payload.pageUrl || null,
      user_agent: cleanString(req.headers["user-agent"], 600),
      notification_status: "pending",
    }),
  });
  const quote = Array.isArray(rows) ? rows[0] : rows;
  if (!quote?.id) throw new Error("The CRM did not return a saved quote request.");
  return quote;
}

async function updateQuoteNotification(id, status, errorMessage = "") {
  if (!id) return;
  await db(`quote_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      notification_status: status,
      notification_error: errorMessage ? cleanString(errorMessage, 600) : null,
    }),
  }).catch(() => {});
}

export function quoteEmailHtml(payload) {
  const label = payload.requestType === "partner" ? "New owner application" : payload.requestType === "wedding" ? "New wedding inquiry" : payload.requestType === "availability" ? "New availability request" : "New quote request";
  return emailFrame({label, title: "A new request is here.",
    intro: `${payload.name || "A customer"} is ready to plan their next drive. Review the details and get in touch.`,
    preheader: `${label}: ${payload.vehicle || "Vehicle to be confirmed"}`,
    content: emailDetails([["Requested vehicle",payload.vehicle || "To be confirmed"],["Rental date",payload.date || "To be confirmed"]])
      + emailButton("Call customer", `tel:${phoneHref(payload.phone)}`)
      + (payload.email ? emailButton("Reply by email",`mailto:${payload.email}`,true) : "")
      + `<div style="height:24px"></div>`
      + emailDetails([["Customer",payload.name],["Phone",payload.phone],["Email",payload.email || "Not provided"],
        ...(payload.requestType === "wedding" ? [["Insurance",payload.insuranceProvider || "Reviewed during booking approval"]] : []),
        ["Requested extras",payload.addons?.length ? payload.addons.join(", ") : "None selected"],
        ["Customer message",payload.message || "No message included."],["Source",payload.source || "Website"]])
      + emailButton("View source page",safeWebUrl(payload.pageUrl),true)
  });
}

function quoteEmailText(payload) {
  const isAvailability = payload.requestType === "availability";
  const isPartner = payload.requestType === "partner";
  const isWedding = payload.requestType === "wedding";
  return [
    isPartner ? "New Prestige Luxor owner application" : isAvailability ? "New Prestige Luxor availability check" : isWedding ? "New Prestige Luxor wedding inquiry" : "New Prestige Luxor quote request",
    `Request type: ${isPartner ? "Owner vehicle review" : isAvailability ? "Manual availability check" : isWedding ? "Wedding transportation inquiry" : "Full quote"}`,
    `Name: ${payload.name}`,
    `Phone: ${payload.phone}`,
    `Email: ${payload.email || "Not provided"}`,
    `Vehicle: ${payload.vehicle || "Vehicle TBD"}`,
    `Rental date: ${payload.date || "Date TBD"}`,
    ...(isWedding ? [`Insurance provider: ${payload.insuranceProvider || "Reviewed during booking approval"}`] : []),
    `Add-ons: ${payload.addons.length ? payload.addons.join(", ") : "None selected"}`,
    `Message: ${payload.message || "No message included."}`,
  ].join("\n");
}

async function sendOwnerEmail(payload) {
  return sendBusinessEmail({
    to: [QUOTE_NOTIFICATION_EMAIL],
    reply_to: payload.email || undefined,
    subject: `${payload.requestType === "partner" ? "Owner application" : payload.requestType === "availability" ? "Availability check" : payload.requestType === "wedding" ? "Wedding inquiry" : "New quote request"}: ${payload.vehicle || "Vehicle TBD"}`,
    html: quoteEmailHtml(payload),
    text: quoteEmailText(payload),
  });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, message: "Method not allowed." });
  }

  try {
    const body = await readBody(req);
    if (cleanString(body.company, 200)) {
      return json(res, 200, { ok: true });
    }

    const requestedType = cleanString(body.requestType, 40);
    const payload = {
      requestType: ["availability", "partner", "wedding"].includes(requestedType) ? requestedType : "quote",
      source: cleanString(body.source, 80),
      name: cleanString(body.name, 120),
      phone: cleanString(body.phone, 80),
      email: cleanString(body.email, 180).toLowerCase(),
      insuranceProvider: cleanString(body.insuranceProvider, 180),
      vehicle: cleanString(body.vehicle, 180),
      date: cleanString(body.date, 40),
      message: cleanString(body.message, MAX_TEXT_LENGTH),
      addons: normalizeAddons(body.addons),
      pageUrl: cleanString(body.pageUrl, 600),
      attribution: body.attribution,
    };

    if (!payload.name || !payload.phone) {
      return json(res, 400, { ok: false, message: "Name and phone are required." });
    }

    if (payload.source === "google-ads-landing-page" && !payload.email) {
      return json(res, 400, { ok: false, message: "Email is required for campaign requests." });
    }

    if (payload.email && !isEmail(payload.email)) {
      return json(res, 400, { ok: false, message: "Use a valid email address." });
    }

    const [databaseResult, emailResult] = await Promise.allSettled([
      insertQuote(payload, req),
      sendOwnerEmail(payload),
    ]);
    const quote = databaseResult.status === "fulfilled" ? databaseResult.value : null;
    const emailSent = emailResult.status === "fulfilled";

    if (databaseResult.status === "rejected") {
      console.error("Quote database save failed:", databaseResult.reason?.message || databaseResult.reason);
    }
    if (emailResult.status === "rejected") {
      console.error("Quote owner email failed:", emailResult.reason?.message || emailResult.reason);
    }

    if (quote) {
      await updateQuoteNotification(
        quote.id,
        emailSent ? "sent" : "failed",
        emailSent ? "" : emailResult.reason?.message || "Email delivery failed.",
      );
    }

    if (!quote) {
      return json(res, 503, {
        ok: false,
        message: "We could not save this request in the CRM. Please try again or call or text us directly.",
      });
    }

    return json(res, 200, {
      ok: true,
      id: quote?.id,
      saved: Boolean(quote),
      notification: emailSent ? "sent" : "failed",
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      message: "We could not save this request. Please call or text us directly.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
