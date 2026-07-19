const MAX_TEXT_LENGTH = 3000;
const QUOTE_NOTIFICATION_EMAIL = "Khaled@kdssales.com";
const DEFAULT_RESEND_FROM = "KD's Exotics <onboarding@resend.dev>";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const origin = cleanString(req.headers.origin, 240);
  const allowedOrigins = new Set([
    "https://www.kdsexotics.com",
    "https://kdsexotics.com",
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

function phoneHref(value) {
  const phone = cleanString(value, 80);
  const prefix = phone.startsWith("+") ? "+" : "";
  return `${prefix}${phone.replace(/\D/g, "")}`;
}

function safeWebUrl(value, fallback = "https://www.kdsexotics.com") {
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
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase server credentials are missing.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/quote_requests`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: payload.name,
      phone: payload.phone,
      email: payload.email || null,
      vehicle: payload.vehicle || "Vehicle TBD",
      rental_date: payload.date || null,
      addons: payload.addons,
      message: [payload.insuranceProvider ? `Insurance provider: ${payload.insuranceProvider}` : "", payload.message]
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

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || "Could not save quote request.");
  }

  return Array.isArray(data) ? data[0] : data;
}

async function updateQuoteNotification(id, status, errorMessage = "") {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey || !id) return;

  await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/quote_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      notification_status: status,
      notification_error: errorMessage ? cleanString(errorMessage, 600) : null,
    }),
  }).catch(() => {});
}

function quoteEmailHtml(payload) {
  const addons = payload.addons.length ? payload.addons.join(", ") : "None selected";
  const isAvailability = payload.requestType === "availability";
  const isPartner = payload.requestType === "partner";
  const requestLabel = isPartner ? "New owner application" : isAvailability ? "Vehicle availability check" : "New private quote";
  const phoneLink = phoneHref(payload.phone);
  const emailLink = payload.email ? `mailto:${escapeHtml(payload.email)}` : "";
  const pageLink = safeWebUrl(payload.pageUrl);
  const source = payload.source || "Website";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          @media only screen and (max-width: 620px) {
            .email-shell { padding: 0 !important; }
            .email-card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
            .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
            .hero-title { font-size: 30px !important; line-height: 35px !important; }
            .detail-column { display: block !important; width: 100% !important; }
            .detail-column-left { padding-right: 0 !important; padding-bottom: 10px !important; }
            .detail-column-right { padding-left: 0 !important; }
            .action-column { display: block !important; width: 100% !important; padding: 0 0 10px !important; }
            .action-column:last-child { padding-bottom: 0 !important; }
            .action-link { display: block !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#070706;color:#f7f3ea;-webkit-text-size-adjust:100%;">
        <div class="email-shell" style="padding:30px 14px;background:#070706;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td align="center">
                <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;border-collapse:separate;background:#12110f;border:1px solid #332d22;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td class="email-pad" style="padding:22px 30px;background:#0a0a09;border-bottom:1px solid #2d2921;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td valign="middle">
                            <a href="https://www.kdsexotics.com" style="text-decoration:none;">
                              <img src="https://www.kdsexotics.com/assets/kds-logo-wide.png" width="148" alt="KD's Exotics" style="display:block;width:148px;height:auto;border:0;">
                            </a>
                          </td>
                          <td align="right" valign="middle" style="font-family:Arial,Helvetica,sans-serif;color:#d9b866;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">
                            ${requestLabel}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td class="email-pad" style="padding:34px 30px 30px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;color:#a59d90;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:10px;">Requested vehicle</div>
                      <div class="hero-title" style="font-family:Arial,Helvetica,sans-serif;color:#fffdf8;font-size:38px;line-height:43px;font-weight:800;letter-spacing:-0.6px;">${escapeHtml(payload.vehicle || "Vehicle TBD")}</div>
                      <div style="width:46px;height:2px;background:#d9b866;margin:22px 0 20px;"></div>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td class="detail-column detail-column-left" width="50%" valign="top" style="padding-right:8px;">
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#8f887d;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Rental date</div>
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#f7f3ea;font-size:18px;line-height:26px;font-weight:700;margin-top:4px;">${escapeHtml(payload.date || "Date TBD")}</div>
                          </td>
                          <td class="detail-column detail-column-right" width="50%" valign="top" style="padding-left:8px;">
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#8f887d;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Customer</div>
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#f7f3ea;font-size:18px;line-height:26px;font-weight:700;margin-top:4px;">${escapeHtml(payload.name)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td class="email-pad" style="padding:0 30px 30px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td class="action-column" width="50%" style="padding-right:6px;">
                            <a class="action-link" href="tel:${escapeHtml(phoneLink)}" style="display:block;background:#d9b866;border:1px solid #d9b866;border-radius:5px;padding:15px 16px;font-family:Arial,Helvetica,sans-serif;color:#0b0a08;font-size:14px;line-height:18px;font-weight:800;text-align:center;text-decoration:none;">Call lead</a>
                          </td>
                          <td class="action-column" width="50%" style="padding-left:6px;">
                            ${payload.email
                              ? `<a class="action-link" href="${emailLink}" style="display:block;background:#1b1916;border:1px solid #4b4438;border-radius:5px;padding:15px 16px;font-family:Arial,Helvetica,sans-serif;color:#fffdf8;font-size:14px;line-height:18px;font-weight:800;text-align:center;text-decoration:none;">Reply by email</a>`
                              : `<div style="background:#1b1916;border:1px solid #332f28;border-radius:5px;padding:15px 16px;font-family:Arial,Helvetica,sans-serif;color:#777168;font-size:14px;line-height:18px;font-weight:700;text-align:center;">No email provided</div>`}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td class="email-pad" style="padding:0 30px 30px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#191714;border:1px solid #312d26;border-radius:6px;">
                        <tr>
                          <td class="detail-column detail-column-left" width="50%" valign="top" style="padding:22px 22px 12px;">
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#8f887d;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;">Phone</div>
                            <a href="tel:${escapeHtml(phoneLink)}" style="display:inline-block;margin-top:5px;font-family:Arial,Helvetica,sans-serif;color:#fffdf8;font-size:16px;line-height:23px;font-weight:700;text-decoration:none;">${escapeHtml(payload.phone)}</a>
                          </td>
                          <td class="detail-column detail-column-right" width="50%" valign="top" style="padding:22px 22px 12px;">
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#8f887d;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;">Email</div>
                            <div style="margin-top:5px;font-family:Arial,Helvetica,sans-serif;color:#fffdf8;font-size:16px;line-height:23px;font-weight:700;word-break:break-word;">${payload.email ? `<a href="${emailLink}" style="color:#fffdf8;text-decoration:none;">${escapeHtml(payload.email)}</a>` : "Not provided"}</div>
                          </td>
                        </tr>
                        <tr>
                          <td class="detail-column detail-column-left" width="50%" valign="top" style="padding:12px 22px 22px;">
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#8f887d;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;">Insurance</div>
                            <div style="margin-top:5px;font-family:Arial,Helvetica,sans-serif;color:#fffdf8;font-size:16px;line-height:23px;font-weight:700;">${escapeHtml(isAvailability ? "Availability request" : isPartner ? "Owner application" : payload.insuranceProvider || "Not provided")}</div>
                          </td>
                          <td class="detail-column detail-column-right" width="50%" valign="top" style="padding:12px 22px 22px;">
                            <div style="font-family:Arial,Helvetica,sans-serif;color:#8f887d;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;">Add-ons</div>
                            <div style="margin-top:5px;font-family:Arial,Helvetica,sans-serif;color:#fffdf8;font-size:16px;line-height:23px;font-weight:700;">${escapeHtml(addons)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td class="email-pad" style="padding:0 30px 32px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;color:#d9b866;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:9px;">Customer message</div>
                      <div style="border-left:2px solid #d9b866;padding:2px 0 2px 16px;font-family:Arial,Helvetica,sans-serif;color:#e8e1d6;font-size:17px;line-height:27px;">${escapeHtml(payload.message || "No message included.")}</div>
                    </td>
                  </tr>

                  <tr>
                    <td class="email-pad" style="padding:18px 30px;background:#0a0a09;border-top:1px solid #2d2921;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="font-family:Arial,Helvetica,sans-serif;color:#777168;font-size:11px;line-height:17px;">
                            ${escapeHtml(source)} lead &nbsp;&middot;&nbsp; KD's Exotics
                          </td>
                          <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;">
                            <a href="${pageLink}" style="color:#d9b866;text-decoration:none;">View source page</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
}

function quoteEmailText(payload) {
  const isAvailability = payload.requestType === "availability";
  const isPartner = payload.requestType === "partner";
  return [
    isPartner ? "New KD's Exotics owner application" : isAvailability ? "New KD's Exotics availability check" : "New KD's Exotics quote request",
    `Request type: ${isPartner ? "Owner vehicle review" : isAvailability ? "Manual availability check" : "Full quote"}`,
    `Name: ${payload.name}`,
    `Phone: ${payload.phone}`,
    `Email: ${payload.email || "Not provided"}`,
    `Vehicle: ${payload.vehicle || "Vehicle TBD"}`,
    `Rental date: ${payload.date || "Date TBD"}`,
    ...(isAvailability || isPartner ? [] : [`Insurance provider: ${payload.insuranceProvider || "Not provided"}`]),
    `Add-ons: ${payload.addons.length ? payload.addons.join(", ") : "None selected"}`,
    `Message: ${payload.message || "No message included."}`,
  ].join("\n");
}

async function sendOwnerEmail(payload) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.QUOTE_FROM_EMAIL || DEFAULT_RESEND_FROM;
  const to = [QUOTE_NOTIFICATION_EMAIL];

  if (!resendKey) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: payload.email || undefined,
      subject: `${payload.requestType === "partner" ? "Owner application" : payload.requestType === "availability" ? "Availability check" : "New quote request"}: ${payload.vehicle || "Vehicle TBD"}`,
      html: quoteEmailHtml(payload),
      text: quoteEmailText(payload),
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || "Resend could not send the quote email.");
  }

  return data;
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
      requestType: ["availability", "partner"].includes(requestedType) ? requestedType : "quote",
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
    };

    if (!payload.name || !payload.phone) {
      return json(res, 400, { ok: false, message: "Name and phone are required." });
    }

    if (payload.requestType === "quote" && !payload.insuranceProvider) {
      return json(res, 400, { ok: false, message: "Insurance provider is required." });
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

    if (!quote && !emailSent) {
      return json(res, 503, {
        ok: false,
        message: "We could not send this request. Please call or text us directly.",
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
