import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHouseholdCounts, mapPropertyLabel } from '../src/lib/mapLabels';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../src/data/mockProperties';
import type { Property } from '../src/types';

function household(id: string, address: string, name: string, unit?: string): Property {
  return { ...SAMPLE_FICTIONAL_PROPERTIES[0], id, address, occupantSummary: name, unit };
}

test('number labels preserve apartment numbers; surname labels preserve compound surnames', () => {
  const p = household('one', '123 E 850 S, OREM, UT', 'Allred Mafi, Madison Mae', 'Apt 203');
  const counts = buildHouseholdCounts([p]);
  assert.equal(mapPropertyLabel(p, 'house_number', counts), '123 (203)');
  assert.equal(mapPropertyLabel(p, 'last_name', counts), 'Allred Mafi');
  assert.equal(mapPropertyLabel({ ...p, occupantSummary: '' }, 'last_name', counts), 'Last name unavailable');
});

test('shared buildings suppress surnames across units, formatting variants, filters and expired pins', () => {
  const a = household('a', '1050 S OREM BLVD, OREM, UT', 'Example, First', 'Apt 1');
  const b = household('b', '1050 South Orem Boulevard Apt 2\nOrem UT 84058', 'Other, Second');
  b.coordinates = undefined;
  const counts = buildHouseholdCounts([a, b]);
  assert.equal(mapPropertyLabel(a, 'last_name', counts), 'Multiple households');
  assert.equal(mapPropertyLabel(b, 'last_name', counts), 'Multiple households');
  assert.equal(mapPropertyLabel(a, 'house_number', counts), '1050 (1)');
  const different = household('c', '1050 S 100 E, OREM, UT', 'Unique, Third');
  assert.equal(mapPropertyLabel(different, 'last_name', buildHouseholdCounts([a, b, different])), 'Unique');
  assert.equal(mapPropertyLabel(a, 'last_name', buildHouseholdCounts([a, a])), 'Example');
});
