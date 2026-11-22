import { deskDay } from './crm-dispatch-data.js';
import { isTestInquiry } from './crm-desk-demand.js';
import { escapeFleetText as esc } from './home-fleet-model.js';

const zone = 'America/Los_Angeles';
const format = options => new Intl.DateTimeFormat('en-US', {timeZone:zone, ...options});
const shortDate = format({month:'short', day:'numeric'});
const clock = format({hour:'numeric', minute:'2-digit', timeZoneName:'short'});
const dayMs = 86400000;
const openQuotes = new Set(['draft','sent','viewed','follow_up','accepted','deposit_pending']);
const openRequests = new Set(['new','contacted','checking','available','alternative','approved']);
// Imported records sometimes have a date without a time. Noon UTC preserves its Pacific civil day.
function asTime(value) {
  if (!value || typeof value !== 'string') return NaN;
  const parts = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/i.exec(value);
  if (!parts) return NaN;
  const calendar = new Date(parts[1] + 'T12:00:00Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10) !== parts[1]) return NaN;
  return value === parts[1] ? calendar.getTime() : Date.parse(value);
}

function scheduled(record, kind, customer, detail, today) {
  const stamp = asTime(record.follow_up_at);
  if (!Number.isFinite(stamp)) return null;
  const day = deskDay(stamp);
  const urgency = day < today ? 'overdue' : day === today ? 'today' : 'upcoming';
  const dateOnly = record.follow_up_at.length === 10;
  const due = dateOnly ? shortDate.format(stamp) : day === today ? clock.format(stamp) :
    shortDate.format(stamp) + ' · ' + clock.format(stamp);
  return {kind, id:record.id, customer, detail, urgency, timestamp:record.follow_up_at, stamp, due,
    label:{overdue:'Overdue', today:'Today', upcoming:'Upcoming'}[urgency]};
}

function firstReplies(requests, linked, today) {
  const todayStamp = asTime(today);
  const candidates = new Map();
  for (const request of requests) {
    if ((request.status || 'new') !== 'new' || linked.has(String(request.id))) continue;
    const pickup = asTime(request.rental_date);
    const created = asTime(request.created_at);
    if (!Number.isFinite(pickup) || !Number.isFinite(created)) continue;
    const pickupDay = asTime(deskDay(pickup));
    const receivedDay = asTime(deskDay(created));
    if (pickupDay < todayStamp || pickupDay > todayStamp + 14 * dayMs ||
        receivedDay > todayStamp || receivedDay < todayStamp - 29 * dayMs) continue;
    // A retried form can create another ID for the exact same trip. Keep the latest request to review.
    const contact = String(request.email || '').trim().toLowerCase() || String(request.phone || '').replace(/\D/g, '');
    const tripNotes = String(request.message || '').split(/(?:^|\n\n)(?:Acquisition source|Acquisition channel|Submission page|Latest touch):/)[0].trim();
    const key = contact ? JSON.stringify([contact,request.name?.trim().toLowerCase(),request.vehicle?.trim().toLowerCase(),
      request.rental_date,request.return_date || '',tripNotes]) : request.id;
    if ((candidates.get(key)?.created ?? -Infinity) >= created) continue;
    candidates.set(key, {kind:'quote',id:request.id,customer:request.name,detail:request.vehicle,urgency:'unanswered',
      label:'Review inquiry',due:'Pickup ' + shortDate.format(pickup),timestamp:request.rental_date,stamp:pickup,created});
  }
  return [...candidates.values()].sort((a,b) => a.stamp-b.stamp || a.created-b.created);
}

function datedRows(quotes, requests, today, now) {
  const reminders = [];
  const outstanding = [];
  const linked = new Set();
  const converted = new Set();
  const proposalReminders = new Set();
  for (const quote of quotes) {
    if (!quote.id) continue;
    const lead = String(quote.lead_id || '');
    if (lead) linked.add(lead);
    if (quote.reservation_id || quote.status === 'converted') {
      if (lead) converted.add(lead);
      continue;
    }
    if (!openQuotes.has(quote.status) || (quote.status !== 'accepted' && asTime(quote.expires_at) < now)) continue;
    const customer = [quote.customer_first_name,quote.customer_last_name].filter(Boolean).join(' ') || quote.customer_name;
    if (isTestInquiry({name:customer, email:quote.customer_email, vehicle:quote.vehicle_name})) continue;
    const detail = [quote.vehicle_name,quote.quote_number].filter(Boolean).join(' · ');
    const reminder = scheduled(quote, 'proposal', customer, detail, today);
    if (reminder) {
      reminders.push(reminder);
      if (lead) proposalReminders.add(lead + '/' + reminder.stamp);
      continue;
    }
    const pickup = asTime(quote.start_at);
    if (Number.isFinite(pickup) && deskDay(pickup) < today) continue;
    if (quote.status !== 'sent' && quote.status !== 'viewed' && !(quote.status === 'follow_up' && quote.sent_at)) continue;
    outstanding.push({kind:'proposal',id:quote.id,customer,detail,urgency:'unscheduled',label:'No reminder',
      due:quote.status === 'viewed' ? 'Quote viewed' : 'Quote sent',stamp:asTime(quote.sent_at) || asTime(quote.created_at) || 0});
  }
  for (const request of requests) {
    if (!openRequests.has(request.status || 'new') || converted.has(String(request.id))) continue;
    const reminder = scheduled(request, 'quote', request.name, request.vehicle, today);
    if (reminder && !proposalReminders.has(request.id + '/' + reminder.stamp)) reminders.push(reminder);
  }
  reminders.sort((a,b) => a.stamp-b.stamp || String(a.id).localeCompare(String(b.id)));
  outstanding.sort((a,b) => a.stamp-b.stamp || String(a.id).localeCompare(String(b.id)));
  return {reminders, outstanding, linked};
}

function rowMarkup(row) {
  const timing = row.timestamp ? `<time datetime="${esc(row.timestamp)}">${esc(row.due)}</time>` : esc(row.due);
  return `<button type="button" class="desk-followup-row" data-urgency="${row.urgency}" data-dashboard-open="${row.kind}" data-id="${esc(row.id)}">
    <span class="desk-followup-person"><strong>${esc(row.customer || 'Customer name unavailable')}</strong><small>${esc(row.detail || 'Vehicle to confirm')}</small></span>
    <span class="desk-followup-timing"><strong>${row.label}</strong><small>${timing}</small></span><span class="desk-followup-arrow" aria-hidden="true">›</span></button>`;
}

export function renderDeskFollowups({quotes=[], requests=[], failed=false, requestsFailed=false, now=new Date(), today=deskDay(now)} = {}) {
  const realRequests = requests.filter(request => request.id && request.source !== 'partner-vehicle-review' && !isTestInquiry(request));
  const {reminders, outstanding, linked} = datedRows(quotes, realRequests, today, new Date(now).getTime());
  let rows = reminders.length ? reminders : outstanding;
  if (!rows.length && !failed) rows = firstReplies(realRequests, linked, today);
  const incomplete = failed || requestsFailed;
  const message = incomplete ? (rows.length ? 'Some sales records could not be loaded.' : 'Follow-up records are unavailable.') : '';
  return `<section class="desk-followups" data-desk-followups aria-labelledby="desk-followups-title">
    <header><h3 id="desk-followups-title">Sales follow-ups</h3><button type="button" data-dashboard-section="requests">View quotes <span aria-hidden="true">↗</span></button></header>
    ${message ? `<p class="desk-source-note" role="status">${message}</p>` : ''}
    ${rows.length ? `<div class="desk-followup-list">${rows.slice(0,4).map(rowMarkup).join('')}</div>` : incomplete ? '' : '<p class="desk-no-data">No follow-ups scheduled.</p>'}
    </section>`;
}
