import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BUSINESS } from "./_invoice-core.js";

const ink = rgb(.035, .035, .035);
const white = rgb(1, 1, 1);
const gray = rgb(.34, .34, .34);
const muted = rgb(.49, .49, .49);
const line = rgb(.81, .81, .79);
const pale = rgb(.955, .95, .935);
const paper = rgb(.992, .989, .979);

const dollars = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const date = (value) => {
  if (!value) return "Upon receipt";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const humanize = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

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

export async function createInvoicePdf(invoice) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logo = await pdf.embedPng(await readFile(new URL("../assets/prestige-luxor-logo-light.png", import.meta.url)));
  const W = 612, H = 792, margin = 42, contentWidth = W - margin * 2;
  let page, y;

  const status = humanize(invoice.status === "draft" ? "Client invoice" : invoice.status || "Invoice");
  const addPage = (label = "RENTAL INVOICE") => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });
    page.drawRectangle({ x: 0, y: H - 82, width: W, height: 82, color: ink });
    const logoWidth = 162, logoHeight = logo.height * (logoWidth / logo.width);
    page.drawImage(logo, { x: margin, y: H - 57, width: logoWidth, height: logoHeight });
    page.drawText(label, { x: 388, y: H - 35, size: 6.5, font: bold, color: rgb(.69, .69, .69) });
    page.drawText(invoice.invoice_number || "DRAFT", { x: 388, y: H - 57, size: 13, font: bold, color: white });
    y = H - 112;
  };

  const ensure = (height = 30, label = "INVOICE CONTINUED") => { if (y - height < 56) addPage(label); };
  const eyebrow = (text) => {
    ensure(26);
    page.drawText(text.toUpperCase(), { x: margin, y, size: 6.5, font: bold, color: muted });
    page.drawLine({ start: { x: margin + 150, y: y + 2 }, end: { x: W - margin, y: y + 2 }, thickness: .6, color: line });
    y -= 20;
  };
  const title = (text, size = 20) => { ensure(size + 15); page.drawText(text, { x: margin, y, size, font: bold, color: ink }); y -= size + 14; };
  const textBlock = (text, { size = 8, width = contentWidth, color = gray, font = regular, gap = 7, leading = size + 3, label = "INVOICE CONTINUED" } = {}) => {
    for (const value of wrap(text, font, size, width)) {
      ensure(leading + 2, label);
      if (value) page.drawText(value, { x: margin, y, size, font, color });
      y -= value ? leading : leading + 3;
    }
    y -= gap;
  };
  const metaLabel = (label, value, x, rowY, width = 220) => {
    page.drawText(label.toUpperCase(), { x, y: rowY, size: 5.8, font: bold, color: muted });
    wrap(value || "-", bold, 8.8, width).slice(0, 2).forEach((row, index) => page.drawText(row, { x, y: rowY - 16 - index * 10, size: 8.8, font: bold, color: ink }));
  };
  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: ink });
    page.drawText("DESCRIPTION", { x: margin + 14, y: y - 16, size: 6.5, font: bold, color: white });
    page.drawText("AMOUNT", { x: W - margin - 51, y: y - 16, size: 6.5, font: bold, color: white });
    y -= 25;
  };

  addPage();
  eyebrow("Billing document");
  title("Rental invoice", 21);

  const infoTop = y;
  page.drawRectangle({ x: margin, y: infoTop - 132, width: contentWidth, height: 132, color: white, borderColor: line, borderWidth: .55 });
  page.drawRectangle({ x: margin, y: infoTop - 132, width: 3, height: 132, color: ink });
  page.drawLine({ start: { x: 314, y: infoTop - 116 }, end: { x: 314, y: infoTop - 16 }, thickness: .5, color: line });
  page.drawText("BILL TO", { x: margin + 18, y: infoTop - 23, size: 6.1, font: bold, color: muted });
  page.drawText(invoice.customer_name || "Client", { x: margin + 18, y: infoTop - 45, size: 11.5, font: bold, color: ink });
  let billY = infoTop - 63;
  for (const detail of [invoice.customer_email, invoice.customer_phone, invoice.customer_address].filter(Boolean)) {
    wrap(detail, regular, 7.6, 230).slice(0, 2).forEach((row) => { page.drawText(row, { x: margin + 18, y: billY, size: 7.6, font: regular, color: gray }); billY -= 10; });
  }
  metaLabel("Issued", date(invoice.issue_date), 332, infoTop - 23, 95);
  metaLabel("Due", date(invoice.due_date), 452, infoTop - 23, 95);
  metaLabel("Status", status, 332, infoTop - 78, 95);
  metaLabel("Payment method", humanize(invoice.payment_method || "Stripe"), 452, infoTop - 78, 95);
  y = infoTop - 160;

  eyebrow("Rental overview");
  const rentalTop = y;
  page.drawRectangle({ x: margin, y: rentalTop - 82, width: contentWidth, height: 82, color: pale });
  page.drawText("VEHICLE", { x: margin + 16, y: rentalTop - 21, size: 5.8, font: bold, color: muted });
  page.drawText(invoice.vehicle_name || "Vehicle to be confirmed", { x: margin + 16, y: rentalTop - 44, size: 12, font: bold, color: ink });
  page.drawText(`${date(invoice.rental_start)} - ${date(invoice.rental_end)}`, { x: 340, y: rentalTop - 24, size: 8.3, font: bold, color: ink });
  page.drawText(`${invoice.rental_days || 1} rental day${Number(invoice.rental_days) === 1 ? "" : "s"}`, { x: 340, y: rentalTop - 43, size: 7.4, font: regular, color: gray });
  page.drawText(`${invoice.mileage_allowance || "100 miles/day"}${invoice.overage_rate ? `  |  ${invoice.overage_rate}` : ""}`, { x: 340, y: rentalTop - 61, size: 7.4, font: regular, color: gray });
  y = rentalTop - 110;

  eyebrow("Charges");
  drawTableHeader();
  const rows = [
    [`Vehicle rental - ${invoice.rental_days || 1} day${Number(invoice.rental_days) === 1 ? "" : "s"} at ${dollars(invoice.daily_rate)}`, Number(invoice.daily_rate || 0) * Number(invoice.rental_days || 1)],
    ["Delivery / pickup", invoice.delivery_fee],
    ["Add-ons", invoice.addons_total],
    ["Insurance", invoice.insurance_fee],
    ["Additional mileage", invoice.mileage_fee],
    ["Fuel", invoice.fuel_fee],
    ["Tolls", invoice.tolls_fee],
    ["Damage", invoice.damage_fee],
    [invoice.other_label || "Other charge", invoice.other_fee],
    ["Discount", -Number(invoice.discount || 0)],
    ["Refundable security deposit - charged", invoice.deposit_method === "authorization_hold" ? 0 : invoice.refundable_deposit],
  ].filter(([, amount], index) => index === 0 || (Number.isFinite(Number(amount)) && Number(amount) !== 0));

  for (const [label, amount] of rows) {
    const labelLines = wrap(label, regular, 8.2, 405);
    const rowHeight = Math.max(29, 14 + labelLines.length * 9.5);
    if (y - rowHeight < 72) {
      addPage("INVOICE CONTINUED");
      eyebrow("Charges continued");
      drawTableHeader();
    }
    const textTopPadding = Math.max((rowHeight - labelLines.length * 9.5) / 2, 5);
    const firstBaseline = y - textTopPadding - 6.8;
    labelLines.forEach((row, index) => page.drawText(row, { x: margin + 14, y: firstBaseline - index * 9.5, size: 8.2, font: regular, color: ink }));
    const amountText = dollars(amount);
    page.drawText(amountText, { x: W - margin - 14 - regular.widthOfTextAtSize(amountText, 8.2), y: y - rowHeight / 2 - 3, size: 8.2, font: regular, color: ink });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: W - margin, y: y - rowHeight }, thickness: .45, color: line });
    y -= rowHeight;
  }

  if (y < 252) addPage("INVOICE SUMMARY");
  y -= 4;
  const summaryTop = y;
  page.drawRectangle({ x: margin, y: summaryTop - 112, width: contentWidth, height: 112, color: white, borderColor: line, borderWidth: .55 });
  page.drawText("PAYMENT SUMMARY", { x: margin + 16, y: summaryTop - 22, size: 6.1, font: bold, color: muted });
  page.drawText(`Method: ${humanize(invoice.payment_method || "Stripe")}`, { x: margin + 16, y: summaryTop - 45, size: 8, font: regular, color: ink });
  if (invoice.payment_reference) {
    const reference = `Reference: ${invoice.payment_reference}`;
    wrap(reference, regular, 7.1, 240).slice(0, 2).forEach((row, index) => page.drawText(row, { x: margin + 16, y: summaryTop - 63 - index * 9, size: 7.1, font: regular, color: gray }));
  }
  const totals = [["Rental subtotal", invoice.subtotal], ["Amount paid", -Number(invoice.amount_paid || 0)], ["BALANCE DUE", invoice.balance_due]];
  totals.forEach(([label, amount], index) => {
    const rowY = summaryTop - 24 - index * 29;
    const strong = label === "BALANCE DUE", font = strong ? bold : regular, size = strong ? 11.5 : 8.3;
    page.drawText(label, { x: 352, y: rowY, size: strong ? 8.3 : 7.5, font: strong ? bold : regular, color: strong ? ink : gray });
    const value = dollars(amount);
    page.drawText(value, { x: W - margin - 16 - font.widthOfTextAtSize(value, size), y: rowY, size, font, color: strong ? ink : gray });
  });
  y = summaryTop - 137;

  if (invoice.deposit_method === "authorization_hold" && Number(invoice.refundable_deposit) > 0) {
    ensure(70, "INVOICE DETAILS");
    page.drawRectangle({ x: margin, y: y - 56, width: contentWidth, height: 56, color: pale });
    page.drawText("REFUNDABLE SECURITY-DEPOSIT HOLD", { x: margin + 14, y: y - 19, size: 6, font: bold, color: muted });
    page.drawText(dollars(invoice.refundable_deposit), { x: margin + 14, y: y - 40, size: 11, font: bold, color: ink });
    page.drawText(`Not included in balance due  |  ${humanize(invoice.deposit_hold_status || "Pending")}`, { x: 250, y: y - 35, size: 7.6, font: regular, color: gray });
    y -= 76;
  }

  if (invoice.notes) {
    if (y < 155) addPage("INVOICE NOTES");
    eyebrow("Customer notes");
    textBlock(invoice.notes, { size: 8, gap: 12, label: "INVOICE NOTES" });
  }
  if (y < 170) addPage("INVOICE TERMS");
  eyebrow("Terms and payment conditions");
  textBlock(invoice.terms || "No additional terms.", { size: 7.6, leading: 10.7, gap: 5, label: "INVOICE TERMS" });
  if (!/does not replace the (signed )?rental agreement/i.test(invoice.terms || "")) {
    page.drawText("This invoice is a billing document and does not replace the signed rental agreement.", { x: margin, y: Math.max(y, 58), size: 7.2, font: italic, color: muted });
  }

  const pages = pdf.getPages();
  pages.forEach((target, index) => {
    const pageNumber = `${String(index + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`;
    target.drawLine({ start: { x: margin, y: 39 }, end: { x: W - margin, y: 39 }, thickness: .45, color: line });
    target.drawText(`Prestige Holdings Inc. dba Prestige Luxor  |  ${BUSINESS.address}`, { x: margin, y: 25, size: 6.2, font: bold, color: muted });
    target.drawText(`${BUSINESS.phone}  |  ${BUSINESS.email}  |  ${BUSINESS.website}`, { x: margin, y: 14, size: 6.1, font: regular, color: muted });
    target.drawText(pageNumber, { x: W - margin - bold.widthOfTextAtSize(pageNumber, 6.4), y: 19, size: 6.4, font: bold, color: muted });
  });
  return pdf.save();
}
