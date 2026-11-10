import { getMapUsagePeriod, MONTHLY_MAP_LOAD_LIMIT, type MapLoadAllowance } from '../lib/mapUsage';

export class MapLoadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function requestMapLoad(signal?: AbortSignal): Promise<MapLoadAllowance> {
  const response = await fetch('/api/map-load', {
    method: 'POST', credentials: 'same-origin',
    signal: signal ?? AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new MapLoadError(response.status === 429
    ? 'The shared allowance of 9,500 map openings has been used this month. Google Maps will be available again next month.'
    : response.status === 401 ? 'Your session has expired. Refresh the page to sign in again.'
    : 'Map usage could not be checked, so Google Maps is paused. Please try again.', response.status);
  const data = await response.json();
  if (data.period !== getMapUsagePeriod() || data.limit !== MONTHLY_MAP_LOAD_LIMIT ||
      !Number.isInteger(data.used) || data.used < 1 || data.used > MONTHLY_MAP_LOAD_LIMIT) {
    throw new MapLoadError('Map usage could not be verified. Please try again.', 503);
  }
  return data;
}

export async function fetchMapUsage(signal: AbortSignal): Promise<MapLoadAllowance> {
  const response = await fetch('/api/map-load', { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error('Map usage is unavailable.');
  return response.json();
}
