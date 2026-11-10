import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireSession } from '../src/server/auth.js';
import { readMapUsage, reserveMapLoad } from '../src/server/mapUsage.js';
import { getMapUsagePeriod, MONTHLY_MAP_LOAD_LIMIT } from '../src/lib/mapUsage.js';

export function createMapLoadHandler({
  authorize = requireSession,
  reserve = reserveMapLoad,
  read = readMapUsage,
  now = () => new Date(),
  configured = () => Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY?.trim()),
} = {}) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!await authorize(req, res)) return;
    if (!configured()) return res.status(503).json({ error: 'Google Maps is not configured.' });
    const period = getMapUsagePeriod(now());
    try {
      if (req.method === 'GET') {
        return res.status(200).json({ period, used: await read(period), limit: MONTHLY_MAP_LOAD_LIMIT });
      }
      const used = await reserve(period);
      if (used === null) return res.status(429).json({
        period, used: MONTHLY_MAP_LOAD_LIMIT, limit: MONTHLY_MAP_LOAD_LIMIT,
        error: 'The monthly map allowance has been reached.',
      });
      return res.status(200).json({ period, used, limit: MONTHLY_MAP_LOAD_LIMIT });
    } catch {
      // Fail closed: a connection error must never result in an uncounted map.
      return res.status(503).json({ error: 'Map usage could not be checked. Please try again.' });
    }
  };
}

export default createMapLoadHandler();
