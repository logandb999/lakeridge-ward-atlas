// Exact address-point matching only. No fuzzy street matches or estimated coordinates.
export interface AddressQuery { street: string; city: string; unit: string; number: string }
export interface CountyAddressPoint {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
}

export function normalizeStreet(value: string): string {
  let street = value.toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const replacements: Record<string, string> = { NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W', BOULEVARD: 'BLVD', DRIVE: 'DR', STREET: 'ST', AVENUE: 'AVE', ROAD: 'RD' };
  street = street.split(' ').map(word => replacements[word] ?? word).join(' ');
  // A grid address may be written "E 900 S St" or "E 900 S".
  street = street.replace(/^(\d+ [NSEW] \d+) (?:ST )?([NSEW])(?: ST)?$/, '$1 $2');
  return street;
}

export function parseAddressQuery(address: string): AddressQuery | null {
  const value = address.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const city = [...value.matchAll(/\b(PLEASANT GROVE|OREM)\b/gi)].at(-1);
  if (!city) return null;
  let street = value.slice(0, city.index).replace(/[, ]+$/, '');
  const unitMatch = /(?:\b(?:APT|APARTMENT|UNIT)\s*|#\s*)([A-Z0-9-]+)/i.exec(street);
  const unit = unitMatch?.[1]?.toUpperCase() ?? '';
  if (unitMatch) street = street.replace(unitMatch[0], ' ');
  street = normalizeStreet(street);
  const number = /^\d+\b/.exec(street)?.[0];
  return number ? { street, city: city[1].toUpperCase(), unit, number } : null;
}

function pointStreet(point: CountyAddressPoint): string {
  const a = point.attributes;
  return normalizeStreet(['ADDRNUM', 'ROADPREDIR', 'ROADNAME', 'ROADTYPE', 'ROADPOSTDIR'].map(key => a[key] ?? '').join(' '));
}

export function matchAddressPoint(query: AddressQuery, points: CountyAddressPoint[]) {
  const candidates = points.filter(p => String(p.attributes.CITY).toUpperCase() === query.city && pointStreet(p) === query.street &&
    !/incomplete|retired|proposed/i.test(String(p.attributes.ADDRESS_STATUS ?? '')) &&
    Number.isFinite(p.geometry?.x) && Number.isFinite(p.geometry?.y) &&
    p.geometry!.x >= -114.1 && p.geometry!.x <= -109 && p.geometry!.y >= 37 && p.geometry!.y <= 42.1);
  const exact = candidates.filter(p => String(p.attributes.UNITID ?? '').trim().toUpperCase() === query.unit);
  const building = candidates.filter(p => !String(p.attributes.UNITID ?? '').trim());
  const selected = exact.length ? exact : query.unit ? building : [];
  const distinct = new Set(selected.map(p => `${p.geometry!.x},${p.geometry!.y}`));
  if (selected.length && distinct.size === 1) {
    const point = selected[0];
    return {
      status: query.unit && !exact.length ? 'building_only' as const : 'matched_address_point' as const,
      coordinates: { lat: point.geometry!.y, lng: point.geometry!.x },
      countyAddressId: String(point.attributes.ADDRESSID ?? point.attributes.OBJECTID ?? ''),
      countyAddress: String(point.attributes.FULLADDR ?? pointStreet(point)),
      sourceUnit: String(point.attributes.UNITID ?? ''),
      countyAddressStatus: String(point.attributes.ADDRESS_STATUS ?? ''),
      candidateCount: candidates.length,
    };
  }
  return { status: 'needs_review' as const, reason: candidates.length ? 'No unique address/unit point. Review candidates.' : 'No exact county address point matched.',
    candidateCount: candidates.length };
}
