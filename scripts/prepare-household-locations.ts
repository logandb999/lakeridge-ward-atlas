import fs from 'node:fs/promises';
import path from 'node:path';
import { matchAddressPoint, parseAddressQuery, type CountyAddressPoint } from '../src/lib/addressMatching';

const folderArg = process.argv.find(arg => arg.startsWith('--folder='));
const folder = path.resolve(folderArg?.slice('--folder='.length) ?? '.private/ward-import-2026-11-08');
const endpoint = 'https://maps.utahcounty.gov/arcgis/rest/services/Reference/Reference_QueryTask/MapServer/0';
const input = JSON.parse(await fs.readFile(path.join(folder, 'import-preview.json'), 'utf8'));
const included = input.households.filter((r: any) => r.importDecision === 'include' ||
  (r.importDecision === 'pending_review' && r.reviewFlags.length === 0));
const held = input.households.filter((r: any) => r.importDecision === 'hold');
const undecided = input.households.filter((r: any) => !included.includes(r) && !held.includes(r));
if (undecided.length) throw new Error('Some flagged households still need import decisions.');
const queue = included.map((r: any) => ({ previewId: r.previewId, sourceAddress: r.address, query: parseAddressQuery(r.address) }));
await fs.writeFile(path.join(folder, 'location-queue.json'), JSON.stringify({ source: endpoint, households: queue }, null, 2) + '\n');
const cachePath = path.join(folder, 'county-address-points.json');
let points: CountyAddressPoint[] = [];
let retrievedAt: string | null = null;
try { const cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); points = cache.features; retrievedAt = cache.retrievedAt; }
catch (error: any) { if (error.code !== 'ENOENT') throw error; }

if (process.argv.includes('--fetch')) {
  const downloaded: CountyAddressPoint[] = [];
  const cities = [...new Set(queue.map((r: any) => r.query?.city).filter(Boolean))] as string[];
  try {
    for (const city of cities) {
      const numbers = [...new Set(queue.filter((r: any) => r.query?.city === city).map((r: any) => r.query.number))] as string[];
      const quoted = numbers.map(n => `'${n.replaceAll("'", "''")}'`).join(',');
      const where = `CITY='${city.replaceAll("'", "''")}' AND ADDRNUM IN (${quoted})`;
      for (let offset = 0; ; offset += 2000) {
        const params = new URLSearchParams({ f: 'json', where, outFields: 'OBJECTID,ADDRESSID,ADDRNUM,ROADPREDIR,ROADNAME,ROADTYPE,ROADPOSTDIR,CITY,FULLADDR,UNITTYPE,UNITID,ADDRESS_STATUS',
          outSR: '4326', returnGeometry: 'true', resultOffset: String(offset), resultRecordCount: '2000', orderByFields: 'OBJECTID' });
        const response = await fetch(`${endpoint}/query?${params}`, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Public county service returned HTTP ${response.status}`);
        const result = await response.json();
        if (result.error || !Array.isArray(result.features)) throw new Error('Public county service did not return address points.');
        downloaded.push(...result.features);
        if (!result.exceededTransferLimit) break;
        if (!result.features.length || offset >= 20000) throw new Error('County response pagination could not be verified.');
      }
    }
    points = downloaded; retrievedAt = new Date().toISOString();
    await fs.writeFile(cachePath, JSON.stringify({ source: endpoint, retrievedAt, features: points }, null, 2) + '\n');
  } catch (error: any) {
    console.error(`Live address lookup unavailable: ${error.cause?.code ?? error.name}. Address queue saved; no coordinates were invented.`);
    process.exitCode = 1;
  }
}

const results = queue.map((r: any) => ({ ...r, ...(r.query && points.length ? matchAddressPoint(r.query, points) :
  { status: 'needs_review', reason: r.query ? 'No county address-point data available yet.' : 'Address could not be parsed exactly.' }) }));
const summary = { includedHouseholds: included.length, heldHouseholds: held.length,
  uniqueBuildingQueries: new Set(queue.filter((r: any) => r.query).map((r: any) => `${r.query.city}|${r.query.street}`)).size,
  matchedAddressPoints: results.filter((r: any) => r.status === 'matched_address_point').length,
  buildingOnly: results.filter((r: any) => r.status === 'building_only').length,
  needingLocationReview: results.filter((r: any) => r.status === 'needs_review').length };
await fs.writeFile(path.join(folder, 'location-review.json'), JSON.stringify({ source: endpoint, retrievedAt, summary, households: results }, null, 2) + '\n');
const lines = ['# Household map-location review', '',
  `${included.length} households selected; ${held.length} held out. ${summary.uniqueBuildingQueries} unique street/building queries.`, '',
  `Source: ${endpoint}`, '',
  'Only exact street/city address points with unambiguous coordinates are accepted. Apartment matches that resolve only to a building are labeled building-only. These matches do not confirm current residents or ward-boundary membership. Source addresses and review flags remain unchanged.', '',
  '| ID | Source address | Location status | Notes |', '| --- | --- | --- | --- |'];
for (const r of results) lines.push(`| ${r.previewId} | ${r.sourceAddress.replaceAll('\n', ', ').replaceAll('|', '\\|')} | ${r.status} | ${r.reason ?? r.countyAddress} |`);
await fs.writeFile(path.join(folder, 'location-review.md'), lines.join('\n') + '\n');
console.log(JSON.stringify(summary));
