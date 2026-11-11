import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createUsersHandler } from '../api/users';
import { normalizeEmail } from '../src/server/users';
import { authConfig, getSession, requireAdmin, signAuthToken } from '../src/server/auth';

Object.assign(process.env, {
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret',
  AUTH_SECRET: 'test-session-secret-at-least-32-characters', ATLAS_ALLOWED_EMAIL: 'owner@example.com',
  ATLAS_APP_URL: 'https://atlas.example.com',
});
function response() {
  const result = { code: 200, body: undefined as any };
  const res = {
    setHeader() { return res; }, status(code: number) { result.code = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as VercelResponse;
  return { res, result };
}
function req(method: string, body?: unknown) { return { method, body, headers: {} } as VercelRequest; }
const admin = { id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'admin' as const };

test('email input is normalized without accepting lists or invalid values', () => {
  assert.equal(normalizeEmail(' Person@Example.com '), 'person@example.com');
  for (const value of ['', 'a@b', 'a@example.com,b@example.com', 'a b@example.com', null]) assert.equal(normalizeEmail(value), null);
});

test('user management validates roles and protects owner and acting administrator', async () => {
  const changes: unknown[] = [];
  const handler = createUsersHandler({ authorize: async () => admin, owner: () => 'owner@example.com',
    list: async () => ({ users: [], history: [] }), change: async (...args) => { changes.push(args); } });
  for (const [body, code] of [
    [{ email: 'owner@example.com', role: 'user' }, 403],
    [{ email: 'admin@example.com', role: 'user' }, 403],
    [{ email: 'person@example.com', role: 'owner' }, 400],
    [{ email: 'bad', role: 'admin' }, 400],
    [{ email: ' Person@Example.com ', role: 'user' }, 200],
  ] as const) {
    const { res, result } = response(); await handler(req('POST', body), res); assert.equal(result.code, code);
  }
  assert.deepEqual(changes, [['admin@example.com', 'person@example.com', 'user']]);
  const removed = response(); await handler(req('DELETE', { email: 'person@example.com' }), removed.res);
  assert.deepEqual(changes[1], ['admin@example.com', 'person@example.com', null]);
});

test('unauthorized requests cannot list or mutate users', async () => {
  for (const code of [401, 403]) {
    const handler = createUsersHandler({ authorize: async (_req, res) => { res.status(code).json({}); return null; },
      list: async () => assert.fail('Unauthorized list'), change: async () => assert.fail('Unauthorized change') });
    for (const method of ['GET', 'POST', 'DELETE']) {
      const { res, result } = response(); await handler(req(method), res); assert.equal(result.code, code);
    }
  }
  const { res, result } = response(); await requireAdmin(req('GET'), res); assert.equal(result.code, 401);
});

test('live session lookup applies role changes, removal, and removal followed by re-addition', async () => {
  const token = await signAuthToken({ sub: 'person', email: 'person@example.com', name: 'Person', accessVersion: 'grant-1' }, 'session', 300);
  const request = { ...req('GET'), headers: { cookie: `${authConfig().sessionCookie}=${token}` } } as VercelRequest;
  assert.equal((await getSession(request, async () => ({ role: 'admin', accessVersion: 'grant-1' })))?.role, 'admin');
  assert.equal((await getSession(request, async () => ({ role: 'user', accessVersion: 'grant-1' })))?.role, 'user');
  assert.equal(await getSession(request, async () => null), null);
  assert.equal(await getSession(request, async () => ({ role: 'user', accessVersion: 'grant-2' })), null);
});

test('server admin guard rejects regular users even with an otherwise valid session', async () => {
  const denied = response();
  assert.equal(await requireAdmin(req('GET'), denied.res, async () => ({ ...admin, role: 'user' })), null);
  assert.equal(denied.result.code, 403);
  const allowed = response();
  assert.equal((await requireAdmin(req('GET'), allowed.res, async () => admin))?.email, admin.email);
});
