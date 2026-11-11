import { randomUUID, createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import type { Property } from '../types/index';
import { parseAddressQuery } from '../lib/addressMatching';
import { assessGoogleGeocode, buildingQueryKey, GEOCODING_CACHE_DAYS } from '../lib/googleGeocoding';
import { canAcceptRefreshedLocation, shouldRefreshLocation } from '../lib/geocodingRefresh';

type Sql = ReturnType<typeof neon<false, false>>;

export async function refreshHouseholdLocations(sql: Sql, now = new Date(), dryRun = false) {
  const [initial] = await sql`SELECT data FROM atlas_state WHERE id = 1`;
  const properties = (initial?.data ?? []) as Property[];
  const due = properties.filter(p => shouldRefreshLocation(p, now));
  const groups = new Map<string, Property[]>();
  for (const p of due) {
    const query = parseAddressQuery(p.address);
    if (!query) continue;
    const key = buildingQueryKey(query);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const summary = { dueBuildings: groups.size, requests: 0, refreshedHouseholds: 0, queuedHouseholds: 0, failedBuildings: 0, skippedBuildings: 0, failureReason: '' };
  const deadline = Date.now() + 220000;
  const apiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim();
  if (dryRun) return { ...summary, keyConfigured: Boolean(apiKey), dryRun: true };
  if (!groups.size) return summary;
  if (!apiKey) throw new Error('The server Geocoding key is not configured.');

  await sql`CREATE TABLE IF NOT EXISTS atlas_geocoding_refresh_job (
    id integer PRIMARY KEY CHECK (id = 1), lease_token text, lease_until timestamptz,
    attempted_day date, last_run_at timestamptz, last_result jsonb)`;
  const token = randomUUID();
  // A daily lease bounds cost and prevents overlapping cron/manual invocations.
  const lease = await sql`INSERT INTO atlas_geocoding_refresh_job (id, lease_token, lease_until, attempted_day)
    VALUES (1, ${token}, now() + interval '10 minutes', CURRENT_DATE)
    ON CONFLICT (id) DO UPDATE SET lease_token = EXCLUDED.lease_token,
      lease_until = EXCLUDED.lease_until, attempted_day = CURRENT_DATE
    WHERE (atlas_geocoding_refresh_job.lease_until IS NULL OR atlas_geocoding_refresh_job.lease_until < now())
      AND atlas_geocoding_refresh_job.attempted_day IS DISTINCT FROM CURRENT_DATE
    RETURNING id`;
  if (!lease.length) return { ...summary, alreadyAttemptedToday: true };

  try {
    for (const [key, households] of groups) {
      if (summary.requests >= 120 || Date.now() > deadline) break;
      const query = parseAddressQuery(households[0].address)!;
      const pendingId = households.find(p => p.location?.pendingReviewId)?.location?.pendingReviewId;
      if (pendingId) {
        const [pending] = await sql`SELECT data FROM atlas_location_review WHERE id = ${pendingId}`;
        if (pending && pending.data.status !== 'confirmed' && Date.parse(pending.data.expiresAt) > now.getTime() + 4 * 86400000) {
          summary.skippedBuildings++;
          continue;
        }
      }
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.search = new URLSearchParams({ address: `${query.street}, ${query.city}, UT, USA`, components: 'country:US', key: apiKey }).toString();
      summary.requests++;
      let response;
      try {
        const http = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!http.ok) throw new Error('Geocoding request failed');
        response = await http.json();
      } catch {
        summary.failedBuildings++;
        summary.failureReason = 'Geocoding connection failed.';
        break;
      }
      if (!['OK', 'ZERO_RESULTS'].includes(response.status)) {
        summary.failedBuildings++;
        summary.failureReason = ['REQUEST_DENIED', 'OVER_DAILY_LIMIT', 'OVER_QUERY_LIMIT', 'INVALID_REQUEST', 'UNKNOWN_ERROR'].includes(response.status)
          ? `Google returned ${response.status}.` : 'Google could not process the lookup.';
        // Stop on quota/access failures. Never print Google's response or the key.
        break;
      }
      const result = assessGoogleGeocode(query, response);
      if (!('coordinates' in result) || !result.coordinates) { summary.failedBuildings++; continue; }
      const fetchedAt = new Date();
      const expiresAt = new Date(fetchedAt.getTime() + GEOCODING_CACHE_DAYS * 86400000).toISOString();
      const reviewId = `refresh-${createHash('sha256').update(key + fetchedAt.toISOString()).digest('hex').slice(0, 24)}`;
      let saved = false;
      for (let attempt = 0; attempt < 3 && !saved; attempt++) {
        const [state] = await sql`SELECT revision, data FROM atlas_state WHERE id = 1`;
        const current = state.data as Property[];
        const eligible = current.filter(p => households.some(h => h.id === p.id &&
          h.address === p.address && JSON.stringify(h.location) === JSON.stringify(p.location) &&
          JSON.stringify(h.coordinates) === JSON.stringify(p.coordinates)));
        if (!eligible.length) break;
        const accepted = eligible.filter(p => canAcceptRefreshedLocation(p, result));
        const review = eligible.filter(p => !accepted.includes(p));
        const updated = current.map(p => {
          if (accepted.includes(p)) {
            const location = { ...p.location!, refreshedAt: fetchedAt.toISOString(), expiresAt, placeId: result.placeIds[0] };
            delete location.pendingReviewId;
            return { ...p, location, coordinates: { ...result.coordinates!, x: 500, y: 400 } };
          }
          return review.includes(p) ? { ...p, location: { ...p.location!, pendingReviewId: reviewId } } : p;
        });
        const reviewRecord = {
          id: reviewId, address: households[0].address,
          householdIds: review.map(p => p.importIdentity?.recordId).filter(Boolean),
          householdNames: review.map(p => p.occupantSummary), coordinates: result.coordinates,
          precision: result.diagnostics?.locationType ?? '', expiresAt,
          status: review.some(p => p.householdFlags?.includes('verify_address')) ? 'needs_contact' : 'pending',
          outsideWard: review.some(p => p.householdFlags?.includes('outside_ward')),
          reviewNote: 'A refreshed Google lookup needs review before replacing the current household pin. ' + result.reason,
        };
        // Queue and household-link changes commit together against the loaded state revision.
        const changed = await sql`WITH saved AS (
          UPDATE atlas_state SET data = ${JSON.stringify(updated)}::jsonb, revision = revision + 1
          WHERE id = 1 AND revision = ${state.revision} RETURNING id
        ), queued AS (
          INSERT INTO atlas_location_review (id, data)
          SELECT ${reviewId}, ${JSON.stringify(reviewRecord)}::jsonb FROM saved WHERE ${review.length} > 0 RETURNING id
        ) SELECT id FROM saved`;
        saved = changed.length > 0;
        if (saved) {
          summary.refreshedHouseholds += accepted.length;
          summary.queuedHouseholds += review.length;
        }
      }
      if (!saved) summary.failedBuildings++;
    }
    return summary;
  } finally {
    await sql`UPDATE atlas_geocoding_refresh_job SET lease_until = NULL, last_run_at = now(),
      last_result = ${JSON.stringify(summary)}::jsonb WHERE id = 1 AND lease_token = ${token}`;
  }
}
