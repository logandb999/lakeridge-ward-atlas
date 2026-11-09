import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessGoogleGeocode, expireGoogleCacheEntry, buildingQueryKey, needsGeocodingLookup, GEOCODING_ASSESSMENT_VERSION } from '../src/lib/googleGeocoding';
import { parseAddressQuery } from '../src/lib/addressMatching';

const query = parseAddressQuery('100 E 900 S Unit B, Orem UT 84058')!;
const result = { place_id: 'test-place', partial_match: false, geometry: { location: { lat: 40.28, lng: -111.69 }, location_type: 'ROOFTOP' },
  address_components: [
    { long_name: '100', types: ['street_number'] }, { long_name: 'E 900 S St', types: ['route'] },
    { long_name: 'Orem', types: ['locality'] }, { short_name: 'UT', types: ['administrative_area_level_1'] }, { short_name: 'US', types: ['country'] },
  ] };

test('Google matching accepts exact rooftops and flags partial, approximate, wrong-address and ambiguous results', () => {
  assert.equal(assessGoogleGeocode(query, { status: 'OK', results: [result] }).status, 'matched_building');
  assert.equal(buildingQueryKey(query), buildingQueryKey({ ...query, unit: 'C' }));
  for (const changed of [
    { ...result, partial_match: true },
    { ...result, geometry: { ...result.geometry, location_type: 'RANGE_INTERPOLATED' } },
    { ...result, address_components: [] },
    { ...result, geometry: { ...result.geometry, location: { lat: 0, lng: 0 } } },
  ]) assert.equal(assessGoogleGeocode(query, { status: 'OK', results: [changed] }).status, 'needs_review');
  assert.equal(assessGoogleGeocode(query, { status: 'OK', results: [result, result] }).status, 'needs_review');
  assert.equal(assessGoogleGeocode(query, { status: 'ZERO_RESULTS', results: [] }).status, 'needs_review');
});

test('expired cache entries discard coordinates and Google response data while retaining place IDs and our input', () => {
  const entry = { queryKey: 'input', inputAddress: 'Our source address', placeIds: ['place'], coordinates: { lat: 40, lng: -111 },
    status: 'matched_building', formattedAddress: 'Google response', expiresAt: '2026-11-01T00:00:00Z' };
  const expired = expireGoogleCacheEntry(entry, Date.parse('2026-11-09T00:00:00Z'));
  assert.equal(expired.status, 'expired');
  assert.equal('coordinates' in expired, false);
  assert.equal('formattedAddress' in expired, false);
  assert.deepEqual(expired.placeIds, ['place']);
  assert.equal(expireGoogleCacheEntry({ ...entry, expiresAt: '2026-12-01T00:00:00Z' }, Date.parse('2026-11-09T00:00:00Z')).status, 'matched_building');
});

test('only observed Orem street-label omissions qualify, with matching house number, city, rooftop and local coordinates', () => {
  function response(streetNumber: string, route: string, lat: number, lng: number) {
    return { ...result, geometry: { ...result.geometry, location: { lat, lng } }, address_components: [
      { long_name: streetNumber, types: ['street_number'] }, { long_name: route, types: ['route'] }, ...result.address_components.slice(2),
    ] };
  }
  const q = parseAddressQuery('100 E 1000 S Orem UT')!;
  const alias = response('100', '1000 S', 40.279, -111.692);
  assert.equal(assessGoogleGeocode(q, { status: 'OK', results: [alias] }).status, 'matched_building');
  const q2 = parseAddressQuery('800 S 50 E Orem UT')!;
  assert.equal(assessGoogleGeocode(q2, { status: 'OK', results: [response('800', '50 E', 40.281, -111.694)] }).status, 'matched_building');
  for (const rejected of [
    response('101', '1000 S', 40.279, -111.692),
    response('100', '1000 S', 40.279, -111.71),
    response('100', '1000 N', 40.279, -111.692),
    { ...alias, partial_match: true },
    { ...alias, geometry: { ...alias.geometry, location_type: 'RANGE_INTERPOLATED' } },
  ]) assert.equal(assessGoogleGeocode(q, { status: 'OK', results: [rejected] }).status, 'needs_review');
  const commerce = parseAddressQuery('450 S Commerce St Orem UT')!;
  assert.equal(assessGoogleGeocode(commerce, { status: 'OK', results: [response('450', 'S Commerce Dr', 40.285, -111.72)] }).status, 'needs_review');
  const mountain = parseAddressQuery('500 Mountain Way Dr Orem UT')!;
  assert.equal(assessGoogleGeocode(mountain, { status: 'OK', results: [response('500', 'S Mountain Way Dr', 40.5004, -111.72)] }).status, 'needs_review');
});

test('flagged-only recheck is resumable and never refreshes an unexpired accepted building', () => {
  assert.equal(needsGeocodingLookup({ status: 'matched_building' }, true), false);
  assert.equal(needsGeocodingLookup({ status: 'needs_review' }), false);
  assert.equal(needsGeocodingLookup({ status: 'needs_review' }, true), true);
  assert.equal(needsGeocodingLookup({ status: 'needs_review', assessmentVersion: GEOCODING_ASSESSMENT_VERSION }, true), false);
  assert.equal(needsGeocodingLookup({ status: 'expired' }, true), true);
});
