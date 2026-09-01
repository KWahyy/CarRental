import { clean, db, json, readBody, requireEmployee, serverConfig, setCors } from "./_invoice-core.js";
import { addAgreementEvent, getPublicAgreement, normalizeImportantTerms, publicAgreementPayload } from "./_agreement-core.js";
import { createAgreementPdf } from "./_agreement-pdf.js";

const clientMeta = (req) => ({
  ip: clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0], 100),
  user_agent: clean(req.headers["user-agent"], 500),
});

async function databaseToken(req) {
  const { serviceKey } = serverConfig();
  if (serviceKey) return "";
  const { token } = await requireEmployee(req);
  return token;
}

async function uploadSignedPdf(bytes, agreement, userToken = "") {
  const { url, key, serviceKey } = serverConfig();
  const credential = serviceKey || userToken;
  if (!credential) throw new Error("Supabase server credentials are missing.");
  const path = `signed-agreements/${agreement.id}/${agreement.agreement_number}.pdf`;
  const response = await fetch(`${url}/storage/v1/object/rental-documents/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${credential}`, "Content-Type": "application/pdf", "x-upsert": "true" },
    body: Buffer.from(bytes),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.message || "The signed PDF could not be stored."), { status: 502 });
  }
  return path;
}

async function storedPdf(path, userToken = "") {
  const { url, key, serviceKey } = serverConfig();
  const credential = serviceKey || userToken;
  if (!credential) throw new Error("Supabase server credentials are missing.");
  const response = await fetch(`${url}/storage/v1/object/authenticated/rental-documents/${path}`, { headers: { apikey: key, Authorization: `Bearer ${credential}` } });
  if (!response.ok) throw Object.assign(new Error("The signed agreement PDF is unavailable."), { status: 404 });
  return Buffer.from(await response.arrayBuffer());
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const requestBody = req.method === "POST" ? await readBody(req) : {};
    const token = clean(req.query?.token || requestBody.token, 120);
    const userToken = await databaseToken(req);
    const agreement = await getPublicAgreement(token, userToken);
    if (req.method === "GET" && req.query?.document === "1") {
      if (agreement.status !== "signed" || !agreement.signed_pdf_path) throw Object.assign(new Error("This agreement has not been signed yet."), { status: 409 });
      const bytes = await storedPdf(agreement.signed_pdf_path, userToken);
      res.status(200);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${agreement.agreement_number}.pdf"`);
      return res.end(bytes);
    }
    if (req.method === "GET") {
      if (!agreement.opened_at) {
        const meta = clientMeta(req);
        const now = new Date().toISOString();
        await db(`rental_agreements?id=eq.${encodeURIComponent(agreement.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ opened_at: now }) }, userToken);
        await addAgreementEvent(agreement.id, "opened", `Agreement opened by ${agreement.customer_name || "renter"}.`, null, userToken, meta);
        agreement.opened_at = now;
      }
      return json(res, 200, { agreement: publicAgreementPayload(agreement) });
    }
    if (req.method === "POST") {
      if (agreement.status !== "draft") throw Object.assign(new Error("This agreement is already signed and locked."), { status: 409 });
      const body = requestBody;
      const printedName = clean(body.printed_name, 180);
      const signature = String(body.signature_data || "");
      const initials = body.initials && typeof body.initials === "object" ? body.initials : {};
      const consents = body.consents && typeof body.consents === "object" ? body.consents : {};
      const required = normalizeImportantTerms(agreement.important_terms).map((term) => term.key);
      const missing = required.filter((key) => !clean(initials[key], 8));
      if (missing.length) throw Object.assign(new Error("Initial every important term before signing."), { status: 400 });
      if (!consents.reviewed || !consents.electronic || !consents.intent) throw Object.assign(new Error("Accept all three electronic-consent statements before signing."), { status: 400 });
      if (!printedName) throw Object.assign(new Error("Enter the renter's printed name."), { status: 400 });
      if (!signature.startsWith("data:image/png;base64,") || signature.length > 300000) throw Object.assign(new Error("Draw the renter's signature in the signature box."), { status: 400 });
      const safeInitials = Object.fromEntries(required.map((key) => [key, clean(initials[key], 4).toUpperCase().replace(/[^A-Z]/g, "")]));
      const safeConsents = { reviewed: true, electronic: true, intent: true };
      const meta = clientMeta(req);
      const signedAt = new Date().toISOString();
      const signed = { ...agreement, status: "signed", signature_name: printedName, signature_data: signature, signed_at: signedAt, initials: safeInitials, electronic_consents: safeConsents, signed_ip: meta.ip, signed_user_agent: meta.user_agent };
      const pdfPath = await uploadSignedPdf(await createAgreementPdf(signed), signed, userToken);
      const rows = await db(`rental_agreements?id=eq.${encodeURIComponent(agreement.id)}&status=eq.draft`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "signed", signature_name: printedName, signature_data: signature, signed_at: signedAt, initials: safeInitials, electronic_consents: safeConsents, signed_ip: meta.ip, signed_user_agent: meta.user_agent, signed_pdf_path: pdfPath }) }, userToken);
      if (!rows?.[0]) throw Object.assign(new Error("This agreement was already signed in another session."), { status: 409 });
      await addAgreementEvent(agreement.id, "signed", `Agreement signed by ${printedName}.`, null, userToken, meta);
      return json(res, 200, { agreement: publicAgreementPayload(rows[0]) });
    }
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "Agreement signing request failed." });
  }
}
