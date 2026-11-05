// This is an app allowance, shared across all users. Failed openings still consume it.
export const MONTHLY_MAP_LOAD_LIMIT = 9500;
export const MAP_USAGE_TIME_ZONE = 'America/Los_Angeles';

export function getMapUsagePeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MAP_USAGE_TIME_ZONE, year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
}

export interface MapLoadAllowance { period: string; used: number; limit: number }
