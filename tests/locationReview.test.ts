import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReviewLocations, parseLocationReviewUpload, validReviewCoordinates } from '../src/lib/locationReview';
import { signAuthToken } from '../src/server/auth';
import { requireLocationReviewer } from '../src/server/locationReview';
import handler from '../api/location-review';
import { isReviewCleanupAuthorized } from '../src/server/reviewCleanup';

const now = Date.parse('2026-11-09T00:00:00Z');
const row = { id: 'review-test', address: '100 E Example St', householdIds: ['HH-test'], coordinates: { lat: 40.28, lng: -111.69 },
  precision: 'RANGE_INTERPOLATED', expiresAt: '2026-12-08T00:00:00Z', status: 'pending' };

test('review queue validates approximate coordinates and cannot seed confirmed, expired or duplicated records', () => {
  const parse = (locations: any[]) => parseLocationReviewUpload({ format: 'atlas-location-review-v1', locations }, now);
  assert.equal(parse([row]).length, 1);
  assert.equal(canReviewLocations({ email: 'loganb999@gmail.com' }), true);
  assert.equal(canReviewLocations({ email: 'other@example.com' }), false);
  assert.equal(canReviewLocations(null), false);
  assert.equal(validReviewCoordinates({ lat: 0, lng: 0 }), false);
  assert.equal(validReviewCoordinates({ lat: '40.28', lng: -111.69 }), false);
  for (const invalid of [{ ...row, status: 'confirmed' }, { ...row, coordinates: null }, { ...row, precision: 'ROOFTOP' },
    { ...row, expiresAt: '2026-10-01' }, { ...row, expiresAt: '2028-01-01' }, { ...row, householdIds: [null] }]) {
    assert.throws(() => parse([invalid]));
  }
  assert.throws(() => parse([row, row]));
  const sanitized = parse([{ ...row, reviewedBy: 'spoofed@example.com', reviewedAt: '2020-01-01', revision: 99 }])[0];
  assert.equal(sanitized.reviewedBy, undefined);
  assert.equal('revision' in sanitized, false);
});

function response() {
  const result = { status: 200, body: undefined as any };
  const res = { setHeader() {}, status(n: number) { result.status = n; return res; }, json(body: any) { result.body = body; return res; } };
  return { result, res: res as any };
}

test('review API rejects anonymous, other signed-in users, forged cookies and cross-origin writes before database access', async () => {
  const original = { ...process.env };
  Object.assign(process.env, { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', AUTH_SECRET: 'a'.repeat(40),
    ATLAS_APP_URL: 'https://atlas.example.com', ATLAS_ALLOWED_EMAIL: 'loganb999@gmail.com' });
  delete process.env.DATABASE_URL;
  try {
    const owner = await signAuthToken({ sub: 'owner', email: 'loganb999@gmail.com', name: 'Owner' }, 'session', 600);
    const req = (method: string, token?: string, origin = 'https://atlas.example.com') => ({ method, headers: { origin, cookie: token ? `__Host-atlas_session=${token}` : '' }, body: {} }) as any;
    const allowed = response();
    assert.equal((await requireLocationReviewer(req('GET', owner), allowed.res))?.email, 'loganb999@gmail.com');
    for (const method of ['GET', 'POST', 'PATCH']) {
      const anonymous = response(); await handler(req(method), anonymous.res); assert.equal(anonymous.result.status, 401);
      const forged = response(); await handler(req(method, 'forged-cookie'), forged.res); assert.equal(forged.result.status, 401);
    }
    for (const method of ['POST', 'PATCH']) {
      const crossOrigin = response(); await handler(req(method, owner, 'https://attacker.example'), crossOrigin.res); assert.equal(crossOrigin.result.status, 403);
    }
    // Simulate another account being allowed into the atlas later. Location review remains owner-only.
    process.env.ATLAS_ALLOWED_EMAIL = 'another-leader@example.com';
    const leader = await signAuthToken({ sub: 'leader', email: 'another-leader@example.com', name: 'Leader' }, 'session', 600);
    for (const method of ['GET', 'POST', 'PATCH']) {
      const denied = response(); await handler(req(method, leader), denied.res);
      assert.equal(denied.result.status, 403);
      assert.equal(denied.result.body.locations, undefined);
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});

test('scheduled cleanup requires its separate strong secret and cannot expose queue data', async () => {
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(isReviewCleanupAuthorized('Bearer anything'), false);
    process.env.CRON_SECRET = 'test-cron-secret-'.repeat(3);
    assert.equal(isReviewCleanupAuthorized(`Bearer ${process.env.CRON_SECRET}`), true);
    assert.equal(isReviewCleanupAuthorized('Bearer incorrect'), false);
    assert.equal(isReviewCleanupAuthorized(undefined), false);
    const denied = response();
    await handler({ method: 'GET', query: { cleanup: '1' }, headers: {} } as any, denied.res);
    assert.equal(denied.result.status, 401);
    assert.equal(denied.result.body.locations, undefined);
    const wrongMethod = response();
    await handler({ method: 'POST', query: { cleanup: '1' }, headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } } as any, wrongMethod.res);
    assert.equal(wrongMethod.result.status, 405);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  }
});
