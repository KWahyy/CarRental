// Only known acquisition parameters may reach advertising measurement.
const allowedKeys = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'oppref', 'fbclid', 'gclid', 'gbraid', 'wbraid']);
export function safeMeasurementSearch(search) {
  for (const [key, value] of new URLSearchParams(search)) {
    if (!allowedKeys.has(key) || /@|%40/i.test(value)) return false;
  }
  return true;
}
export function safeMeasurementReferrer(referrer) {
  if (!referrer) return true;
  try { return safeMeasurementSearch(new URL(referrer).search); } catch { return false; }
}
