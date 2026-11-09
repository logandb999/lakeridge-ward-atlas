import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddressQuery, matchAddressPoint, type CountyAddressPoint } from '../src/lib/addressMatching';

const point = (overrides: Record<string, unknown> = {}, x = -111.69): CountyAddressPoint => ({
  attributes: { CITY: 'OREM', ADDRNUM: '100', ROADPREDIR: 'E', ROADNAME: '900', ROADPOSTDIR: 'S', ROADTYPE: 'ST', UNITID: '', ADDRESSID: 1, ADDRESS_STATUS: 'Complete', ...overrides },
  geometry: { x, y: 40.28 },
});

test('address parsing preserves units and handles grid directions without guessing missing addresses', () => {
  assert.deepEqual(parseAddressQuery('100 East 900 South\nOrem UT 84058'), { street: '100 E 900 S', city: 'OREM', unit: '', number: '100' });
  assert.equal(parseAddressQuery('1070 S #4 Orem Blvd\nOrem UT')?.street, '1070 S OREM BLVD');
  assert.equal(parseAddressQuery('1070 S #4 Orem Blvd\nOrem UT')?.unit, '4');
  assert.equal(parseAddressQuery('100 E 900 S\nUnit B\nOrem UT')?.unit, 'B');
  assert.equal(parseAddressQuery(''), null);
  assert.equal(parseAddressQuery('An unknown street'), null);
});

test('only exact, unique address points match; unmatched apartments remain explicit building-only locations', () => {
  const q = parseAddressQuery('100 E 900 S Orem UT')!;
  const result = matchAddressPoint(q, [point()]);
  assert.equal(result.status, 'matched_address_point');
  assert.deepEqual('coordinates' in result && result.coordinates, { lat: 40.28, lng: -111.69 });
  assert.equal(matchAddressPoint({ ...q, unit: 'B' }, [point()]).status, 'building_only');
  assert.equal(matchAddressPoint({ ...q, unit: 'B' }, [point({ UNITID: 'B' })]).status, 'matched_address_point');
  assert.equal(matchAddressPoint(q, [point(), point({}, -111.7)]).status, 'needs_review');
  assert.equal(matchAddressPoint(q, [point({ CITY: 'PLEASANT GROVE' })]).status, 'needs_review');
  assert.equal(matchAddressPoint(q, [point({ ROADNAME: '901' })]).status, 'needs_review');
  assert.equal(matchAddressPoint(q, [point({ ADDRESS_STATUS: 'Incomplete' })]).status, 'needs_review');
  assert.equal(matchAddressPoint(q, [point({}, 0)]).status, 'needs_review');
});
