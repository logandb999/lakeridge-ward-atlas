import { timingSafeEqual } from 'node:crypto';

export function isReviewCleanupAuthorized(header: unknown): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32 || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(header);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
