import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { parseAddressQuery } from '../src/lib/addressMatching';
import { assessGoogleGeocode, GEOCODING_CACHE_DAYS } from '../src/lib/googleGeocoding';

const folder = '.private/ward-import-2026-11-08';
const cache = JSON.parse(await fs.readFile(`${folder}/google-geocoding-results.json`, 'utf8'));
// One example for each observed mismatch pattern plus an approximate apartment building.
const patterns = [/^\d+ E 1000 S\|OREM$/, /^\d+ S 50 E\|OREM$/, / COMMERCE ST\|OREM$/, / MOUNTAIN WAY DR\|OREM$/, / S OREM BLVD\|OREM$/];
const entries = patterns.map(pattern => cache.entries.find((e: any) => pattern.test(e.queryKey))).filter(Boolean);
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ diagnosticRequests: entries.length, queryKeys: entries.map((e: any) => e.queryKey), networkRequests: 0 }));
  process.exit(0);
}
const env = dotenv.parse(await fs.readFile('.env.local', 'utf8'));
const key = env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim();
if (!key) throw new Error('Geocoding key is missing from .env.local.');
const diagnostics: any[] = [];
for (const entry of entries) {
  const query = parseAddressQuery(entry.inputAddress);
  if (!query) throw new Error('Could not parse diagnostic address.');
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.search = new URLSearchParams({ address: entry.inputAddress, components: 'country:US', key }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || !['OK', 'ZERO_RESULTS'].includes(data.status)) {
      console.error(`Diagnostic stopped: HTTP ${response.status}, status ${String(data.status).replaceAll(key, '[redacted]')}.`);
      process.exitCode = 1;
      break;
    }
    const assessed = assessGoogleGeocode(query, data);
    // Record comparison evidence only; do not change any batch match decisions.
    diagnostics.push({ queryKey: entry.queryKey, status: assessed.status, reason: assessed.reason,
      ...('diagnostics' in assessed ? assessed.diagnostics : {}),
      candidateCount: data.results?.length ?? 0 });
    const now = new Date();
    await fs.writeFile(`${folder}/google-geocoding-diagnostics.json`, JSON.stringify({
      fetchedAt: now.toISOString(), expiresAt: new Date(now.getTime() + GEOCODING_CACHE_DAYS * 86400000).toISOString(), diagnostics,
    }, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(diagnostics.at(-1)));
  } catch (error: any) {
    console.error(`Diagnostic connection failed: ${error.cause?.code ?? error.name}. No saved match statuses changed.`);
    process.exitCode = 1;
    break;
  }
}
