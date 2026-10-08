import test from 'node:test';
import assert from 'node:assert/strict';
import { readTripSearch, tripSearchParams } from '../src/rental-search.js';
test('city and dates round-trip without inventing pickup times', () => {
 const trip = readTripSearch('?deliveryCity=Newport+Beach&pickup=2026-11-10&return=2026-11-12');
 assert.deepEqual(trip,{city:'Newport Beach',pickup:'2026-11-10',returnDate:'2026-11-12'});
 assert.deepEqual(readTripSearch('?' + tripSearchParams(trip)),trip);
});
test('invalid dates and reversed trips are discarded', () => {
 assert.equal(readTripSearch('?pickup=2026-02-30').pickup,'');
 assert.equal(readTripSearch('?pickup=2026-11-10&return=2026-11-09').returnDate,'');
 assert.equal(readTripSearch('?deliveryCity='+ 'x'.repeat(300)).city.length,100);
});
