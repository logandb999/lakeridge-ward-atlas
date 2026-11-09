import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { neon } from '@neondatabase/serverless';
import { parseLocationReviewUpload, LOCATION_REVIEWER_EMAIL } from '../src/lib/locationReview';
import { redactReleaseOutput, vercelEnvironmentSaved } from '../src/server/releaseDiagnostics';

let step = 'validate production settings';
let safeFailure = '';
const secrets = () => Object.entries(process.env).filter(([k, v]) => /(SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL)/i.test(k) && v).map(([, v]) => v!);

async function main() {
  if (!process.env.DATABASE_URL || process.env.ATLAS_APP_URL?.trim() !== 'https://lakeridge-ward-atlas.vercel.app' ||
    process.env.ATLAS_ALLOWED_EMAIL?.trim().toLowerCase() !== LOCATION_REVIEWER_EMAIL) {
    safeFailure = 'Production settings must point to the atlas production URL and designated reviewer. Refresh .env.production.local from Vercel before continuing.';
    throw new Error('Invalid production settings');
  }
  console.log('Production settings verified.');
  step = 'validate prepared review queue';
  const upload = JSON.parse(await fs.readFile('.private/ward-import-2026-11-08/location-review-upload.json', 'utf8'));
  const records = parseLocationReviewUpload(upload);
  console.log(`Review queue verified: ${records.length} locations.`);
  step = 'prepare local cleanup secret';
  let secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    secret = randomBytes(32).toString('base64url');
    await fs.appendFile('.env.production.local', `\n# Daily private location-review cleanup\nCRON_SECRET=${secret}\n`);
    process.env.CRON_SECRET = secret;
  }
  if (secret.length < 32) { safeFailure = 'CRON_SECRET must have at least 32 characters.'; throw new Error('Invalid cleanup secret'); }
  step = 'configure CRON_SECRET in Vercel Production';
  console.log('Configuring the production cleanup secret in Vercel…');
  const cli = await fs.realpath('node_modules/.bin/vercel');
  const result = spawnSync(process.execPath, [cli, 'env', 'add', 'CRON_SECRET', 'production', '--force', '--sensitive'], {
    input: secret + '\n', encoding: 'utf8', timeout: 45000, env: { ...process.env, NO_COLOR: '1' },
  });
  if (!vercelEnvironmentSaved(result.status, `${result.stdout}\n${result.stderr}`)) {
    const diagnostic = redactReleaseOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`, secrets());
    console.error(JSON.stringify({ vercelExitCode: result.status, signal: result.signal, commandError: result.error?.['code'], diagnostic }));
    safeFailure = 'Vercel did not confirm the cleanup variable. The diagnostic above identifies the CLI error; database migration and queue loading have not started.';
    throw new Error('Could not confirm CRON_SECRET in Vercel. Check the Vercel CLI connection/sign-in; no credentials were printed.');
  }
  console.log('Production cleanup secret configured.');
  step = 'apply additive database migrations';
  await import('./migrate.ts');
  step = 'stage private location review queue';
  const sql = neon(process.env.DATABASE_URL);
  const added = await sql`INSERT INTO atlas_location_review (id, data)
    SELECT item->>'id', item FROM jsonb_array_elements(${JSON.stringify(records)}::jsonb) AS item
    ON CONFLICT (id) DO NOTHING RETURNING id`;
  const count = await sql`SELECT count(*)::integer AS count FROM atlas_location_review`;
  console.log(JSON.stringify({ reviewLocationsAdded: added.length, existingReviewsPreserved: records.length - added.length, reviewQueueTotal: count[0].count,
    householdDatasetImported: false, productionSetupComplete: true }));
}
main().catch((error: any) => {
  console.error(JSON.stringify({ productionSetupComplete: false, failedStep: step,
    errorType: error.name, errorCode: error.code ?? error.cause?.code,
    guidance: safeFailure || (step === 'validate prepared review queue' ? 'Regenerate the review queue with npm run locations:review-queue; verify the source coordinates have not expired.' :
      'Check connectivity and the configuration for this step. Existing household records have not been replaced.') }));
  process.exitCode = 1;
});
