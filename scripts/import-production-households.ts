import fs from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { importProperties } from '../src/server/propertyImport';
import { parsePropertyImport } from '../src/lib/propertyImport';
import { LOCATION_REVIEWER_EMAIL } from '../src/lib/locationReview';

async function main() {
  if (!process.env.DATABASE_URL || process.env.ATLAS_APP_URL?.trim() !== 'https://lakeridge-ward-atlas.vercel.app' ||
    process.env.ATLAS_ALLOWED_EMAIL?.trim().toLowerCase() !== LOCATION_REVIEWER_EMAIL) throw new Error('Production settings do not match the designated atlas and owner.');
  const properties = parsePropertyImport(await fs.readFile('.private/ward-import-2026-11-08/households-ready-to-import.json', 'utf8'));
  if (properties.length !== 156 || new Set(properties.map(p => p.id)).size !== 156 ||
    properties.some(p => p.importIdentity?.source !== 'lcr-lakeridge-3rd-ward-2026-11-08')) throw new Error('The prepared household batch did not pass validation.');
  const sql = neon(process.env.DATABASE_URL);
  const loaded = await sql`SELECT revision FROM atlas_state WHERE id = 1`;
  if (!loaded.length) throw new Error('Production database is not initialized.');
  const result = await importProperties(sql, { revision: loaded[0].revision, properties });
  const rows = await sql`SELECT revision, data FROM atlas_state WHERE id = 1`;
  const saved = rows[0]?.data;
  if (!Array.isArray(saved) || properties.some(p => !saved.some(s => s.id === p.id))) throw new Error('Import result could not be verified. Reload before retrying.');
  const imported = saved.filter(p => properties.some(s => s.id === p.id));
  const needsVerification = imported.filter(p => p.householdFlags?.includes('verify_address')).length;
  if (needsVerification !== 2) throw new Error('Households saved, but verification flags need inspection.');
  console.log(JSON.stringify({ imported: result.added, alreadyPresent: result.skipped, verifiedWardHouseholds: imported.length,
    wardAddresses: new Set(imported.map(p => p.address)).size, addressVerificationHouseholds: needsVerification,
    backupCreated: !!result.backupId, previousRecordsPreserved: saved.length - imported.length, productionImportComplete: true }));
}
main().catch(error => {
  // Never print database errors/queries: they can contain the private import payload.
  console.error(JSON.stringify({ productionImportComplete: false, errorType: error.name,
    guidance: error.name === 'ImportError' || error.name === 'Error' ? error.message : 'Could not connect to production. Check the network and production environment, then rerun. Imports preserve existing records and are safe to retry.' }));
  process.exitCode = 1;
});
