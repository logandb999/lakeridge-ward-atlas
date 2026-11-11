import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authConfig, requireAdmin } from '../src/server/auth.js';
import { changeUser, listUsers, normalizeEmail } from '../src/server/users.js';

export function createUsersHandler({ authorize = requireAdmin, list = listUsers, change = changeUser, owner = () => authConfig().email } = {}) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST', 'DELETE'].includes(req.method ?? '')) {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const actor = await authorize(req, res);
    if (!actor) return;
    try {
      if (req.method !== 'GET') {
        const email = normalizeEmail(req.body?.email);
        const role = req.method === 'DELETE' ? null : req.body?.role;
        if (!email || (role !== null && role !== 'admin' && role !== 'user')) return res.status(400).json({ error: 'Enter a valid email and role.' });
        if (email === owner()) return res.status(403).json({ error: 'The owner account is protected.' });
        if (email === actor.email) return res.status(403).json({ error: 'Another administrator must change your access.' });
        await change(actor.email, email, role);
      }
      return res.status(200).json(await list(owner()));
    } catch {
      return res.status(503).json({ error: 'User access could not be updated or loaded. Please try again.' });
    }
  };
}
export default createUsersHandler();
