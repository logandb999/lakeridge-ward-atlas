import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireSession } from '../src/server/auth.js';
import { ImportError, importProperties } from '../src/server/propertyImport.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!await requireSession(req, res)) return;
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    if (!process.env.DATABASE_URL) throw new ImportError('The shared database is unavailable.', 503);
    return res.status(200).json(await importProperties(neon(process.env.DATABASE_URL), req.body));
  } catch (error) {
    if (error instanceof ImportError) return res.status(error.status).json({ error: error.message });
    // Do not log household data or database queries containing the backup payload.
    console.error('Household import failed');
    return res.status(503).json({ error: 'Import could not be completed. Reload the atlas before retrying. The backup table must be available.' });
  }
}
