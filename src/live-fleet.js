import { fleet as snapshot } from './fleet-data.js';
import { loadFleetFromSupabase } from './supabase-fleet.js';
import { resolveLiveFleet } from './fleet-source.js';

// All public pages use the same current inventory, including CRM photo edits.
// The build snapshot remains a fallback, not the normal source of truth.
export const fleet = await resolveLiveFleet(snapshot, loadFleetFromSupabase);
export { formatPrice, formatCategory } from './fleet-data.js';
export function getVehicle(slug) {
  return fleet.find(car => car.slug === slug);
}
