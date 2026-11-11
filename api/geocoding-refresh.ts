import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { isReviewCleanupAuthorized } from '../src/server/reviewCleanup.js';
import { requireLocationReviewer } from '../src/server/locationReview.js';
import { refreshHouseholdLocations } from '../src/server/geocodingRefresh.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const dryRun = req.query?.dryRun === '1';
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isReviewCleanupAuthorized(req.headers.authorization)) {
    if (!dryRun || !await requireLocationReviewer(req, res)) {
      if (!dryRun) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  try {
    if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
    const result = await refreshHouseholdLocations(neon(process.env.DATABASE_URL), new Date(), dryRun);
    return res.status(200).json(result);
  } catch {
    // Never log credentials, Google responses, addresses, or household data.
    return res.status(503).json({ error: 'Location refresh is unavailable. Check the server Geocoding key and database connection.' });
  }
}
