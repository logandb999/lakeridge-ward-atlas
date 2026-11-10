import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../src/data/mockProperties';
import { applySavedLocationReviews, hasMapLocation, stripCachedLocations } from '../src/lib/propertyLocations';
import { isPropertyRecord } from '../src/lib/propertyImport';
import type { Property } from '../src/types';
import type { LocationReviewRecord } from '../src/lib/locationReview';

const now = Date.parse('2026-11-10T00:00:00Z');
function household(): Property {
  return { ...structuredClone(SAMPLE_FICTIONAL_PROPERTIES[0]), importIdentity: { source: 'test', recordId: 'HH-test' },
    householdFlags: ['do_not_contact'], generalNotes: 'Keep existing instruction',
    location: { source: 'google_geocoding', expiresAt: '2026-12-08T00:00:00Z', status: 'matched_building', reviewId: 'review-test' } };
}
function review(): LocationReviewRecord {
  return { id: 'review-test', address: 'Test address', householdIds: ['HH-test'], status: 'confirmed',
    coordinates: { lat: 40.28, lng: -111.69 }, precision: 'RANGE_INTERPOLATED', expiresAt: '2026-12-07T00:00:00Z', revision: 4, reviewNote: 'Pin checked' };
}
test('imports use saved reviewer pins, keep contact restrictions and flag unresolved household/address links', () => {
  const p = household(), r = review();
  const [confirmed] = applySavedLocationReviews([p], [r], now);
  assert.deepEqual(confirmed.coordinates, { ...r.coordinates, x: 500, y: 400 });
  assert.equal(confirmed.location.expiresAt, r.expiresAt);
  assert.equal(confirmed.location.status, 'confirmed');
  assert.match(confirmed.generalNotes, /Keep existing instruction\nPin checked/);
  const [flagged] = applySavedLocationReviews([p], [{ ...r, status: 'needs_contact', outsideWard: true }], now);
  assert.deepEqual(flagged.householdFlags, ['do_not_contact', 'verify_address', 'outside_ward']);
  assert.equal(p.location.status, 'matched_building');
  for (const bad of [{ ...r, householdIds: ['unrelated'] }, { ...r, status: 'pending' as const }, { ...r, expiresAt: '2026-11-01' }]) {
    assert.throws(() => applySavedLocationReviews([p], [bad], now));
  }
});
test('expired locations disappear without dropping households; backups never retain cached Google coordinates', () => {
  const p = household(), manual = structuredClone(SAMPLE_FICTIONAL_PROPERTIES[0]);
  assert.equal(hasMapLocation(p, now), true);
  const expired = { ...p, location: { ...p.location, expiresAt: '2026-11-01' } };
  assert.equal(hasMapLocation(expired, now), false);
  const [cleaned] = stripCachedLocations([expired], false, now);
  assert.equal(cleaned.coordinates, undefined);
  assert.equal(cleaned.occupantSummary, p.occupantSummary);
  assert.ok(isPropertyRecord(cleaned));
  const backup = stripCachedLocations([p, manual], true, now);
  assert.equal(backup[0].coordinates, undefined);
  assert.deepEqual(backup[1], manual);
  assert.ok(p.coordinates);
});
