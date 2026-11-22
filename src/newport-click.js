import { recordPublicClick } from "./public-click-tracking.js";

export function trackNewportDateClick(event) {
  if (event.defaultPrevented || event.button > 1) return;
  const link = event.currentTarget;
  const url = new URL(link.href);
  const id = crypto.randomUUID();
  url.searchParams.set("newport_evo_click", id);
  link.href = url.href;
  void recordPublicClick("availability_open", {
    id, carSlug: "2022-lamborghini-huracan", placement: "newport_evo_dates",
  });
}
