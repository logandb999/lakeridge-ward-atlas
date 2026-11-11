import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireLocationReviewer } from '../src/server/locationReview.js';
import { parseLocationReviewUpload, buildLocationReviewUpdate } from '../src/lib/locationReview.js';
import { cleanupPropertyLocations } from '../src/server/propertyLocationCleanup.js';
import { isReviewCleanupAuthorized } from '../src/server/reviewCleanup.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.query?.cleanup === '1') {
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    if (!isReviewCleanupAuthorized(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
      const sql = neon(process.env.DATABASE_URL);
      const expired = await sql`UPDATE atlas_location_review SET data = data - 'coordinates', revision = revision + 1
        WHERE data ? 'coordinates' AND (data->>'expiresAt')::timestamptz <= now() RETURNING id`;
      const householdStatesCleaned = await cleanupPropertyLocations(sql);
      return res.status(200).json({ cleaned: expired.length, householdStatesCleaned });
    } catch { return res.status(503).json({ error: 'Coordinate cleanup failed.' }); }
  }
  const user = await requireLocationReviewer(req, res);
  if (!user) return;
  if (!['GET', 'POST', 'PATCH'].includes(req.method ?? '')) { res.setHeader('Allow', 'GET, POST, PATCH'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
    const sql = neon(process.env.DATABASE_URL);
    if (req.method === 'GET') {
      // Expired Google coordinates cannot be displayed or confirmed. Keep review notes.
      await sql`UPDATE atlas_location_review SET data = data - 'coordinates', revision = revision + 1
        WHERE data ? 'coordinates' AND (data->>'expiresAt')::timestamptz <= now()`;
      const rows = await sql`SELECT id, revision, data FROM atlas_location_review ORDER BY data->>'address'`;
      return res.status(200).json({ locations: rows.map(r => ({ ...r.data, id: r.id, revision: r.revision })) });
    }
    if (req.method === 'POST') {
      let locations;
      try { locations = parseLocationReviewUpload(req.body); }
      catch (error) { return res.status(400).json({ error: (error as Error).message }); }
      const rows = await sql`INSERT INTO atlas_location_review (id, data)
        SELECT item->>'id', item FROM jsonb_array_elements(${JSON.stringify(locations)}::jsonb) AS item
        ON CONFLICT (id) DO NOTHING RETURNING id`;
      return res.status(200).json({ added: rows.length, preserved: locations.length - rows.length });
    }
    let update;
    try { update = buildLocationReviewUpdate(req.body, user.email); }
    catch (error) { return res.status(400).json({ error: (error as Error).message }); }
    const rows = await sql`WITH reviewed AS (
      UPDATE atlas_location_review SET data = data || ${JSON.stringify(update.changes)}::jsonb, revision = revision + 1
      WHERE id = ${update.id} AND revision = ${update.revision}
      AND (${update.requiresUnexpiredCoordinates} = false OR (data->>'expiresAt')::timestamptz > now())
      RETURNING id, revision, data
    ), synced AS (
      UPDATE atlas_state s SET data = (
        SELECT COALESCE(jsonb_agg(
          CASE WHEN (p->'location'->>'reviewId' = r.id OR p->'location'->>'pendingReviewId' = r.id)
            AND r.data->'householdIds' ? (p->'importIdentity'->>'recordId')
          THEN p || jsonb_build_object(
            'householdFlags', (
              SELECT COALESCE(jsonb_agg(flag), '[]'::jsonb)
              FROM (SELECT DISTINCT flag FROM (
                SELECT value AS flag FROM jsonb_array_elements(COALESCE(p->'householdFlags', '[]'::jsonb))
                  WHERE value <> '"verify_address"'::jsonb
                UNION ALL SELECT '"verify_address"'::jsonb WHERE ${update.requiresUnexpiredCoordinates} = false
              ) flags) unique_flags
            ),
            'location', CASE WHEN ${update.requiresUnexpiredCoordinates}
              THEN (p->'location' - 'pendingReviewId') || jsonb_build_object(
                'reviewId', r.id, 'status', 'confirmed', 'expiresAt', r.data->>'expiresAt')
              ELSE p->'location' || jsonb_build_object('status', 'needs_contact') END
          ) || CASE WHEN ${update.requiresUnexpiredCoordinates}
            THEN jsonb_build_object('coordinates', r.data->'coordinates' || '{"x":500,"y":400}'::jsonb)
            ELSE '{}'::jsonb END
          ELSE p END ORDER BY ord), '[]'::jsonb)
        FROM jsonb_array_elements(s.data) WITH ORDINALITY AS e(p, ord), reviewed r
      ), revision = revision + 1
      WHERE id = 1 AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.data) p, reviewed r
        WHERE (p->'location'->>'reviewId' = r.id OR p->'location'->>'pendingReviewId' = r.id)
          AND r.data->'householdIds' ? (p->'importIdentity'->>'recordId')
      ) RETURNING id
    ) SELECT id, revision, data FROM reviewed`;
    if (!rows.length) return res.status(409).json({ error: 'This review changed or its coordinates expired. Reload the queue before continuing.' });
    const row = rows[0];
    return res.status(200).json({ location: { ...row.data, id: row.id, revision: row.revision } });
  } catch {
    console.error('Location review request failed');
    return res.status(503).json({ error: 'Location review is unavailable. Check the database migration and try again.' });
  }
}
