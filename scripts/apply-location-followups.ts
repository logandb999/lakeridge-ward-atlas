import fs from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { buildLocationReviewUpdate, LOCATION_REVIEWER_EMAIL } from '../src/lib/locationReview';

async function main() {
  if (!process.env.DATABASE_URL || process.env.ATLAS_APP_URL?.trim() !== 'https://lakeridge-ward-atlas.vercel.app' ||
    process.env.ATLAS_ALLOWED_EMAIL?.trim().toLowerCase() !== LOCATION_REVIEWER_EMAIL) throw new Error('Production configuration does not match the designated atlas reviewer.');
  const input = JSON.parse(await fs.readFile('.private/ward-import-2026-11-08/address-followups.json', 'utf8'));
  const records = input.records;
  if (!Array.isArray(records) || !records.length || records.length > 200 || new Set(records.map(r => r.id)).size !== records.length ||
    records.some(r => !/^review-[a-f0-9]{24}$/.test(r.id) || typeof r.note !== 'string' || r.note.length > 1000 ||
      !Array.isArray(r.householdIds) || !r.householdIds.length || !Array.isArray(r.householdNames) || r.householdNames.length !== r.householdIds.length ||
      !r.householdNames.every((n: unknown) => typeof n === 'string' && n.length <= 300))) throw new Error('Follow-up manifest is invalid.');
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT id, revision, data FROM atlas_location_review
    WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(records.map(r => r.id))}::jsonb))`;
  if (rows.length !== records.length) throw new Error('One or more targeted review locations are missing.');
  // Verify every household link before making any updates.
  for (const record of records) {
    const row = rows.find(r => r.id === record.id)!;
    const actual = [...row.data.householdIds].sort();
    if (JSON.stringify(actual) !== JSON.stringify([...record.householdIds].sort())) throw new Error('Review household links changed. Refresh the manifest before continuing.');
  }
  let changed = 0;
  for (const record of records) {
    const row = rows.find(r => r.id === record.id)!;
    const existingNote = typeof row.data.reviewNote === 'string' ? row.data.reviewNote : '';
    const note = existingNote.includes(record.note) ? existingNote : [existingNote, record.note].filter(Boolean).join('\n\n');
    if (row.data.status === 'needs_contact' && row.data.addressVerificationNeeded && row.data.householdAddressVerificationNeeded &&
      JSON.stringify(row.data.householdNames) === JSON.stringify(record.householdNames) && existingNote === note) continue;
    const update = buildLocationReviewUpdate({ id: row.id, revision: row.revision, reviewNote: note, action: 'flag_address' }, LOCATION_REVIEWER_EMAIL);
    const changes = { ...update.changes, householdNames: record.householdNames };
    const saved = await sql`UPDATE atlas_location_review SET data = data || ${JSON.stringify(changes)}::jsonb, revision = revision + 1
      WHERE id = ${row.id} AND revision = ${row.revision} RETURNING id`;
    if (!saved.length) throw new Error('A targeted review changed during the update. Rerun to safely finish.');
    changed++;
  }
  console.log(JSON.stringify({ targetedLocations: records.length, updated: changed, alreadyFlagged: records.length - changed,
    addressVerificationFlagged: true, linkedHouseholdsFlagged: true, otherReviewsPreserved: true, householdDatasetImported: false, completed: true }));
}
main().catch((error: any) => {
  console.error(JSON.stringify({ completed: false, code: error.code ?? error.cause?.code ?? error.name,
    message: 'Could not finish the targeted follow-up update. Check the production database connection and manifest. No credentials printed; other reviews were not modified.' }));
  process.exitCode = 1;
});
