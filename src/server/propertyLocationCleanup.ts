import { neon } from '@neondatabase/serverless';

export async function cleanupPropertyLocations(sql: ReturnType<typeof neon<false, false>>) {
  // jsonb aggregation preserves household order. Changing the state revision prevents stale saves
  // from reintroducing expired coordinates. Apply the same retention limit to old backups.
  const cleaned = await sql`UPDATE atlas_state s SET data = (
      SELECT COALESCE(jsonb_agg(CASE WHEN item->'location'->>'source' = 'google_geocoding'
        AND (item->'location'->>'expiresAt')::timestamptz <= now() THEN item - 'coordinates' ELSE item END ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(s.data) WITH ORDINALITY AS e(item, ord)), revision = revision + 1
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(s.data) item WHERE item ? 'coordinates'
      AND item->'location'->>'source' = 'google_geocoding' AND (item->'location'->>'expiresAt')::timestamptz <= now()) RETURNING id`;
  await sql`UPDATE atlas_import_backups b SET data = (
    SELECT COALESCE(jsonb_agg(CASE WHEN item->'location'->>'source' = 'google_geocoding' THEN item - 'coordinates' ELSE item END ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(b.data) WITH ORDINALITY AS e(item, ord))
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(b.data) item WHERE item ? 'coordinates' AND item->'location'->>'source' = 'google_geocoding')`;
  return cleaned.length;
}
