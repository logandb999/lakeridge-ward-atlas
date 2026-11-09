import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseLocationReviewUpload } from '../src/lib/locationReview';
import { normalizeStreet, parseAddressQuery } from '../src/lib/addressMatching';

const folder = '.private/ward-import-2026-11-08';
const cache = JSON.parse(await fs.readFile(`${folder}/google-geocoding-results.json`, 'utf8'));
const queue = JSON.parse(await fs.readFile(`${folder}/location-queue.json`, 'utf8'));
const preview = JSON.parse(await fs.readFile(`${folder}/import-preview.json`, 'utf8'));
const groups = new Map<string, any[]>();
for (const h of queue.households) {
  const key = `${h.query.street}|${h.query.city}`;
  groups.set(key, [...(groups.get(key) ?? []), h]);
}
const locations: any[] = [];
for (const [key, households] of groups) {
  const query = households[0].query;
  let r = cache.entries.find((entry: any) => entry.queryKey === key);
  // Reuse a prior lookup only when the user explicitly corrected the source
  // address to exactly the street/city Google returned. Preserve the lookup cache.
  if (!r) for (const h of households) {
    const reviewed = preview.households.find((p: any) => p.previewId === h.previewId);
    if (!reviewed?.sourceAddress || reviewed.address === reviewed.sourceAddress) continue;
    const old = parseAddressQuery(reviewed.sourceAddress);
    const candidate = old && cache.entries.find((entry: any) => entry.queryKey === `${old.street}|${old.city}`);
    if (candidate?.diagnostics?.returnedStreet === normalizeStreet(query.street) && candidate.diagnostics.returnedCity === query.city) { r = candidate; break; }
  }
  if (!r || r.status !== 'needs_review' || r.diagnostics?.locationType !== 'RANGE_INTERPOLATED' || r.diagnostics.partialMatch ||
    r.diagnostics.returnedCity !== query.city || (r.diagnostics.returnedStreet !== query.street && !r.diagnostics.namingVariant)) continue;
  locations.push({ id: `review-${createHash('sha256').update(key).digest('hex').slice(0, 24)}`,
    address: `${query.street}, ${query.city}, UT`, coordinates: r.coordinates, expiresAt: r.expiresAt, precision: r.diagnostics.locationType, status: 'pending',
    householdIds: households.map((h: any) => h.previewId),
    outsideWard: households.some((h: any) => preview.households.find((p: any) => p.previewId === h.previewId)?.followUpFlags.includes('Outside ward boundaries')) });
}
const upload = { format: 'atlas-location-review-v1', locations };
parseLocationReviewUpload(upload);
await fs.writeFile(`${folder}/location-review-upload.json`, JSON.stringify(upload, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ approximateBuildings: locations.length, households: locations.reduce((n: number, r: any) => n + r.householdIds.length, 0),
  outsideWardBuildings: locations.filter(r => r.outsideWard).length,
  file: `${folder}/location-review-upload.json`, uploaded: false }));
