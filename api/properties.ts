import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireSession } from '../src/server/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!await requireSession(req, res)) return;
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
    const sql = neon(process.env.DATABASE_URL);
    if (req.method === 'GET') {
      const rows = await sql`SELECT revision, data FROM atlas_state WHERE id = 1`;
      if (!rows.length) throw new Error('Run the database migration before using the atlas');
      return res.status(200).json({ properties: rows[0].data, revision: rows[0].revision });
    }
    if (req.method === 'PUT') {
      const { properties, revision } = req.body ?? {};
      if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(properties) || properties.some(item =>
        !item || typeof item.id !== 'string' || typeof item.address !== 'string' ||
        !Array.isArray(item.followUps) || !Array.isArray(item.visitLogs) ||
        !Array.isArray(item.tags) || !item.coordinates
      ) || new Set(properties.map(item => item.id)).size !== properties.length) {
        return res.status(400).json({ error: 'Expected property records and their loaded revision.' });
      }
      // Compare and update in one statement: concurrent requests cannot overwrite a newer revision.
      const rows = await sql`UPDATE atlas_state
        SET data = ${JSON.stringify(properties)}::jsonb, revision = revision + 1
        WHERE id = 1 AND revision = ${revision} RETURNING revision`;
      if (!rows.length) return res.status(409).json({ error: 'Records changed. Reload before saving.' });
      return res.status(200).json({ ok: true, revision: rows[0].revision });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Properties API failed', error);
    return res.status(500).json({ error: 'Database request failed.' });
  }
}
