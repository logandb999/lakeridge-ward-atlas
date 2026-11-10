import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { parsePropertyImport, planPropertyImport } from '../lib/propertyImport.js';
import { applySavedLocationReviews, stripCachedLocations } from '../lib/propertyLocations.js';
import type { Property } from '../types/index';

export class ImportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Exported separately so backup failures and revision conflicts can be tested without a live database.
export async function importProperties(sql: ReturnType<typeof neon<false, false>>, input: unknown) {
  const body = input as { properties?: unknown; revision?: unknown } | null;
  if (!Number.isSafeInteger(body?.revision) || (body!.revision as number) < 0) throw new ImportError('A loaded revision is required.', 400);
  let incoming: Property[];
  try { incoming = parsePropertyImport(JSON.stringify(body?.properties)); }
  catch (error) { throw new ImportError((error as Error).message, 400); }
  if (incoming.some(p => p.location && Date.parse(p.location.expiresAt) > Date.now() + 29 * 86400000)) throw new ImportError('Coordinate expiry exceeds the cache limit.', 400);
  if (incoming.some(p => p.location?.reviewId)) {
    const reviews = await sql`SELECT id, revision, data FROM atlas_location_review`;
    try { incoming = applySavedLocationReviews(incoming, reviews.map(r => ({ ...r.data, id: r.id, revision: r.revision }))); }
    catch (error) { throw new ImportError((error as Error).message, 400); }
  }
  incoming = stripCachedLocations(incoming);
  const loaded = await sql`SELECT revision, data FROM atlas_state WHERE id = 1`;
  if (!loaded.length) throw new ImportError('The atlas database is not initialized.', 503);
  if (loaded[0].revision !== body!.revision) throw new ImportError('The atlas changed. Reload and preview the import again.', 409);
  const existing = loaded[0].data as Property[];
  const plan = planPropertyImport(existing, incoming);
  if (plan.conflicts.length) throw new ImportError('Resolve the conflicting household identities before importing.', 400);
  if (!plan.additions.length) return { properties: existing, revision: loaded[0].revision, added: 0, skipped: plan.skipped.length, backupId: null };
  const backupId = randomUUID();
  const properties = [...existing, ...plan.additions];
  // Backup and compare-and-swap write share one statement. A failed backup cannot change the atlas.
  const saved = await sql`WITH backup AS (
    INSERT INTO atlas_import_backups (id, revision, data)
    SELECT ${backupId}, revision, ${JSON.stringify(stripCachedLocations(existing, true))}::jsonb FROM atlas_state WHERE id = 1 AND revision = ${body!.revision as number}
    RETURNING id
  ) UPDATE atlas_state SET data = ${JSON.stringify(properties)}::jsonb, revision = revision + 1
    WHERE id = 1 AND revision = ${body!.revision as number} AND EXISTS (SELECT 1 FROM backup)
    RETURNING revision`;
  if (!saved.length) throw new ImportError('The atlas changed during import. Reload and preview again.', 409);
  return { properties, revision: saved[0].revision, added: plan.additions.length, skipped: plan.skipped.length, backupId };
}
