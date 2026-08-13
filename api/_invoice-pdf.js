import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BUSINESS } from "./_invoice-core.js";

const gold = rgb(0.84, 0.70, 0.38);
const black = rgb(0.035, 0.035, 0.035);
const gray = rgb(0.42, 0.42, 0.42);
const light = rgb(0.94, 0.93, 0.90);

function dollars(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function date(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function wrap(text, font, size, width) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

export async function createInvoicePdf(invoice) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const { width, height } = page.getSize();

  const drawFooter = (targetPage) => {
    targetPage.drawRectangle({ x: 0, y: 0, width, height: 46, color: black });
    targetPage.drawText(BUSINESS.address, { x: 42, y: 27, size: 7.5, font: regular, color: rgb(1, 1, 1) });
    targetPage.drawText(`${BUSINESS.phone}  •  ${BUSINESS.email}  •  ${BUSINESS.website}`, { x: 42, y: 14, size: 7.5, font: regular, color: gold });
  };

  page.drawRectangle({ x: 0, y: height - 138, width, height: 138, color: black });
  try {
    const logoBytes = await fs.readFile(path.join(process.cwd(), "assets", "prestige-luxor-logo-light.png"));
    const logo = await pdf.embedPng(logoBytes);
    const scale = Math.min(215 / logo.width, 62 / logo.height);
    page.drawImage(logo, { x: 42, y: height - 104, width: logo.width * scale, height: logo.height * scale });
  } catch {
    page.drawText(BUSINESS.name, { x: 42, y: height - 82, size: 25, font: serif, color: rgb(1, 1, 1) });
  }
  page.drawText("INVOICE", { x: 430, y: height - 60, size: 11, font: bold, color: gold });
  page.drawText(invoice.invoice_number || "DRAFT", { x: 430, y: height - 88, size: 18, font: bold, color: rgb(1, 1, 1) });
  const documentStatus = invoice.status === "draft" ? "CLIENT INVOICE" : String(invoice.status || "invoice").replaceAll("_", " ").toUpperCase();
  page.drawText(documentStatus, { x: 430, y: height - 111, size: 8, font: bold, color: gold });

  let y = height - 180;
  page.drawText("BILL TO", { x: 42, y, size: 8, font: bold, color: gold });
  page.drawText("INVOICE DETAILS", { x: 342, y, size: 8, font: bold, color: gold });
  y -= 24;
  page.drawText(invoice.customer_name || "Client", { x: 42, y, size: 15, font: bold, color: black });
  page.drawText(`Issued ${date(invoice.issue_date)}`, { x: 342, y, size: 10, font: regular, color: black });
  y -= 17;
  if (invoice.customer_email) page.drawText(invoice.customer_email, { x: 42, y, size: 9, font: regular, color: gray });
  page.drawText(`Due ${date(invoice.due_date)}`, { x: 342, y, size: 10, font: regular, color: black });
  y -= 15;
  if (invoice.customer_phone) page.drawText(invoice.customer_phone, { x: 42, y, size: 9, font: regular, color: gray });
  page.drawText(`Rental ${date(invoice.rental_start)} – ${date(invoice.rental_end)}`, { x: 342, y, size: 9, font: regular, color: gray });

  y -= 42;
  page.drawRectangle({ x: 42, y: y - 52, width: width - 84, height: 64, color: light });
  page.drawText("VEHICLE", { x: 58, y: y - 7, size: 7, font: bold, color: gold });
  page.drawText(invoice.vehicle_name || "Vehicle to be confirmed", { x: 58, y: y - 31, size: 16, font: serif, color: black });
  page.drawText(`${invoice.mileage_allowance || "100 miles/day"}${invoice.overage_rate ? `  •  ${invoice.overage_rate}` : ""}`, { x: 58, y: y - 47, size: 8, font: regular, color: gray });

  y -= 96;
  page.drawRectangle({ x: 42, y: y - 26, width: width - 84, height: 30, color: black });
  page.drawText("DESCRIPTION", { x: 56, y: y - 15, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("AMOUNT", { x: 505, y: y - 15, size: 8, font: bold, color: gold });
  y -= 48;
  const rows = [
    [`Vehicle rental · ${invoice.rental_days || 1} day${Number(invoice.rental_days) === 1 ? "" : "s"} × ${dollars(invoice.daily_rate)}`, Number(invoice.daily_rate || 0) * Number(invoice.rental_days || 1)],
    ["Delivery / pickup", invoice.delivery_fee],
    ["Add-ons", invoice.addons_total],
    ["Insurance", invoice.insurance_fee],
    ["Additional mileage", invoice.mileage_fee],
    ["Fuel", invoice.fuel_fee],
    ["Tolls", invoice.tolls_fee],
    ["Damage", invoice.damage_fee],
    [invoice.other_label || "Other charge", invoice.other_fee],
    ["Discount", -Number(invoice.discount || 0)],
    ["Refundable security deposit", invoice.deposit_method === "authorization_hold" ? 0 : invoice.refundable_deposit],
  ].filter(([, amount], index) => index === 0 || (Number.isFinite(Number(amount)) && Number(amount) !== 0));
  for (const [label, amount] of rows) {
    page.drawText(label, { x: 56, y, size: 9, font: regular, color: black });
    const amountText = dollars(amount);
    page.drawText(amountText, { x: 548 - regular.widthOfTextAtSize(amountText, 9), y, size: 9, font: regular, color: black });
    page.drawLine({ start: { x: 42, y: y - 7 }, end: { x: 570, y: y - 7 }, thickness: 0.5, color: rgb(0.84, 0.84, 0.84) });
    y -= 22;
  }

  y -= 6;
  const totals = [["Subtotal", invoice.subtotal], ["Paid", -Number(invoice.amount_paid || 0)], ["BALANCE DUE", invoice.balance_due]];
  for (const [label, amount] of totals) {
    const isBalance = label === "BALANCE DUE";
    page.drawText(label, { x: 370, y, size: isBalance ? 10 : 9, font: isBalance ? bold : regular, color: isBalance ? black : gray });
    const value = dollars(amount);
    page.drawText(value, { x: 548 - (isBalance ? bold : regular).widthOfTextAtSize(value, isBalance ? 13 : 9), y, size: isBalance ? 13 : 9, font: isBalance ? bold : regular, color: isBalance ? black : gray });
    y -= isBalance ? 30 : 22;
  }

  if (invoice.deposit_method === "authorization_hold" && Number(invoice.refundable_deposit) > 0) {
    page.drawText(`Security deposit hold: ${dollars(invoice.refundable_deposit)} · ${String(invoice.deposit_hold_status || "pending").replaceAll("_", " ")}`, {
      x: 42,
      y: y + 8,
      size: 8,
      font: bold,
      color: gold,
    });
    y -= 16;
  }

  if (y < 180) {
    drawFooter(page);
    page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: height - 86, width, height: 86, color: black });
    page.drawText(BUSINESS.name, { x: 42, y: height - 55, size: 23, font: serif, color: rgb(1, 1, 1) });
    page.drawText(invoice.invoice_number || "INVOICE", { x: 430, y: height - 54, size: 11, font: bold, color: gold });
    y = height - 126;
  }

  const termsY = y - 8;
  page.drawText("TERMS & NOTES", { x: 42, y: termsY, size: 8, font: bold, color: gold });
  const termLines = wrap(invoice.terms, regular, 7.5, 510).slice(0, 8);
  termLines.forEach((line, index) => page.drawText(line, { x: 42, y: termsY - 16 - index * 11, size: 7.5, font: regular, color: gray }));
  if (invoice.notes) {
    const noteY = termsY - 16 - termLines.length * 11 - 8;
    page.drawText("NOTES", { x: 42, y: noteY, size: 7, font: bold, color: black });
    wrap(invoice.notes, regular, 7.5, 510).slice(0, 3).forEach((line, index) => page.drawText(line, { x: 42, y: noteY - 13 - index * 10, size: 7.5, font: regular, color: gray }));
  }

  drawFooter(page);
  return pdf.save();
}
