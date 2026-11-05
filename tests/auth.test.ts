import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';
import { SignJWT } from 'jose';
import handler, { allowedGoogleIdentity } from '../api/auth/[action]';
import propertiesHandler from '../api/properties';
import { authConfig, cookie, getSession, requireSession, signAuthToken, verifyAuthToken } from '../src/server/auth';

Object.assign(process.env, {
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-only-client-secret',
  AUTH_SECRET: 'test-only-session-secret-at-least-32-characters', ATLAS_ALLOWED_EMAIL: 'Owner@example.com',
  ATLAS_APP_URL: 'https://atlas.example.com',
});
function request(action: string, fields: Record<string, unknown> = {}) {
  return { method: 'GET', headers: {}, query: { action }, ...fields } as unknown as VercelRequest;
}
function response() {
  const result = { code: 200, body: undefined as any, location: '', headers: {} as Record<string, any> };
  const res = {
    setHeader(name: string, value: unknown) { result.headers[name] = value; return res; },
    status(code: number) { result.code = code; return res; },
    json(body: unknown) { result.body = body; return res; },
    redirect(code: number, location: string) { result.code = code; result.location = location; return res; },
  } as unknown as VercelResponse;
  return { res, result };
}

test('Google identity requires matching email, verification, subject and nonce', () => {
  const payload = { sub: 'google-subject', email: 'OWNER@example.com', email_verified: true, nonce: 'nonce', name: 'Owner' };
  assert.equal(allowedGoogleIdentity(payload, 'nonce')?.email, 'owner@example.com');
  assert.equal(allowedGoogleIdentity({ ...payload, email: 'other@example.com' }, 'nonce'), null);
  assert.equal(allowedGoogleIdentity({ ...payload, email_verified: false }, 'nonce'), null);
  assert.equal(allowedGoogleIdentity({ ...payload, sub: '' }, 'nonce'), null);
  assert.equal(allowedGoogleIdentity(payload, 'other-nonce'), null);
});

test('sessions enforce signatures, expiry, purpose and current allowlist', async () => {
  const config = authConfig();
  const token = await signAuthToken({ sub: 'google-subject', email: config.email, name: 'Owner' }, 'session', 300);
  const req = request('session', { headers: { cookie: `${config.sessionCookie}=${token}` } });
  assert.equal((await getSession(req))?.email, config.email);
  assert.equal(await getSession(request('session')), null);
  assert.equal(await getSession(request('session', { headers: { cookie: `${config.sessionCookie}=${token}tampered` } })), null);
  const expired = await new SignJWT({ sub: 'google-subject', email: config.email, name: 'Owner' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer(config.origin).setAudience('atlas:session')
    .setIssuedAt(0).setExpirationTime(1).sign(config.key);
  assert.equal(await getSession(request('session', { headers: { cookie: `${config.sessionCookie}=${expired}` } })), null);
  const flow = await signAuthToken({ state: 'state' }, 'oauth', 300);
  await assert.rejects(verifyAuthToken(flow, 'session'));
  process.env.ATLAS_ALLOWED_EMAIL = 'changed@example.com';
  assert.equal(await getSession(req), null);
  process.env.ATLAS_ALLOWED_EMAIL = 'Owner@example.com';
  const { res, result } = response();
  assert.equal(await requireSession({ ...req, method: 'PUT', headers: { ...req.headers, origin: 'https://attacker.example.com' } } as VercelRequest, res), null);
  assert.equal(result.code, 403);
  assert.match(cookie(config.sessionCookie, token, 300), /HttpOnly; SameSite=Lax; Max-Age=300; Secure/);
});

test('old shared tokens cannot access records; missing configuration fails closed', async () => {
  const { res, result } = response();
  await propertiesHandler(request('', { headers: { 'x-atlas-access-token': 'legacy-token' } }), res);
  assert.equal(result.code, 401);
  const secret = process.env.AUTH_SECRET;
  delete process.env.AUTH_SECRET;
  try {
    const { res, result } = response();
    await handler(request('session'), res);
    assert.equal(result.code, 503);
    assert.equal(result.body.configured, false);
  } finally { process.env.AUTH_SECRET = secret; }
});

test('OAuth login uses PKCE, state, nonce and the fixed callback URL', async () => {
  const { res, result } = response();
  await handler(request('login'), res);
  assert.equal(result.code, 302);
  const url = new URL(result.location);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://atlas.example.com/api/auth/callback');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('access_type'), 'online');
  assert.ok(url.searchParams.get('nonce'));
  const flowCookie = result.headers['Set-Cookie'] as string;
  const flow = await verifyAuthToken(flowCookie.split(';')[0].split('=')[1], 'oauth');
  assert.equal(url.searchParams.get('state'), flow.state);
  assert.equal(url.searchParams.get('nonce'), flow.nonce);
  assert.equal(typeof flow.codeVerifier, 'string');
});

test('sign-in on a deployment alias moves to the canonical host before setting cookies', async () => {
  const { res, result } = response();
  await handler(request('login', { headers: { host: 'different-alias.vercel.app' } }), res);
  assert.equal(result.location, 'https://atlas.example.com/api/auth/login');
  assert.equal(result.headers['Set-Cookie'], undefined);
});

test('OAuth callback blocks bad state and accounts, issues a session for the owner', async () => {
  const config = authConfig();
  const flow = await signAuthToken({ state: 'state', nonce: 'nonce', codeVerifier: 'verifier' }, 'oauth', 600);
  const headers = { cookie: `${config.flowCookie}=${flow}` };
  const getToken = OAuth2Client.prototype.getToken;
  const verifyIdToken = OAuth2Client.prototype.verifyIdToken;
  let exchanges = 0;
  let email = 'other@example.com';
  OAuth2Client.prototype.getToken = (async () => { exchanges++; return { tokens: { id_token: 'fake-token' } }; }) as any;
  OAuth2Client.prototype.verifyIdToken = (async () => ({ getPayload: () => ({ sub: 'google-subject', email, email_verified: true, nonce: 'nonce', name: 'Owner' }) })) as any;
  try {
    for (const badState of ['wrong', undefined, ['state']]) {
      const { res, result } = response();
      await handler(request('callback', { headers, query: { action: 'callback', state: badState, code: 'code' } }), res);
      assert.equal(result.location, '/?auth_error=failed');
    }
    assert.equal(exchanges, 0);
    const req = request('callback', { headers, query: { action: 'callback', state: 'state', code: 'code' } });
    const denied = response();
    await handler(req, denied.res);
    assert.equal(denied.result.location, '/?auth_error=not_allowed');
    assert.equal(typeof denied.result.headers['Set-Cookie'], 'string');
    email = config.email;
    const allowed = response();
    await handler(req, allowed.res);
    assert.equal(allowed.result.location, '/');
    const cookies = allowed.result.headers['Set-Cookie'] as string[];
    assert.equal(cookies.length, 2);
    const sessionCookie = cookies[1].split(';')[0];
    assert.equal((await getSession(request('session', { headers: { cookie: sessionCookie } })))?.email, config.email);
  } finally {
    OAuth2Client.prototype.getToken = getToken;
    OAuth2Client.prototype.verifyIdToken = verifyIdToken;
  }
});

test('logout requires POST and same origin and expires the cookies', async () => {
  const get = response();
  await handler(request('logout'), get.res);
  assert.equal(get.result.code, 405);
  const crossSite = response();
  await handler(request('logout', { method: 'POST', headers: { origin: 'https://attacker.example.com' } }), crossSite.res);
  assert.equal(crossSite.result.code, 403);
  const allowed = response();
  await handler(request('logout', { method: 'POST', headers: { origin: authConfig().origin } }), allowed.res);
  assert.equal(allowed.result.code, 200);
  assert.ok(allowed.result.headers['Set-Cookie'].every((value: string) => value.includes('Max-Age=0')));
});
