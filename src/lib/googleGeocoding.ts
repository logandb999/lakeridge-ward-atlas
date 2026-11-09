import { normalizeStreet, type AddressQuery } from './addressMatching';

export const GEOCODING_CACHE_DAYS = 29;
export const GEOCODING_ASSESSMENT_VERSION = 'orem-street-variants-v1';
export function buildingQueryKey(query: AddressQuery): string { return `${query.street}|${query.city}`; }

export function needsGeocodingLookup(entry: any, recheckReview = false): boolean {
  return !entry || entry.status === 'expired' || (recheckReview && entry.status === 'needs_review' && entry.assessmentVersion !== GEOCODING_ASSESSMENT_VERSION);
}

function knownOremStreetVariant(query: AddressQuery, returnedStreet: string, location: { lat: number; lng: number }): boolean {
  if (query.city !== 'OREM' || !location) return false;
  // Only the two observed grid-road labels, with the same house number. Coordinate
  // corridors guard against accepting an omitted direction on the other side of town.
  // These are match checks, not ward boundaries or newly estimated coordinates.
  const east1000 = /^(\d+) E 1000 S$/.exec(query.street);
  if (east1000 && returnedStreet === `${east1000[1]} 1000 S`) {
    return location.lat >= 40.278 && location.lat <= 40.280 && location.lng >= -111.695 && location.lng <= -111.686;
  }
  const south50 = /^(\d+) S 50 E$/.exec(query.street);
  if (south50 && returnedStreet === `${south50[1]} 50 E`) {
    return location.lat >= 40.277 && location.lat <= 40.284 && location.lng >= -111.6946 && location.lng <= -111.693;
  }
  return false;
}

export function assessGoogleGeocode(query: AddressQuery, response: any) {
  if (response.status !== 'OK' || response.results?.length !== 1) {
    return { status: 'needs_review' as const, reason: response.status === 'ZERO_RESULTS' ? 'No address match.' : 'No single unambiguous result.',
      placeIds: (response.results ?? []).map((r: any) => r.place_id).filter((id: unknown) => typeof id === 'string') };
  }
  const result = response.results[0];
  const component = (type: string, short = false) => {
    const value = result.address_components?.find((c: any) => c.types?.includes(type));
    return (short ? value?.short_name : value?.long_name) ?? '';
  };
  const street = normalizeStreet(`${component('street_number')} ${component('route')}`);
  const city = component('locality').toUpperCase();
  const location = result.geometry?.location;
  const validLocation = Number.isFinite(location?.lat) && Number.isFinite(location?.lng) &&
    location.lat >= 37 && location.lat <= 42.1 && location.lng >= -114.1 && location.lng <= -109;
  const namingVariant = validLocation && knownOremStreetVariant(query, street, location);
  const exactAddress = (street === query.street || namingVariant) && city === query.city && component('administrative_area_level_1', true) === 'UT' && component('country', true) === 'US';
  const exact = validLocation && exactAddress && !result.partial_match && result.geometry.location_type === 'ROOFTOP';
  return {
    status: exact ? 'matched_building' as const : 'needs_review' as const,
    reason: exact ? namingVariant ? 'Rooftop match with a recognized Orem street-name variant; apartment location is not verified.' : 'Exact rooftop building match; apartment location is not verified.' : !validLocation ? 'Returned coordinates are missing or outside Utah.' :
      !exactAddress ? 'Returned street or city differs from the requested address.' : result.partial_match ? 'Google returned a partial match.' : 'Location is approximate rather than rooftop.',
    placeIds: typeof result.place_id === 'string' ? [result.place_id] : [],
    diagnostics: { requestedStreet: query.street, returnedStreet: street, requestedCity: query.city, returnedCity: city,
      returnedState: component('administrative_area_level_1', true), returnedCountry: component('country', true),
      locationType: result.geometry?.location_type ?? '', partialMatch: result.partial_match === true, namingVariant: !!namingVariant },
    ...(validLocation ? { coordinates: { lat: location.lat, lng: location.lng } } : {}),
  };
}

export function expireGoogleCacheEntry(entry: any, now = Date.now()) {
  if (Number.isFinite(Date.parse(entry.expiresAt)) && Date.parse(entry.expiresAt) > now) return entry;
  // Retain our input and the exempt place IDs, not expired Google coordinates or response fields.
  return { queryKey: entry.queryKey, inputAddress: entry.inputAddress, placeIds: entry.placeIds ?? [], status: 'expired', reason: 'Coordinates need a fresh lookup.' };
}
