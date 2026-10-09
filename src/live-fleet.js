import { fleet as snapshot } from './fleet-data.js';
// The response owns the inventory snapshot. Never replace visible inventory after paint.
export const publicPageState = typeof document !== 'undefined'
  ? JSON.parse(document.getElementById('public-page-state')?.textContent || 'null') : null;
export const isPublicRendered = Boolean(publicPageState);
export const fleet = publicPageState?.fleet ?? snapshot;
export { formatPrice, formatCategory } from './fleet-data.js';
export function getVehicle(slug) { return fleet.find(car => car.slug === slug); }
