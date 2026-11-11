import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

export type AccessRole = 'admin' | 'user';
export interface AuthorizedUser { email: string; role: AccessRole; version: string; created_at: string; updated_at: string }
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(email) ? email : null;
}
function database() {
  if (!process.env.DATABASE_URL) throw new Error('User access database is unavailable');
  return neon(process.env.DATABASE_URL);
}
// Additive initialization lets an existing production database adopt access management.
let schemaReady: Promise<ReturnType<typeof database>> | undefined;
let schemaUrl: string | undefined;
export function ensureUsers() {
  if (schemaUrl !== process.env.DATABASE_URL) { schemaReady = undefined; schemaUrl = process.env.DATABASE_URL; }
  schemaReady ??= initializeUsers().catch(error => { schemaReady = undefined; throw error; });
  return schemaReady;
}
async function initializeUsers() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS atlas_users (
    email text PRIMARY KEY, role text NOT NULL CHECK (role IN ('admin', 'user')),
    version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS atlas_user_audit (
    id text PRIMARY KEY, actor text NOT NULL, email text NOT NULL, action text NOT NULL,
    role text, created_at timestamptz NOT NULL DEFAULT now()
  )`;
  return sql;
}
export async function findAuthorizedUser(email: string): Promise<AuthorizedUser | null> {
  if (!process.env.DATABASE_URL) return null;
  const sql = await ensureUsers();
  const rows = await sql`SELECT * FROM atlas_users WHERE email = ${email}`;
  return rows[0] as AuthorizedUser ?? null;
}
export async function listUsers(owner: string) {
  const sql = await ensureUsers();
  const users = await sql`SELECT email, role, created_at, updated_at FROM atlas_users WHERE email <> ${owner} ORDER BY email`;
  const history = await sql`SELECT actor, email, action, role, created_at FROM atlas_user_audit ORDER BY created_at DESC, id DESC LIMIT 50`;
  return { users: [{ email: owner, role: 'admin', owner: true }, ...users], history };
}
export async function changeUser(actor: string, email: string, role: AccessRole | null) {
  const sql = await ensureUsers();
  if (role === null) {
    await sql`WITH changed AS (DELETE FROM atlas_users WHERE email = ${email} RETURNING email)
      INSERT INTO atlas_user_audit (id, actor, email, action) SELECT ${randomUUID()}, ${actor}, email, 'removed' FROM changed`;
  } else {
    await sql`WITH changed AS (
      INSERT INTO atlas_users (email, role, version) VALUES (${email}, ${role}, ${randomUUID()})
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, updated_at = now()
      WHERE atlas_users.role <> EXCLUDED.role RETURNING email, role
    ) INSERT INTO atlas_user_audit (id, actor, email, action, role)
      SELECT ${randomUUID()}, ${actor}, email, 'access_set', role FROM changed`;
  }
}
