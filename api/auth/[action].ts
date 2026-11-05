import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { authConfig, cookie, getSession, isSameOrigin, readCookie, SESSION_SECONDS, signAuthToken, verifyAuthToken } from '../../src/server/auth.js';

export function allowedGoogleIdentity(payload: { sub?: string; email?: string; email_verified?: boolean; name?: string; nonce?: unknown } | undefined, nonce: string) {
  const config = authConfig();
  if (!payload?.sub || payload.nonce !== nonce || payload.email_verified !== true || payload.email?.toLowerCase() !== config.email) return null;
  return { id: payload.sub, email: config.email, name: payload.name?.trim() || config.email };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const action = req.query.action;
  if (!['login', 'callback', 'session', 'logout'].includes(action as string)) return res.status(404).json({ error: 'Not found' });
  const expectedMethod = action === 'logout' ? 'POST' : 'GET';
  if (req.method !== expectedMethod) { res.setHeader('Allow', expectedMethod); return res.status(405).json({ error: 'Method not allowed' }); }
  let config: ReturnType<typeof authConfig>;
  try { config = authConfig(); } catch {
    return res.status(503).json({ configured: false, user: null, error: 'Google sign-in is not configured.' });
  }
  if (action === 'session') return res.status(200).json({ configured: true, user: await getSession(req) });
  if (action === 'logout') {
    if (!isSameOrigin(req)) return res.status(403).json({ error: 'Request origin is not allowed.' });
    res.setHeader('Set-Cookie', [cookie(config.sessionCookie, '', 0), cookie(config.flowCookie, '', 0)]);
    return res.status(200).json({ ok: true });
  }
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  if (action === 'login') {
    // Establish the flow cookie on the same canonical host Google will call back to.
    if (req.headers.host && req.headers.host !== new URL(config.origin).host) {
      return res.redirect(302, `${config.origin}/api/auth/login`);
    }
    try {
      const state = randomBytes(32).toString('base64url');
      const nonce = randomBytes(32).toString('base64url');
      const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
      const flow = await signAuthToken({ state, nonce, codeVerifier }, 'oauth', 600);
      res.setHeader('Set-Cookie', cookie(config.flowCookie, flow, 600));
      return res.redirect(302, client.generateAuthUrl({
        scope: ['openid', 'email', 'profile'], state, nonce,
        code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
        prompt: 'select_account', access_type: 'online',
      }));
    } catch { return res.redirect(302, '/?auth_error=unavailable'); }
  }
  // The short-lived, browser-bound flow cookie is consumed on every callback.
  res.setHeader('Set-Cookie', cookie(config.flowCookie, '', 0));
  try {
    const token = readCookie(req, config.flowCookie);
    if (!token || typeof req.query.state !== 'string') throw new Error('Invalid flow');
    const flow = await verifyAuthToken(token, 'oauth');
    if (typeof flow.state !== 'string' || typeof flow.nonce !== 'string' || typeof flow.codeVerifier !== 'string') throw new Error('Invalid flow');
    const expected = Buffer.from(flow.state);
    const received = Buffer.from(req.query.state);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error('Invalid state');
    if (req.query.error) return res.redirect(302, '/?auth_error=cancelled');
    if (typeof req.query.code !== 'string') throw new Error('Missing code');
    const { tokens } = await client.getToken({ code: req.query.code, codeVerifier: flow.codeVerifier, redirect_uri: config.redirectUri });
    if (!tokens.id_token) throw new Error('Missing identity');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    const user = allowedGoogleIdentity(ticket.getPayload(), flow.nonce);
    if (!user) return res.redirect(302, '/?auth_error=not_allowed');
    const session = await signAuthToken({ sub: user.id, email: user.email, name: user.name }, 'session', SESSION_SECONDS);
    res.setHeader('Set-Cookie', [cookie(config.flowCookie, '', 0), cookie(config.sessionCookie, session, SESSION_SECONDS)]);
    return res.redirect(302, '/');
  } catch { return res.redirect(302, '/?auth_error=failed'); }
}
