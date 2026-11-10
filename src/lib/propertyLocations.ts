import type { Property } from '../types/index';
import type { LocationReviewRecord } from './locationReview';

export function hasMapLocation(p: Property, now = Date.now()): boolean {
  return !!p.coordinates && (!p.location || Date.parse(p.location.expiresAt) > now);
}

// Backups/exports keep household information and place IDs, never cached Google coordinates.
export function stripCachedLocations(properties: Property[], all = false, now = Date.now()): Property[] {
  return properties.map(p => {
    if (!p.location || (!all && Date.parse(p.location.expiresAt) > now)) return p;
    const { coordinates, ...rest } = p;
    return rest;
  });
}

export function applySavedLocationReviews(properties: Property[], reviews: LocationReviewRecord[], now = Date.now()): Property[] {
  return properties.map(p => {
    if (!p.location?.reviewId) return p;
    const r = reviews.find(r => r.id === p.location.reviewId);
    if (!r || !r.householdIds.includes(p.importIdentity?.recordId) || !['confirmed', 'needs_contact'].includes(r.status)) {
      throw new Error('A household location still needs review or its review link is invalid.');
    }
    if (!r.coordinates || Date.parse(r.expiresAt) <= now) throw new Error('Reviewed coordinates expired. Refresh locations before importing.');
    const flags = new Set(p.householdFlags ?? []);
    if (r.status === 'needs_contact') flags.add('verify_address');
    if (r.outsideWard) flags.add('outside_ward');
    return { ...p, coordinates: { ...r.coordinates, x: 500, y: 400 },
      location: { ...p.location, expiresAt: r.expiresAt, status: r.status as 'confirmed' | 'needs_contact' },
      householdFlags: [...flags],
      generalNotes: [p.generalNotes, r.reviewNote].filter(Boolean).join('\n') };
  });
}
