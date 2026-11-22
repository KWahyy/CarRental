const evoSlug = "2022-lamborghini-huracan";

async function rows(query) {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().order("id").range(offset, offset + 499);
    if (error) throw error;
    all.push(...data);
    if (data.length < 500) return all;
  }
}

export async function loadNewportFunnel(db) {
  const [clicks, requests, quotes] = await Promise.all([
    rows(() => db.from("fleet_events").select("id,session_id,created_at").eq("event_type","availability_open")
      .eq("car_slug",evoSlug).eq("metadata->>placement","newport_evo_dates")),
    rows(() => db.from("quote_requests").select("id,page_url").like("page_url","%newport_evo_click=%")),
    rows(() => db.from("quotes").select("id,lead_id,vehicle_id").not("lead_id","is",null))
  ]);
  return { clicks, requests, quotes };
}

export function newportCounts(funnel, model, range) {
  const clicks = funnel.clicks.filter(row => {
    const time = new Date(row.created_at);
    return time >= range.start && time <= range.end;
  });
  const clickIds = new Set(clicks.map(row => row.id));
  const sessions = new Set(clicks.map(row => row.session_id).filter(Boolean));
  const leads = new Set();
  for (const request of funnel.requests) {
    let url;
    try { url = new URL(request.page_url); } catch { continue; }
    if (url.pathname === "/booking" && url.searchParams.get("vehicle") === evoSlug &&
        clickIds.has(url.searchParams.get("newport_evo_click"))) leads.add(request.id);
  }
  const car = model.cars.find(row => row.slug === evoSlug);
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  const names = new Set([car?.name, "2022 Lamborghini Huracan", "2022 Lamborghini Huracan EVO Spyder"].filter(Boolean).map(normalize));
  const quotes = new Map(funnel.quotes.filter(row => leads.has(row.lead_id)).map(row => [row.id,row]));
  const paid = new Set();
  const bookingLead = new Map();
  for (const row of model.bookings) {
    if (!leads.has(row.quote_request_id) || !names.has(normalize(row.vehicle)) || row.payment_status === "refunded") continue;
    let finance;
    try { finance = JSON.parse(String(row.notes || "").match(/\[PL_FINANCE\]([^\n]+)/)?.[1] || "{}"); } catch { continue; }
    if (finance.cancelled) continue;
    bookingLead.set(row.id,row.quote_request_id);
    if (Number(row.amount_paid) > 0) paid.add(row.quote_request_id);
  }
  for (const invoice of model.invoices) {
    if (Number(invoice.amount_paid) <= 0 || ["void","refunded","draft"].includes(invoice.status)) continue;
    const quote = quotes.get(invoice.quote_id);
    if (quote?.vehicle_id && quote.vehicle_id !== car?.id) continue;
    if (!names.has(normalize(invoice.vehicle_name)) && !(quote?.vehicle_id && quote.vehicle_id === car?.id && !invoice.vehicle_name)) continue;
    const lead = quote?.lead_id || (invoice.source_type === "quote" ? invoice.source_id : invoice.source_type === "booking" ? bookingLead.get(invoice.source_id) : null);
    if (leads.has(lead)) paid.add(lead);
  }
  return [clicks.length,sessions.size,leads.size,paid.size];
}
