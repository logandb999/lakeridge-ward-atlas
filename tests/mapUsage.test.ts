import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMapLoadHandler } from '../api/map-load';
import { getMapUsagePeriod, MONTHLY_MAP_LOAD_LIMIT } from '../src/lib/mapUsage';
import { MapLoadError, requestMapLoad } from '../src/services/mapLoadService';

function response() {
  const result = { status: 200, body: undefined as any, headers: {} as Record<string, unknown> };
  const res = {
    setHeader(key: string, value: unknown) { result.headers[key] = value; return res; },
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as VercelResponse;
  return { res, result };
}
const req = { method: 'POST', headers: {}, body: { period: '1900-01', used: 0 } } as VercelRequest;
const user = { id: 'test-owner', email: 'owner@example.com', name: 'Owner' };

test('monthly allowance uses Pacific calendar boundaries, including year and DST transitions', () => {
  assert.equal(getMapUsagePeriod(new Date('2026-11-01T06:59:59Z')), '2026-10');
  assert.equal(getMapUsagePeriod(new Date('2026-11-01T07:00:00Z')), '2026-11');
  assert.equal(getMapUsagePeriod(new Date('2027-01-01T07:59:59Z')), '2026-12');
  assert.equal(getMapUsagePeriod(new Date('2027-01-01T08:00:00Z')), '2027-01');
});

test('map gate ignores browser counters, permits the final reservation and blocks subsequent openings', async () => {
  let used = MONTHLY_MAP_LOAD_LIMIT - 1;
  let period = '';
  const handler = createMapLoadHandler({
    authorize: async () => user, configured: () => true,
    now: () => new Date('2026-11-05T12:00:00Z'),
    reserve: async value => { period = value; return used < MONTHLY_MAP_LOAD_LIMIT ? ++used : null; },
  });
  const last = response();
  await handler(req, last.res);
  assert.equal(period, '2026-11');
  assert.equal(last.result.status, 200);
  assert.deepEqual(last.result.body, { period, used: 9500, limit: 9500 });
  const blocked = response();
  await handler(req, blocked.res);
  assert.equal(blocked.result.status, 429);
  assert.equal(used, 9500);
  assert.equal(blocked.result.headers['Cache-Control'], 'no-store');
});

test('map gate fails closed on authentication, configuration, or database failures', async () => {
  let reservations = 0;
  const reserve = async () => { reservations++; return 1; };
  const denied = response();
  await createMapLoadHandler({ authorize: async (_req, res) => { res.status(401).json({}); return null; }, reserve, configured: () => true })(req, denied.res);
  assert.equal(denied.result.status, 401);
  const noKey = response();
  await createMapLoadHandler({ authorize: async () => user, reserve, configured: () => false })(req, noKey.res);
  assert.equal(noKey.result.status, 503);
  assert.equal(reservations, 0);
  const databaseFailure = response();
  await createMapLoadHandler({ authorize: async () => user, reserve: async () => { throw new Error('Offline'); }, configured: () => true })(req, databaseFailure.res);
  assert.equal(databaseFailure.result.status, 503);
  const get = response();
  await createMapLoadHandler({ reserve })({ ...req, method: 'PUT' } as VercelRequest, get.res);
  assert.equal(get.result.status, 405);
  assert.equal(reservations, 0);
});

test('a new month starts a separate shared allowance', async () => {
  const usage = new Map([['2026-11', 9500]]);
  const reserve = async (period: string) => {
    const used = usage.get(period) ?? 0;
    if (used >= MONTHLY_MAP_LOAD_LIMIT) return null;
    usage.set(period, used + 1); return used + 1;
  };
  const result = response();
  await createMapLoadHandler({ authorize: async () => user, configured: () => true, reserve, now: () => new Date('2026-12-01T08:00:00Z') })(req, result.res);
  assert.equal(result.result.status, 200);
  assert.deepEqual(result.result.body, { period: '2026-12', used: 1, limit: 9500 });
  assert.equal(usage.get('2026-11'), 9500);
});

test('browser only accepts a valid current-month reservation; no fallback permission on errors', async () => {
  globalThis.fetch = (async (_url, options) => {
    assert.equal(options?.method, 'POST');
    assert.equal(options?.credentials, 'same-origin');
    return Response.json({ period: getMapUsagePeriod(), used: 9500, limit: 9500 });
  }) as typeof fetch;
  assert.equal((await requestMapLoad()).used, 9500);
  globalThis.fetch = async () => Response.json({}, { status: 429 });
  await assert.rejects(requestMapLoad(), (error: MapLoadError) => error.status === 429);
  globalThis.fetch = async () => Response.json({ period: getMapUsagePeriod(), used: 9501, limit: 9500 });
  await assert.rejects(requestMapLoad(), /could not be verified/);
  globalThis.fetch = async () => Response.json({ period: '1900-01', used: 1, limit: 9500 });
  await assert.rejects(requestMapLoad(), /could not be verified/);
  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(requestMapLoad(), /Network unavailable/);
});

test('reading the admin usage count does not reserve an opening', async () => {
  const handler = createMapLoadHandler({
    authorize: async () => user,
    configured: () => true,
    now: () => new Date('2026-11-05T12:00:00Z'),
    read: async period => {
      assert.equal(period, '2026-11');
      return 0;
    },
    reserve: async () => assert.fail('Usage reads must not reserve a map opening'),
  });
  const { res, result } = response();
  await handler({ ...req, method: 'GET' }, res);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { period: '2026-11', used: 0, limit: MONTHLY_MAP_LOAD_LIMIT });
});
