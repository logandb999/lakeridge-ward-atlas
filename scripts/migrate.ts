import { neon } from '@neondatabase/serverless';

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
console.log('Atlas database schema is ready.');
