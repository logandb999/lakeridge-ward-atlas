import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';
import { findAuthorizedUser, type AccessRole } from './users.js';

export interface SessionUser { id: string; email: string; name: string; role: AccessRole; accessVersion?: string }
export const SESSION_SECONDS = 8 * 60 * 60;

export function authConfig() {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const AUTH_SECRET = process.env.AUTH_SECRET?.trim();
  const ATLAS_ALLOWED_EMAIL = process.env.ATLAS_ALLOWED_EMAIL?.trim();
  const ATLAS_APP_URL = process.env.ATLAS_APP_URL?.trim();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !AUTH_SECRET || AUTH_SECRET.length < 32 ||
      !ATLAS_ALLOWED_EMAIL || !/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(ATLAS_ALLOWED_EMAIL.trim()) || !ATLAS_APP_URL) {
    throw new Error('Google sign-in is not configured');
  }
  const url = new URL(ATLAS_APP_URL);
  if (url.protocol !== 'https:' && !(process.env.VERCEL_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('The app URL must use HTTPS');
  }
  const secure = url.protocol === 'https:';
  return {
    clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET,
    key: new TextEncoder().encode(AUTH_SECRET), email: ATLAS_ALLOWED_EMAIL.trim().toLowerCase(),
    origin: url.origin, redirectUri: `${url.origin}/api/auth/callback`, secure,
    sessionCookie: secure ? '__Host-atlas_session' : 'atlas_session',
    flowCookie: secure ? '__Host-atlas_oauth' : 'atlas_oauth',
  };
}

export function readCookie(req: VercelRequest, name: string): string | undefined {
  return req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${authConfig().secure ? '; Secure' : ''}`;
}

export async function signAuthToken(payload: Record<string, unknown>, purpose: 'session' | 'oauth', seconds: number) {
  const config = authConfig();
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuer(config.origin)
    .setAudience(`atlas:${purpose}`).setIssuedAt().setExpirationTime(`${seconds}s`).sign(config.key);
}

export async function verifyAuthToken(token: string, purpose: 'session' | 'oauth') {
  const config = authConfig();
  return (await jwtVerify(token, config.key, {
    algorithms: ['HS256'], issuer: config.origin, audience: `atlas:${purpose}`,
    requiredClaims: ['exp', 'iat'],
  })).payload;
}

export async function getSession(req: VercelRequest, resolve = resolveAccess): Promise<SessionUser | null> {
  const config = authConfig();
  const token = readCookie(req, config.sessionCookie);
  if (!token) return null;
  try {
    const payload = await verifyAuthToken(token, 'session');
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || typeof payload.name !== 'string') return null;
    const access = await resolve(payload.email);
    if (!access || (access.accessVersion && access.accessVersion !== payload.accessVersion)) return null;
    return { id: payload.sub, email: payload.email, name: payload.name, ...access };
  } catch { return null; }
}

export function isSameOrigin(req: VercelRequest): boolean {
  return req.headers.origin === authConfig().origin;
}

export async function requireSession(req: VercelRequest, res: VercelResponse): Promise<SessionUser | null> {
  try {
    const user = await getSession(req);
    if (!user) { res.status(401).json({ error: 'Sign in with Google to continue.' }); return null; }
    if (!['GET', 'HEAD'].includes(req.method ?? '') && !isSameOrigin(req)) {
      res.status(403).json({ error: 'Request origin is not allowed.' }); return null;
    }
    return user;
  } catch {
    res.status(503).json({ error: 'Google sign-in is not configured.' }); return null;
  }
}

export async function resolveAccess(email: string): Promise<{ role: AccessRole; accessVersion?: string } | null> {
  if (email === authConfig().email) return { role: 'admin' };
  const entry = await findAuthorizedUser(email);
  return entry ? { role: entry.role, accessVersion: entry.version } : null;
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse, authorize = requireSession) {
  const user = await authorize(req, res);
  if (!user) return null;
  if (user.role !== 'admin') { res.status(403).json({ error: 'Administrator access is required.' }); return null; }
  return user;
}
