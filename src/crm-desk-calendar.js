import { deskDay } from "./crm-dispatch-data.js";

const format = options => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options });
const monthLabel = format({ month: "long", year: "numeric" });
const weekday = format({ weekday: "short" });
const fullDate = format({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
const agendaDate = format({ weekday: "long", month: "short", day: "numeric" });
const civil = day => new Date(day + "T12:00:00Z");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Pacific civil dates are converted to UTC only for calendar arithmetic.
function addDays(day, count) {
  const date = civil(day);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
const startOfWeek = day => addDays(day, -civil(day).getUTCDay());
let selectedDay = "";

function selection(today) {
  return selectedDay < today ? today : selectedDay;
}

const arrow = direction => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${direction === "prev" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}"/></svg>`;

function groupByDay(rows) {
  const days = new Map();
  for (const row of rows) {
    if (!days.has(row.day)) days.set(row.day, []);
    days.get(row.day).push(row);
  }
  return days;
}

function calendarContents(days, day, today, unavailable) {
  const first = startOfWeek(day);
  const cells = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(first, i);
    const date = civil(iso);
    const count = days.get(iso)?.length || 0;
    const hasEvents = count && !unavailable;
    const schedule = unavailable || iso < today ? "" : `, ${count} handoff${count === 1 ? "" : "s"}`;
    return `<button type="button" class="desk-calendar-date" data-desk-calendar-day="${iso}" aria-label="${fullDate.format(date)}${schedule}"
      aria-pressed="${iso === day}" tabindex="${iso === day ? 0 : -1}" ${iso === today ? 'aria-current="date"' : ''} ${iso < today ? 'disabled' : ''}>
      <span>${weekday.format(date).slice(0, 2)}</span><b>${date.getUTCDate()}</b><i aria-hidden="true" data-occupied="${Boolean(hasEvents)}"></i></button>`;
  }).join("");
  const scheduled = days.get(day) || [];
  const items = scheduled.map(row => `<li><button type="button" data-desk-calendar-handoff="${escapeHtml(row.key)}">
    <span class="desk-calendar-info"><strong>${escapeHtml(row.vehicle)}</strong><small>${escapeHtml(row.type)} · ${escapeHtml(row.time)}</small></span>
    ${arrow("next")}</button></li>`).join("");
  const summary = unavailable
    ? '<p class="desk-calendar-quiet" role="status">Handoff schedule unavailable.</p>'
    : items ? `<ul>${items}</ul>` : '<p class="desk-calendar-quiet">No handoffs scheduled.</p>';
  return `<header class="desk-calendar-head"><span>Handoff calendar</span><button type="button" class="desk-calendar-today" data-desk-calendar-nav="today">Today</button></header>
    <div class="desk-calendar-datehead"><h3>${monthLabel.format(civil(day))}</h3>
      <div class="desk-calendar-arrows">
        <button type="button" data-desk-calendar-nav="prev" aria-label="Previous week" ${first <= startOfWeek(today) ? "disabled" : ""}>${arrow("prev")}</button>
        <button type="button" data-desk-calendar-nav="next" aria-label="Next week">${arrow("next")}</button>
      </div></div>
    <div class="desk-calendar-week" role="group" aria-label="Choose a handoff date">${cells}</div>
    <div class="desk-calendar-agenda" aria-live="polite" aria-atomic="true">
      <h4>${agendaDate.format(civil(day))}</h4>${summary}</div>`;
}

export function renderDeskCalendar(rows, { unavailable = false } = {}) {
  const today = deskDay();
  return `<section class="desk-calendar" data-desk-calendar data-unavailable="${unavailable}" aria-label="Handoff calendar">
    ${calendarContents(groupByDay(rows), selection(today), today, unavailable)}</section>`;
}

export function bindDeskCalendar(host, rows, { openHandoff }) {
  const card = host?.matches("[data-desk-calendar]") ? host : host?.querySelector("[data-desk-calendar]");
  if (!card) return;
  const days = groupByDay(rows);
  const unavailable = card.dataset.unavailable === "true";

  function select(day, nav) {
    const today = deskDay();
    selectedDay = day < today ? today : day;
    card.innerHTML = calendarContents(days, selectedDay, today, unavailable);
    const trigger = nav && card.querySelector(`[data-desk-calendar-nav="${nav}"]:not(:disabled)`);
    (trigger || card.querySelector('[data-desk-calendar-day][aria-pressed="true"]'))?.focus({ preventScroll: true });
  }

  card.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const {deskCalendarHandoff: key, deskCalendarDay: day, deskCalendarNav: nav} = button.dataset;
    if (key) { openHandoff(key, button); return; }
    if (day) { select(day); return; }
    const today = deskDay();
    if (nav === "today") select(today, nav);
    if (nav === "prev" || nav === "next") select(addDays(selection(today), nav === "prev" ? -7 : 7), nav);
  });

  card.addEventListener("keydown", event => {
    const day = event.target.closest("[data-desk-calendar-day]")?.dataset.deskCalendarDay;
    if (!day) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -7, PageDown: 7 };
    let next;
    if (event.key in step) next = addDays(day, step[event.key]);
    if (event.key === "Home") next = startOfWeek(day);
    if (event.key === "End") next = addDays(startOfWeek(day), 6);
    if (!next) return;
    event.preventDefault();
    select(next);
  });
}
