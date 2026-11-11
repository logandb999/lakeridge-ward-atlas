import type { Property } from '../types/index';
import { assessGoogleGeocode } from './googleGeocoding';

const DAY = 86400000;

export function shouldRefreshLocation(property: Property, now: Date): boolean {
  const location = property.location;
  if (location?.source !== 'google_geocoding') return false;
  const expiresAt = Date.parse(location.expiresAt);
  const checkedAt = Date.parse(location.refreshedAt ?? '');
  const checkedThisMonth = Number.isFinite(checkedAt) &&
    new Date(checkedAt).toISOString().slice(0, 7) === now.toISOString().slice(0, 7);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime() + 4 * DAY ||
    (now.getUTCDate() === 25 && !checkedThisMonth);
}

export function canAcceptRefreshedLocation(property: Property, result: ReturnType<typeof assessGoogleGeocode>): boolean {
  if (!('coordinates' in result) || !('diagnostics' in result)) return false;
  const diagnostic = result.diagnostics;
  const sameAddress = diagnostic && diagnostic.requestedCity === diagnostic.returnedCity &&
    (diagnostic.requestedStreet === diagnostic.returnedStreet || diagnostic.namingVariant) &&
    diagnostic.returnedState === 'UT' && diagnostic.returnedCountry === 'US' && !diagnostic.partialMatch;
  if (!result.coordinates || !sameAddress) return false;
  if (property.location?.status !== 'matched_building') {
    // A fresh result must agree with a reviewed placement. Never extend an old
    // manually moved coordinate's expiry by attaching a fresh lookup timestamp.
    return !!property.coordinates &&
      Math.abs(property.coordinates.lat - result.coordinates.lat) < 0.000001 &&
      Math.abs(property.coordinates.lng - result.coordinates.lng) < 0.000001;
  }
  if (result.status !== 'matched_building') return false;
  if (!property.coordinates) return true;
  // Large changes to even an unreviewed rooftop need human review.
  const north = (property.coordinates.lat - result.coordinates.lat) * 111320;
  const east = (property.coordinates.lng - result.coordinates.lng) * 85000;
  return Math.hypot(north, east) <= 15;
}
