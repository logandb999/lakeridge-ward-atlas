import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactReleaseOutput, vercelEnvironmentSaved } from '../src/server/releaseDiagnostics';

test('production setup recognizes both initial and replacement Vercel environment saves', () => {
  assert.equal(vercelEnvironmentSaved(0, 'Added Environment Variable CRON_SECRET to Project atlas'), true);
  assert.equal(vercelEnvironmentSaved(0, 'Overrode Environment Variable CRON_SECRET to Project atlas [128ms]'), true);
  assert.equal(vercelEnvironmentSaved(0, 'Updated Environment Variable CRON_SECRET to Project atlas'), true);
  assert.equal(vercelEnvironmentSaved(1, 'Overrode Environment Variable CRON_SECRET to Project atlas'), false);
  assert.equal(vercelEnvironmentSaved(0, 'Retrieving project…'), false);
  assert.equal(vercelEnvironmentSaved(0, 'Added Environment Variable OTHER_SECRET to Project atlas'), false);
});

test('release diagnostics preserve actionable CLI errors while removing credentials', () => {
  const secret = 'example-test-secret-123456789';
  const db = 'postgresql://user:password@database.example/db?sslmode=require';
  const text = `Error: token is not valid. Run vercel login.\n${secret}\n${encodeURIComponent(db)}\nBearer opaque-token-123`;
  const safe = redactReleaseOutput(text, [secret, db]);
  assert.match(safe, /Run vercel login/);
  assert.equal(safe.includes(secret), false);
  assert.equal(safe.includes(encodeURIComponent(db)), false);
  assert.equal(safe.includes('opaque-token-123'), false);
  assert.ok(redactReleaseOutput('x'.repeat(5000), []).length <= 2500);
});
