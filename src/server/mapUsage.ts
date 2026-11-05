import { neon } from '@neondatabase/serverless';
import { MONTHLY_MAP_LOAD_LIMIT } from '../lib/mapUsage.js';

export async function reserveMapLoad(period: string): Promise<number | null> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid usage period');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const sql = neon(process.env.DATABASE_URL);
  // The conditional UPSERT locks the shared row. Only one of two simultaneous
  // requests can take the final opening; there is no read-then-write race.
  const rows = await sql`INSERT INTO atlas_map_usage (period, loads) VALUES (${period}, 1)
    ON CONFLICT (period) DO UPDATE SET loads = atlas_map_usage.loads + 1
    WHERE atlas_map_usage.loads < ${MONTHLY_MAP_LOAD_LIMIT}
    RETURNING loads`;
  return rows.length ? Number(rows[0].loads) : null;
}
