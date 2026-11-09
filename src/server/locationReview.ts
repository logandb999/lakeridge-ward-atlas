import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireSession } from './auth.js';
import { canReviewLocations } from '../lib/locationReview.js';

export async function requireLocationReviewer(req: VercelRequest, res: VercelResponse) {
  const user = await requireSession(req, res);
  if (!user) return null;
  if (!canReviewLocations(user)) { res.status(403).json({ error: 'Location review is restricted to the designated reviewer.' }); return null; }
  return user;
}
