import fs from 'node:fs/promises';
import { normalizeStreet, parseAddressQuery } from '../src/lib/addressMatching';
import { parsePropertyImport } from '../src/lib/propertyImport';
import type { Property } from '../src/types';

const folder = '.private/ward-import-2026-11-08';
const preview = JSON.parse(await fs.readFile(`${folder}/import-preview.json`, 'utf8'));
const cache = JSON.parse(await fs.readFile(`${folder}/google-geocoding-results.json`, 'utf8'));
const manifest = JSON.parse(await fs.readFile(`${folder}/location-review-upload.json`, 'utf8'));
const included = preview.households.filter((h: any) => h.importDecision === 'include' ||
  (h.importDecision === 'pending_review' && h.reviewFlags.length === 0));
if (preview.households.some((h: any) => !included.includes(h) && h.importDecision !== 'hold')) throw new Error('Undecided household records remain.');
const records: Property[] = included.map((h: any) => {
  const q = parseAddressQuery(h.address);
  if (!q) throw new Error(`Unparseable address: ${h.previewId}`);
  const key = `${q.street}|${q.city}`;
  let r = cache.entries.find((r: any) => r.queryKey === key);
  if (!r && h.sourceAddress !== h.address) {
    const old = parseAddressQuery(h.sourceAddress);
    const candidate = old && cache.entries.find((r: any) => r.queryKey === `${old.street}|${old.city}`);
    if (candidate?.diagnostics?.returnedStreet === normalizeStreet(q.street) && candidate.diagnostics.returnedCity === q.city) r = candidate;
  }
  const review = manifest.locations.find((r: any) => r.householdIds.includes(h.previewId));
  if (!r?.coordinates || Date.parse(r.expiresAt) <= Date.now() || (!review && r.status !== 'matched_building')) throw new Error(`Missing accepted location: ${h.previewId}`);
  const flags = new Set<Property['householdFlags'][number]>(h.householdFlags ?? []);
  const flagMap = { 'Verify current occupants at shared address': 'shared_address', 'Residency verification needed — unknown-members list': 'verify_residency', 'Apartment number needed': 'apartment_needed', 'Reported moved — verify household occupancy': 'reported_moved', 'Do not contact — source list instruction': 'do_not_contact' } as const;
  for (const [note, flag] of Object.entries(flagMap)) if (h.followUpFlags.includes(note)) flags.add(flag);
  if (h.followUpFlags.includes('Outside ward boundaries')) flags.add('outside_ward');
  if (h.addressVerificationNeeded || h.householdAddressVerificationNeeded) flags.add('verify_address');
  // x/y are unused on Google Maps; Google-derived pins are excluded from the schematic GIS view.
  return { id: `lcr-2026-11-08-${h.previewId.toLowerCase()}`, address: `${q.street}, ${q.city}, UT`, unit: q.unit ? `Apt ${q.unit}` : undefined,
    zone: 'Unassigned', parcelNumber: '', occupantSummary: h.household, occupantState: 'occupied',
    coordinates: { ...r.coordinates, x: 500, y: 400 },
    location: { source: 'google_geocoding', expiresAt: r.expiresAt, status: flags.has('verify_address') ? 'needs_contact' : 'matched_building',
      placeId: r.placeIds?.[0], ...(review ? { reviewId: review.id } : {}) },
    generalNotes: [h.decisionNote, ...(h.contextNotes ?? []), ...(h.followUpFlags ?? [])].filter(Boolean).join('\n'),
    tags: [], householdFlags: [...flags], wardMembership: { status: 'our_ward' },
    importIdentity: { source: 'lcr-lakeridge-3rd-ward-2026-11-08', recordId: h.previewId },
    followUps: [], visitLogs: [], updatedAt: new Date().toISOString() };
});
parsePropertyImport(JSON.stringify(records));
const output = `${folder}/households-ready-to-import.json`;
await fs.writeFile(output, JSON.stringify(records, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ households: records.length, buildings: new Set(records.map(p => p.address)).size,
  savedReviewLinks: records.filter(p => p.location.reviewId).length,
  addressVerificationHouseholds: records.filter(p => p.householdFlags.includes('verify_address')).length,
  output, imported: false }));
