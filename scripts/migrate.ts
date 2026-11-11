import { neon } from '@neondatabase/serverless';
import { ensureUsers } from '../src/server/users.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS properties (
  id text PRIMARY KEY,
  address text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS properties_address_idx ON properties (address)`;
await sql`CREATE TABLE IF NOT EXISTS atlas_state (
  id integer PRIMARY KEY CHECK (id = 1),
  revision integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '[]'::jsonb
)`;
await sql`INSERT INTO atlas_state (id, data)
  SELECT 1, COALESCE(jsonb_agg(data ORDER BY address), '[]'::jsonb) FROM properties
  ON CONFLICT (id) DO NOTHING`;
await sql`CREATE TABLE IF NOT EXISTS atlas_map_usage (
  period text PRIMARY KEY CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  loads integer NOT NULL CHECK (loads >= 0 AND loads <= 9500)
)`;
await sql`CREATE TABLE IF NOT EXISTS atlas_import_backups (
  id text PRIMARY KEY,
  revision integer NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS atlas_location_review (
  id text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL
)`;
await ensureUsers();
console.log('Atlas database schema is ready.');
