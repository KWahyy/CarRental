import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

export function trackNewportDateClick(event) {
  if (event.defaultPrevented || event.button > 1) return;
  const link = event.currentTarget;
  const url = new URL(link.href);
  const id = crypto.randomUUID();
  url.searchParams.set("newport_evo_click", id);
  link.href = url.href;
  if (!["www.prestigeluxor.com", "prestigeluxor.com"].includes(location.hostname)) return;
  let session = "";
  try {
    const key = "prestige_luxor_fleet_analytics_session";
    session = sessionStorage.getItem(key) || crypto.randomUUID();
    sessionStorage.setItem(key, session);
  } catch { /* Count the click even if the browser disables session storage. */ }
  void fetch(SUPABASE_URL + "/rest/v1/fleet_events", {
    method: "POST", keepalive: true, credentials: "omit",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({id, event_type: "availability_open", car_slug: "2022-lamborghini-huracan",
      session_id: session, page_path: location.pathname, metadata: { placement: "newport_evo_dates" }})
  }).catch(() => {});
}
