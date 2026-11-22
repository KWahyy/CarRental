import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const sessionKey = "prestige_luxor_fleet_analytics_session";

function clickSessionId() {
  try {
    const existing = sessionStorage.getItem(sessionKey);
    if (existing) return existing.slice(0, 120);
    const id = crypto.randomUUID();
    sessionStorage.setItem(sessionKey, id);
    return id;
  } catch {
    return "";
  }
}

// Queue the event before the link navigates or hands control to the phone app.
export async function recordPublicClick(eventType, { id, carSlug = "", placement }) {
  if (!["www.prestigeluxor.com", "prestigeluxor.com"].includes(location.hostname)) return;
  try {
    await fetch(SUPABASE_URL + "/rest/v1/fleet_events", {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        id: id ?? crypto.randomUUID(),
        event_type: eventType,
        car_slug: carSlug,
        session_id: clickSessionId(),
        page_path: location.pathname.slice(0, 240),
        metadata: { placement },
      }),
    });
  } catch {
    // Navigation and dialing still work when telemetry is unavailable.
  }
}
