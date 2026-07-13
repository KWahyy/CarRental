const MAX_TEXT_LENGTH = 3000;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
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

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

async function insertQuote(payload, req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

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
      source: "website",
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
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
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
  return `
    <div style="font-family:Arial,sans-serif;background:#080807;color:#f7f2e8;padding:28px">
      <div style="max-width:680px;margin:0 auto;background:#151310;border:1px solid #3b3222;border-radius:18px;padding:28px">
        <p style="color:#d7b46a;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px">New quote request</p>
        <h1 style="font-size:30px;line-height:1.1;margin:0 0 18px">KD's Exotics lead</h1>
        <table style="width:100%;border-collapse:collapse;color:#f7f2e8">
          <tr><td style="padding:10px 0;color:#b9b1a6">Name</td><td style="padding:10px 0;font-weight:700">${escapeHtml(payload.name)}</td></tr>
          <tr><td style="padding:10px 0;color:#b9b1a6">Phone</td><td style="padding:10px 0;font-weight:700">${escapeHtml(payload.phone)}</td></tr>
          <tr><td style="padding:10px 0;color:#b9b1a6">Email</td><td style="padding:10px 0;font-weight:700">${escapeHtml(payload.email || "Not provided")}</td></tr>
          <tr><td style="padding:10px 0;color:#b9b1a6">Vehicle</td><td style="padding:10px 0;font-weight:700">${escapeHtml(payload.vehicle || "Vehicle TBD")}</td></tr>
          <tr><td style="padding:10px 0;color:#b9b1a6">Rental date</td><td style="padding:10px 0;font-weight:700">${escapeHtml(payload.date || "Date TBD")}</td></tr>
          <tr><td style="padding:10px 0;color:#b9b1a6">Insurance provider</td><td style="padding:10px 0;font-weight:700">${escapeHtml(payload.insuranceProvider || "Not provided")}</td></tr>
          <tr><td style="padding:10px 0;color:#b9b1a6">Add-ons</td><td style="padding:10px 0;font-weight:700">${escapeHtml(addons)}</td></tr>
        </table>
        <div style="margin-top:18px;padding-top:18px;border-top:1px solid #342c20">
          <p style="color:#b9b1a6;margin:0 0 8px">Message</p>
          <p style="font-size:18px;line-height:1.55;margin:0">${escapeHtml(payload.message || "No message included.")}</p>
        </div>
      </div>
    </div>
  `;
}

function quoteEmailText(payload) {
  return [
    "New KD's Exotics quote request",
    `Name: ${payload.name}`,
    `Phone: ${payload.phone}`,
    `Email: ${payload.email || "Not provided"}`,
    `Vehicle: ${payload.vehicle || "Vehicle TBD"}`,
    `Rental date: ${payload.date || "Date TBD"}`,
    `Insurance provider: ${payload.insuranceProvider || "Not provided"}`,
    `Add-ons: ${payload.addons.length ? payload.addons.join(", ") : "None selected"}`,
    `Message: ${payload.message || "No message included."}`,
  ].join("\n");
}

async function sendOwnerEmail(payload) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.QUOTE_FROM_EMAIL;
  const to = (process.env.QUOTE_TO_EMAIL || "").split(",").map((email) => email.trim()).filter(Boolean);

  if (!resendKey || !from || !to.length) {
    throw new Error("Resend quote email environment variables are missing.");
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
      subject: `New quote request: ${payload.vehicle || "Vehicle TBD"}`,
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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, message: "Method not allowed." });
  }

  try {
    const body = await readBody(req);
    if (cleanString(body.company, 200)) {
      return json(res, 200, { ok: true });
    }

    const payload = {
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

    if (!payload.insuranceProvider) {
      return json(res, 400, { ok: false, message: "Insurance provider is required." });
    }

    if (payload.email && !isEmail(payload.email)) {
      return json(res, 400, { ok: false, message: "Use a valid email address." });
    }

    const quote = await insertQuote(payload, req);

    try {
      await sendOwnerEmail(payload);
      await updateQuoteNotification(quote?.id, "sent");
    } catch (emailError) {
      await updateQuoteNotification(quote?.id, "failed", emailError.message);
      return json(res, 200, {
        ok: true,
        id: quote?.id,
        notification: "failed",
        message: "Quote saved. Email notification needs Resend environment setup.",
      });
    }

    return json(res, 200, { ok: true, id: quote?.id, notification: "sent" });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      message: "We could not save this request. Please call or text us directly.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
