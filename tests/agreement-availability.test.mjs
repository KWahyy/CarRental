import test from 'node:test';
import assert from 'node:assert/strict';
import { vehicleAvailability, assertVehicleAvailable } from '../api/_fleet-core.js';
import { publicUrl } from '../api/agreements.js';

const id = '11111111-1111-4111-8111-111111111111';
const start = '2026-10-01T10:00:00Z';
const end = '2026-10-03T10:00:00Z';

async function withInventory(vehicle, reservations, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    let rows = [];
    if (parsed.pathname.endsWith('/cars')) {
      assert.equal(parsed.searchParams.get('select'), '*');
      rows = [vehicle];
    } else if (parsed.pathname.endsWith('/rental_agreements') && parsed.searchParams.get('vehicle_id') !== 'is.null') {
      rows = reservations;
    }
    return new Response(JSON.stringify(rows), { status: 200 });
  };
  try { await callback(); } finally { globalThis.fetch = originalFetch; }
}

test('older cars schema supports availability without operational_status', async () => {
  await withInventory({ id, name: 'Huracan', is_active: true }, [], async () => {
    const result = await vehicleAvailability(id, start, end, 'test-session');
    assert.equal(result.available, true);
  });
});

test('maintenance holds still prevent agreement creation', async () => {
  await withInventory({ id, name: 'Huracan', is_active: true, operational_status: 'maintenance' }, [], async () => {
    await assert.rejects(assertVehicleAvailable(id, start, end, 'test-session'), /unavailable.*maintenance/);
  });
});

test('overlapping agreements still block saves; editing the same agreement works', async () => {
  const agreement = { id: 'existing', agreement_number: 'TEST', customer_name: 'Test renter', rental_start_at: start, rental_end_at: end };
  await withInventory({ id, name: 'Huracan', is_active: true }, [agreement], async () => {
    await assert.rejects(assertVehicleAvailable(id, start, end, 'test-session'), /unavailable/);
    const result = await vehicleAvailability(id, start, end, 'test-session', { excludeAgreementId: 'existing' });
    assert.equal(result.available, true);
  });
});

test('remote signing links never inherit localhost or an untrusted host', () => {
  for (const host of ['localhost:4173', '127.0.0.1:8765', 'preview.example.com', 'untrusted.example']) {
    assert.equal(publicUrl({ headers: { host, origin: `http://${host}` } }, 'a'.repeat(48)),
      `https://www.prestigeluxor.com/agreement?token=${'a'.repeat(48)}`);
  }
});
