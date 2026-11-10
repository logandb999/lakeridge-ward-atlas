import type { Property } from '../types/index';
import { normalizeStreet, parseAddressQuery } from './addressMatching';

export type MapLabelMode = 'house_number' | 'last_name';

// Count the whole building, including apartments, before applying map filters.
function buildingKey(address: string): string {
  const parsed = parseAddressQuery(address);
  if (parsed) return `${parsed.street}|${parsed.city}`;
  return normalizeStreet(address.replace(/(?:\b(?:APT|APARTMENT|UNIT)\s*|#\s*)[A-Z0-9-]+/gi, ''));
}

export function buildHouseholdCounts(properties: Property[]): Map<string, number> {
  const counts = new Map<string, Set<string>>();
  for (const p of properties) {
    const key = buildingKey(p.address);
    const ids = counts.get(key) ?? new Set<string>();
    ids.add(p.id);
    counts.set(key, ids);
  }
  return new Map([...counts].map(([key, ids]) => [key, ids.size]));
}

export function mapPropertyLabel(property: Property, mode: MapLabelMode, counts: Map<string, number>): string {
  if (mode === 'house_number') {
    const number = property.address.trim().split(/\s+/)[0];
    return `${number}${property.unit ? ` (${property.unit.replace(/^(?:apt|apartment|unit)\s*|^#\s*/i, '')})` : ''}`;
  }
  if ((counts.get(buildingKey(property.address)) ?? 0) > 1) return 'Multiple households';
  // Directory names use "Last name, Given names". Preserve compound last names.
  const name = property.occupantSummary.trim();
  const comma = name.indexOf(',');
  if (comma > 0) return name.slice(0, comma).trim();
  if (name && !/\s/.test(name)) return name;
  return 'Last name unavailable';
}
