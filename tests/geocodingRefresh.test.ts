import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRefreshLocation, canAcceptRefreshedLocation } from '../src/lib/geocodingRefresh';
import { assessGoogleGeocode } from '../src/lib/googleGeocoding';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../src/data/mockProperties';
import { refreshHouseholdLocations } from '../src/server/geocodingRefresh';
import type { Property } from '../src/types';

function household(status: 'matched_building' | 'confirmed' | 'needs_contact' = 'matched_building'): Property {
  return { ...structuredClone(SAMPLE_FICTIONAL_PROPERTIES[0]), coordinates: { lat: 40.28, lng: -111.69, x: 500, y: 400 },
    location: { source: 'google_geocoding', status, expiresAt: '2026-12-08T22:00:00Z' } };
}
function lookup(lat = 40.28, precision = 'ROOFTOP', partial = false) {
  return assessGoogleGeocode({ street: '123 E 1000 S', city: 'OREM', number: '123', unit: '' }, { status: 'OK', results: [{
    place_id: 'test-place', partial_match: partial,
    geometry: { location_type: precision, location: { lat, lng: -111.69 } },
    address_components: [
      { types: ['street_number'], long_name: '123' }, { types: ['route'], long_name: 'E 1000 S' },
      { types: ['locality'], long_name: 'Orem' }, { types: ['administrative_area_level_1'], short_name: 'UT' },
      { types: ['country'], short_name: 'US' },
    ],
  }] });
}
test('monthly refresh checks the 25th and begins early enough to cover long months and retries', () => {
  const p = household();
  assert.equal(shouldRefreshLocation(p, new Date('2026-11-24T07:00:00Z')), false);
  assert.equal(shouldRefreshLocation(p, new Date('2026-11-25T07:00:00Z')), true);
  p.location.refreshedAt = '2026-11-23T07:00:00Z';
  assert.equal(shouldRefreshLocation(p, new Date('2026-11-25T07:00:00Z')), false);
  assert.equal(shouldRefreshLocation(p, new Date('2026-12-05T07:00:00Z')), true);
  delete p.coordinates;
  assert.equal(shouldRefreshLocation(p, new Date('2026-12-09T07:00:00Z')), true);
  delete p.location;
  assert.equal(shouldRefreshLocation(p, new Date('2026-12-25T07:00:00Z')), false);
});
test('reviewed pins accept only fresh agreeing coordinates; approximate or shifted results require review', () => {
  assert.equal(canAcceptRefreshedLocation(household(), lookup()), true);
  assert.equal(canAcceptRefreshedLocation(household(), lookup(40.29)), false);
  assert.equal(canAcceptRefreshedLocation(household(), lookup(40.28, 'RANGE_INTERPOLATED')), false);
  for (const status of ['confirmed', 'needs_contact'] as const) {
    assert.equal(canAcceptRefreshedLocation(household(status), lookup(40.28, 'RANGE_INTERPOLATED')), true);
    assert.equal(canAcceptRefreshedLocation(household(status), lookup(40.2801)), false);
    assert.equal(canAcceptRefreshedLocation(household(status), lookup(40.28, 'ROOFTOP', true)), false);
  }
  assert.equal(canAcceptRefreshedLocation(household(), assessGoogleGeocode({} as any, { status: 'ZERO_RESULTS', results: [] })), false);
});
test('dry runs deduplicate household addresses and never write or call Google', async () => {
  const p = household();
  p.address = '123 E 1000 S, OREM, UT';
  const sql = async (parts: TemplateStringsArray) => {
    assert.match(parts.join(''), /^SELECT data FROM atlas_state/);
    return [{ data: [p, { ...p, id: 'second-household', unit: 'Apt 2' }] }];
  };
  const result = await refreshHouseholdLocations(sql as any, new Date('2026-11-25T07:00:00Z'), true);
  assert.equal(result.dueBuildings, 1);
  assert.equal(result.requests, 0);
});
