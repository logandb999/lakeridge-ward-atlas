import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { parseAddressQuery, type AddressQuery } from '../src/lib/addressMatching';
import { assessGoogleGeocode, buildingQueryKey, expireGoogleCacheEntry, GEOCODING_CACHE_DAYS, GEOCODING_ASSESSMENT_VERSION, needsGeocodingLookup } from '../src/lib/googleGeocoding';

const folder = path.resolve(process.argv.find(a => a.startsWith('--folder='))?.slice(9) ?? '.private/ward-import-2026-11-08');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice(8)) : 120;
const recheckReview = process.argv.includes('--recheck-review');
const reportOnly = process.argv.includes('--report-only');
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 120) throw new Error('Use a request limit between 1 and 120.');
const input = JSON.parse(await fs.readFile(path.join(folder, 'location-queue.json'), 'utf8'));
const groups = new Map<string, { query: AddressQuery; householdIds: string[] }>();
for (const household of input.households) {
  const query = parseAddressQuery(household.sourceAddress);
  if (!query) throw new Error(`Address ${household.previewId} needs manual parsing before this batch can run.`);
  const key = buildingQueryKey(query);
  const group = groups.get(key) ?? { query, householdIds: [] };
  group.householdIds.push(household.previewId);
  groups.set(key, group);
}
if (process.argv.includes('--dry-run')) {
  const saved = new Map<string, any>();
  try {
    const cache = JSON.parse(await fs.readFile(path.join(folder, 'google-geocoding-results.json'), 'utf8'));
    for (const entry of cache.entries) saved.set(entry.queryKey, expireGoogleCacheEntry(entry));
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const needed = [...groups.keys()].filter(k => needsGeocodingLookup(saved.get(k), recheckReview)).length;
  console.log(JSON.stringify({ households: input.households.length, uniqueBuildings: groups.size, lookupsNeeded: needed,
    maximumRequestsThisRun: reportOnly ? 0 : Math.min(limit, needed), networkRequests: 0 }));
  process.exit(0);
}

const env = dotenv.parse(await fs.readFile('.env.local', 'utf8'));
const key = env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim();
if (!key) throw new Error('Add GOOGLE_MAPS_GEOCODING_API_KEY to .env.local first.');
const cacheFile = path.join(folder, 'google-geocoding-results.json');
const lockFile = path.join(folder, '.google-geocoding.lock');
let lock;
try { lock = await fs.open(lockFile, 'wx', 0o600); }
catch { throw new Error('Another batch may be running. Check the Terminal session before retrying.'); }
const controller = new AbortController();
const stop = () => controller.abort();
process.on('SIGINT', stop);
let requests = 0;
const entries = new Map<string, any>();
async function save() {
  const payload = JSON.stringify({ provider: 'Google Geocoding API', cacheDays: GEOCODING_CACHE_DAYS,
    writtenAt: new Date().toISOString(), entries: [...entries.values()] }, null, 2) + '\n';
  const temp = cacheFile + '.tmp';
  await fs.writeFile(temp, payload, { mode: 0o600 });
  await fs.rename(temp, cacheFile);
}
try {
  try {
    const cache = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    if (!Array.isArray(cache.entries)) throw new Error('Geocoding cache format is invalid.');
    for (const entry of cache.entries) entries.set(entry.queryKey, expireGoogleCacheEntry(entry));
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  await save();
  for (const [queryKey, group] of groups) {
    if (reportOnly || controller.signal.aborted || requests >= limit) break;
    const previous = entries.get(queryKey);
    if (!needsGeocodingLookup(previous, recheckReview)) continue;
    const address = `${group.query.street}, ${group.query.city}, UT, USA`;
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.search = new URLSearchParams({ address, components: 'country:US', key }).toString();
    requests++;
    let result;
    try {
      const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result = await response.json();
    } catch (error: any) {
      console.error(`Stopped after ${requests} request attempts: ${error.cause?.code ?? error.name}. Saved results are retained. No automatic retries.`);
      process.exitCode = 1;
      break;
    }
    if (!['OK', 'ZERO_RESULTS'].includes(result.status)) {
      console.error(`Stopped: Google returned ${String(result.status).replaceAll(key, '[redacted]')}. Check API access, IP restrictions, and quota. No automatic retries.`);
      process.exitCode = 1;
      break;
    }
    const fetchedAt = new Date();
    entries.set(queryKey, { queryKey, inputAddress: address, fetchedAt: fetchedAt.toISOString(),
      expiresAt: new Date(fetchedAt.getTime() + GEOCODING_CACHE_DAYS * 86400000).toISOString(),
      assessmentVersion: GEOCODING_ASSESSMENT_VERSION, ...assessGoogleGeocode(group.query, result) });
    await save();
    console.log(`Saved ${requests}: ${entries.get(queryKey).status} (${group.householdIds.length} household records)`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const summary = { households: input.households.length, buildings: groups.size, requestsThisRun: requests,
    matchedBuildings: [...groups.keys()].filter(k => entries.get(k)?.status === 'matched_building').length,
    buildingsNeedingReview: [...groups.keys()].filter(k => entries.get(k)?.status === 'needs_review').length,
    buildingsPending: [...groups.keys()].filter(k => !entries.has(k) || entries.get(k)?.status === 'expired').length };
  const lines = ['# Google building-location review', '', 'Local review only — not imported or deployed.', '',
    `Summary: ${JSON.stringify(summary)}`, '',
    'Building coordinates are shared by household records at that address. Apartment numbers and current residents have not been verified. No household names were sent to Google.', '',
    'The JSON cache includes expiration dates. Refresh or delete Google coordinates within 30 days; production expiry/refresh support must be implemented before importing them into the shared app. Running this script again removes expired coordinate values before requesting replacements. Keep this folder out of Git, deployment uploads, and long-term backups.', '',
    '| Source household IDs | Input address | Returned street | Precision | Status | Review note |', '| --- | --- | --- | --- | --- | --- |'];
  for (const [k, group] of groups) {
    const entry = entries.get(k);
    lines.push(`| ${group.householdIds.join(', ')} | ${group.query.street}, ${group.query.city} | ${entry?.diagnostics?.returnedStreet ?? '(not saved in original run)'} | ${entry?.diagnostics?.locationType ?? '(not saved)'} | ${entry?.status ?? 'pending'} | ${(entry?.reason ?? 'Not looked up yet.').replaceAll('|', '\\|')} |`);
  }
  await fs.writeFile(path.join(folder, 'google-location-review.md'), lines.join('\n') + '\n', { mode: 0o600 });
  console.log(JSON.stringify(summary));
  console.log(`Saved to ${cacheFile}`);
} finally {
  process.off('SIGINT', stop);
  await lock.close();
  await fs.unlink(lockFile);
}
