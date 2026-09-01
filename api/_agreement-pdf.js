import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { BUSINESS } from "./_invoice-core.js";
import { normalizeImportantTerms } from "./_agreement-core.js";
import { renderAgreementText } from "./_agreement-template.js";

const ink = rgb(.035, .035, .035);
const white = rgb(1, 1, 1);
const gray = rgb(.34, .34, .34);
const muted = rgb(.49, .49, .49);
const line = rgb(.81, .81, .79);
const pale = rgb(.955, .95, .935);
const paper = rgb(.992, .989, .979);

const dollars = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const dateTime = (value) => value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "To be confirmed";

function wrap(text, font, size, width) {
  const lines = [];
  for (const paragraph of String(text || "").split(/\n/)) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let current = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(next, size) > width) { lines.push(current); current = word; }
      else current = next;
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function createAgreementPdf(agreement) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logo = await pdf.embedPng(await readFile(new URL("../assets/prestige-luxor-logo-light.png", import.meta.url)));
  const W = 612, H = 792, margin = 42, contentWidth = W - margin * 2;
  let page, y;

  const addPage = (label = "PRIVATE RENTAL AGREEMENT") => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });
    page.drawRectangle({ x: 0, y: H - 82, width: W, height: 82, color: ink });
    const logoWidth = 162, logoHeight = logo.height * (logoWidth / logo.width);
    page.drawImage(logo, { x: margin, y: H - 57, width: logoWidth, height: logoHeight });
    page.drawText(label, { x: 388, y: H - 35, size: 6.5, font: bold, color: rgb(.69, .69, .69), characterSpacing: 1.05 });
    page.drawText(agreement.agreement_number || "DRAFT", { x: 388, y: H - 57, size: 13, font: bold, color: white });
    page.drawLine({ start: { x: 0, y: H - 82 }, end: { x: W, y: H - 82 }, thickness: .8, color: rgb(.28, .28, .28) });
    y = H - 112;
  };

  const ensure = (height = 30, label = "AGREEMENT CONTINUED") => { if (y - height < 54) addPage(label); };
  const eyebrow = (text) => {
    ensure(28);
    page.drawText(text.toUpperCase(), { x: margin, y, size: 6.5, font: bold, color: muted, characterSpacing: 1.15 });
    page.drawLine({ start: { x: margin + 150, y: y + 2 }, end: { x: W - margin, y: y + 2 }, thickness: .6, color: line });
    y -= 20;
  };
  const title = (text, size = 18) => { ensure(size + 15); page.drawText(text, { x: margin, y, size, font: bold, color: ink }); y -= size + 14; };
  const textBlock = (text, { size = 8.3, color = gray, width = contentWidth, gap = 7, label, font = regular, leading = size + 3.2 } = {}) => {
    for (const value of wrap(text, font, size, width)) {
      ensure(leading + 2, label);
      if (value) page.drawText(value, { x: margin, y, size, font, color });
      y -= value ? leading : leading + 3;
    }
    y -= gap;
  };
  const summaryCell = (label, value, x, rowY, width) => {
    page.drawText(label.toUpperCase(), { x, y: rowY, size: 6.2, font: bold, color: muted, characterSpacing: .65 });
    wrap(value || "-", bold, 9.2, width).slice(0, 2).forEach((row, index) => page.drawText(row, { x, y: rowY - 17 - index * 11, size: 9.2, font: bold, color: ink }));
  };

  addPage();
  eyebrow("Rental overview");
  title("Agreement summary", 20);
  const cardTop = y;
  page.drawRectangle({ x: margin, y: cardTop - 126, width: contentWidth, height: 126, color: pale });
  page.drawRectangle({ x: margin, y: cardTop - 126, width: 3, height: 126, color: ink });
  page.drawLine({ start: { x: 306, y: cardTop - 112 }, end: { x: 306, y: cardTop - 14 }, thickness: .5, color: line });
  page.drawLine({ start: { x: margin + 16, y: cardTop - 63 }, end: { x: W - margin - 16, y: cardTop - 63 }, thickness: .5, color: line });
  summaryCell("Renter", agreement.customer_name, margin + 18, cardTop - 23, 230);
  summaryCell("Vehicle", agreement.vehicle_name, 324, cardTop - 23, 225);
  summaryCell("Rental period", `${dateTime(agreement.rental_start_at || agreement.rental_start)} - ${dateTime(agreement.rental_end_at || agreement.rental_end)}`, margin + 18, cardTop - 82, 230);
  summaryCell("Rental amount / deposit", `${dollars(agreement.quote_total || agreement.rental_total)} / ${dollars(agreement.refundable_deposit)}`, 324, cardTop - 82, 225);
  y = cardTop - 155;

  eyebrow("Renter record");
  const renterLine = `${agreement.customer_phone || "No phone saved"}  |  ${agreement.customer_email || "No email saved"}`;
  page.drawText(agreement.customer_name || "Renter", { x: margin, y, size: 10.5, font: bold, color: ink });
  y -= 18;
  textBlock(renterLine, { size: 8.1, gap: 2 });
  textBlock(`Approved driver: ${agreement.driver_name || agreement.customer_name || "Not recorded"}${agreement.license_number ? `  |  License ${agreement.license_state || ""} ${agreement.license_number}` : ""}${agreement.license_expiration ? `  |  Expires ${agreement.license_expiration}` : ""}`, { size: 7.8, color: muted, gap: 8 });

  eyebrow("Required acknowledgments");
  const initials = agreement.initials || {};
  for (const term of normalizeImportantTerms(agreement.important_terms)) {
    const body = renderAgreementText(term.body, agreement);
    const lines = wrap(body, regular, 7.35, 422);
    const cardHeight = Math.max(50, 31 + lines.length * 9.2);
    ensure(cardHeight + 9, "REQUIRED ACKNOWLEDGMENTS");
    page.drawRectangle({ x: margin, y: y - cardHeight + 7, width: contentWidth, height: cardHeight, color: white, borderColor: line, borderWidth: .55 });
    page.drawRectangle({ x: margin, y: y - cardHeight + 7, width: 2.2, height: cardHeight, color: ink });
    page.drawText(term.title, { x: margin + 14, y: y - 8, size: 8.8, font: bold, color: ink });
    lines.forEach((row, index) => page.drawText(row, { x: margin + 14, y: y - 23 - index * 9.2, size: 7.35, font: regular, color: gray }));
    page.drawLine({ start: { x: 490, y: y - cardHeight + 17 }, end: { x: 490, y: y - 4 }, thickness: .45, color: line });
    page.drawText("INITIALS", { x: 506, y: y - 8, size: 5.5, font: bold, color: muted, characterSpacing: .6 });
    page.drawText(String(initials[term.key] || "-").toUpperCase(), { x: 506, y: y - 31, size: 13.5, font: bold, color: ink });
    y -= cardHeight + 9;
  }

  addPage("TERMS & CONDITIONS");
  eyebrow("Complete agreement");
  title("Terms and conditions", 20);
  page.drawText("Please retain this signed document with the complete rental record.", { x: margin, y, size: 8.5, font: italic, color: muted });
  y -= 28;
  const paragraphs = renderAgreementText(agreement.terms, agreement).split(/\n+/).map((value) => value.trim()).filter(Boolean);
  paragraphs.forEach((paragraph, index) => {
    if (index === 0 || paragraph === "Terms, Conditions, and Liability Acknowledgment") return;
    if (/^\d+\.\s/.test(paragraph)) {
      ensure(36, "TERMS & CONDITIONS");
      y -= 3;
      page.drawText(paragraph, { x: margin, y, size: 8.7, font: bold, color: ink });
      y -= 17;
      return;
    }
    if (/^[A-Z][A-Z\s&/-]{2,}$/.test(paragraph)) {
      ensure(28, "TERMS & CONDITIONS");
      page.drawText(paragraph, { x: margin, y, size: 6.3, font: bold, color: muted, characterSpacing: .9 });
      y -= 15;
      return;
    }
    textBlock(paragraph, { size: 7.75, leading: 10.8, gap: 6, label: "TERMS & CONDITIONS" });
  });

  addPage("SIGNATURE & CONSENT");
  eyebrow("Electronic execution");
  title("Consent and signature", 20);
  textBlock("By completing this page, the renter confirms the agreement was reviewed, the required terms were initialed, and the electronic signature is intended to be legally binding.", { size: 8.5, width: 490, gap: 10 });

  const consents = agreement.electronic_consents || {};
  const consentRows = [["reviewed", "I reviewed and agree to the rental agreement."], ["electronic", "I consent to signing this agreement electronically."], ["intent", "I understand my electronic signature has the same intent as signing a paper agreement."]];
  const consentTop = y;
  page.drawRectangle({ x: margin, y: consentTop - 102, width: contentWidth, height: 102, color: pale });
  consentRows.forEach(([key, label], index) => {
    const rowY = consentTop - 25 - index * 29;
    page.drawRectangle({ x: margin + 16, y: rowY - 2, width: 11, height: 11, borderColor: ink, borderWidth: .9, color: white });
    if (consents[key]) page.drawText("X", { x: margin + 18.2, y: rowY, size: 7.5, font: bold, color: ink });
    page.drawText(label, { x: margin + 39, y: rowY, size: 8.2, font: regular, color: ink });
  });
  y = consentTop - 132;

  eyebrow("Renter signature");
  const signatureTop = y;
  page.drawRectangle({ x: margin, y: signatureTop - 154, width: contentWidth, height: 154, color: white, borderColor: line, borderWidth: .6 });
  page.drawText("PRINTED RENTER NAME", { x: margin + 16, y: signatureTop - 21, size: 5.8, font: bold, color: muted, characterSpacing: .65 });
  page.drawText(agreement.signature_name || "Not signed", { x: margin + 16, y: signatureTop - 42, size: 10.5, font: bold, color: ink });
  page.drawText("SIGNED", { x: 392, y: signatureTop - 21, size: 5.8, font: bold, color: muted, characterSpacing: .65 });
  page.drawText(agreement.signed_at ? dateTime(agreement.signed_at) : "Pending", { x: 392, y: signatureTop - 42, size: 8.2, font: regular, color: ink });
  const signatureLineY = signatureTop - 124;
  if (agreement.signature_data?.startsWith("data:image/png;base64,")) {
    try {
      const image = await pdf.embedPng(Buffer.from(agreement.signature_data.split(",")[1], "base64"));
      const scale = Math.min(265 / image.width, 67 / image.height);
      page.drawImage(image, { x: margin + 16, y: signatureLineY + 8, width: image.width * scale, height: image.height * scale });
    } catch {}
  }
  page.drawLine({ start: { x: margin + 16, y: signatureLineY }, end: { x: 342, y: signatureLineY }, thickness: .8, color: ink });
  page.drawText("RENTER SIGNATURE", { x: margin + 16, y: signatureLineY - 13, size: 5.8, font: bold, color: muted, characterSpacing: .65 });
  y = signatureTop - 184;

  eyebrow("Record certification");
  page.drawRectangle({ x: margin, y: y - 72, width: contentWidth, height: 72, borderColor: line, borderWidth: .55 });
  page.drawText("AGREEMENT DETAILS", { x: margin + 14, y: y - 19, size: 5.8, font: bold, color: muted, characterSpacing: .7 });
  wrap(`Created ${dateTime(agreement.created_at)}  |  Opened ${dateTime(agreement.opened_at)}  |  Signed ${dateTime(agreement.signed_at)}  |  Template version ${agreement.template_version || 1}`, regular, 7.2, 492).forEach((row, index) => page.drawText(row, { x: margin + 14, y: y - 38 - index * 10, size: 7.2, font: regular, color: gray }));
  page.drawText(`Electronic record ID: ${agreement.id || "-"}`, { x: margin + 14, y: y - 58, size: 6.8, font: regular, color: muted });

  const pages = pdf.getPages();
  pages.forEach((target, index) => {
    const pageNumber = `${String(index + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`;
    target.drawLine({ start: { x: margin, y: 39 }, end: { x: W - margin, y: 39 }, thickness: .45, color: line });
    target.drawText(`${BUSINESS.phone}  |  ${BUSINESS.email}  |  ${BUSINESS.website}`, { x: margin, y: 22, size: 6.4, font: regular, color: muted });
    target.drawText(pageNumber, { x: W - margin - bold.widthOfTextAtSize(pageNumber, 6.4), y: 22, size: 6.4, font: bold, color: muted });
  });
  return pdf.save();
}
