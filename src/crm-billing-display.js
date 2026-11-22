const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const calendar = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fullCalendar = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export const amountLabel = value => currency.format(Number(value || 0));
export const escapeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function dayLabel(value, year = false) {
  if (!value) return "";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value);
  return Number.isFinite(date.getTime()) ? (year ? fullCalendar : calendar).format(date) : "";
}

export function rentalRange(start, end) {
  const from = dayLabel(start), to = dayLabel(end);
  if (from && to && from !== to) return from + " – " + to;
  return from || to || "Dates pending";
}

export function statePill(label, tone = label) {
  return '<span class="bl-pill" data-state="' + escapeText(tone) + '">' + escapeText(label) + '</span>';
}
