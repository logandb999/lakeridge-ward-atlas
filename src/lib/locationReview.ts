export const LOCATION_REVIEWER_EMAIL = 'loganb999@gmail.com';
export function canReviewLocations(user: { email?: string } | null | undefined): boolean {
  return user?.email?.trim().toLowerCase() === LOCATION_REVIEWER_EMAIL;
}
export interface ReviewCoordinates { lat: number; lng: number }
export interface LocationReviewRecord {
  id: string;
  address: string;
  householdIds: string[];
  coordinates?: ReviewCoordinates;
  precision: string;
  expiresAt: string;
  status: 'pending' | 'confirmed' | 'needs_contact';
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  revision: number;
  outsideWard?: boolean;
  householdNames?: string[];
  addressVerificationNeeded?: boolean;
  householdAddressVerificationNeeded?: boolean;
}

export function buildLocationReviewUpdate(body: any, reviewer: string, now = new Date()) {
  const { id, revision, coordinates, reviewNote } = body ?? {};
  const action = body?.action ?? 'confirm';
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(id) || !Number.isSafeInteger(revision) || revision < 0 ||
    typeof reviewNote !== 'string' || reviewNote.length > 2000 || !['confirm', 'flag_address'].includes(action)) throw new Error('Expected a review record, valid action, notes, and the loaded revision.');
  const audit = { reviewNote: reviewNote.trim(), reviewedAt: now.toISOString(), reviewedBy: reviewer };
  if (action === 'flag_address') return { id, revision, requiresUnexpiredCoordinates: false,
    changes: { ...audit, status: 'needs_contact', addressVerificationNeeded: true, householdAddressVerificationNeeded: true } };
  if (!validReviewCoordinates(coordinates)) throw new Error('Valid coordinates are required to confirm a location.');
  return { id, revision, requiresUnexpiredCoordinates: true,
    changes: { ...audit, coordinates: { lat: coordinates.lat, lng: coordinates.lng }, status: 'confirmed', addressVerificationNeeded: false, householdAddressVerificationNeeded: false } };
}
export function validReviewCoordinates(point: any): point is ReviewCoordinates {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.lat >= 37 && point.lat <= 42.1 && point.lng >= -114.1 && point.lng <= -109;
}
export function parseLocationReviewUpload(input: any, now = Date.now()): Omit<LocationReviewRecord, 'revision'>[] {
  if (input?.format !== 'atlas-location-review-v1' || !Array.isArray(input.locations) || input.locations.length > 200) throw new Error('Choose an atlas location-review file with up to 200 buildings.');
  const seen = new Set<string>();
  return input.locations.map((r: any) => {
    const expires = Date.parse(r?.expiresAt);
    if (!r || typeof r.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(r.id) || seen.has(r.id) ||
      typeof r.address !== 'string' || !r.address.trim() || r.address.length > 500 ||
      !Array.isArray(r.householdIds) || r.householdIds.length > 200 || !r.householdIds.every((v: unknown) => typeof v === 'string' && v.length <= 200) ||
      !validReviewCoordinates(r.coordinates) || !Number.isFinite(expires) || expires <= now || expires > now + 29 * 86400000 ||
      (r.outsideWard !== undefined && typeof r.outsideWard !== 'boolean') || r.precision !== 'RANGE_INTERPOLATED' || r.status !== 'pending') throw new Error('A review record is invalid, expired, or duplicated. Regenerate the review upload.');
    seen.add(r.id);
    return { id: r.id, address: r.address.trim(), householdIds: r.householdIds,
      coordinates: { lat: r.coordinates.lat, lng: r.coordinates.lng }, precision: r.precision, expiresAt: r.expiresAt, status: 'pending',
      ...(r.outsideWard ? { outsideWard: true } : {}) };
  });
}
