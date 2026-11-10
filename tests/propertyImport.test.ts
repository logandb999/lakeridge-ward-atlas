import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../src/data/mockProperties';
import { isPropertyRecord, parsePropertyImport, planPropertyImport } from '../src/lib/propertyImport';
import { householdLabels } from '../src/lib/householdFlags';
import { importProperties } from '../src/server/propertyImport';
import type { Property } from '../src/types';

function record(id = 'test-household'): Property {
  return { ...structuredClone(SAMPLE_FICTIONAL_PROPERTIES[0]), id, followUps: [], visitLogs: [],
    zone: 'Unassigned', importIdentity: { source: 'test-directory', recordId: id } };
}

test('import validation rejects malformed fields and missing locations, accepts legacy backups and household flags', () => {
  assert.ok(SAMPLE_FICTIONAL_PROPERTIES.every(isPropertyRecord));
  const p = record();
  p.householdFlags = ['do_not_contact', 'apartment_needed'];
  p.wardMembership = { status: 'other_ward', wardName: 'Spanish ward' };
  assert.equal(parsePropertyImport(JSON.stringify([p])).length, 1);
  assert.deepEqual(householdLabels(p), ['Do not contact', 'Apartment number needed', 'Member of another ward: Spanish ward']);
  for (const change of [
    { coordinates: null }, { coordinates: { x: 500, y: 400, lat: 100, lng: 0 } },
    { tags: [null] }, { householdFlags: ['made_up'] }, { followUps: [{}] }, { visitLogs: [{}] },
    { wardMembership: { status: 'guessed_from_language' } }, { importIdentity: { source: '', recordId: '1' } },
  ]) assert.throws(() => parsePropertyImport(JSON.stringify([{ ...p, ...change }])));
  assert.throws(() => parsePropertyImport('{broken'));
  assert.throws(() => parsePropertyImport(JSON.stringify({ households: [p] })));
});

test('append-only import preserves existing history, separates shared addresses and is idempotent', () => {
  const existing = record();
  existing.generalNotes = 'Keep the leader’s notes';
  existing.householdFlags = ['do_not_contact'];
  existing.visitLogs = structuredClone(SAMPLE_FICTIONAL_PROPERTIES[0].visitLogs);
  const incoming = { ...record(), generalNotes: 'Older imported notes', householdFlags: [] };
  const neighbor = { ...record('second-household'), occupantSummary: 'Another family' };
  const before = structuredClone(existing);
  const plan = planPropertyImport([existing], [incoming, neighbor, neighbor]);
  assert.equal(plan.additions.length, 1);
  assert.equal(plan.skipped.length, 2);
  assert.equal(plan.conflicts.length, 0);
  assert.deepEqual(existing, before);
  assert.equal(planPropertyImport([existing, ...plan.additions], [incoming, neighbor]).additions.length, 0);
});

test('source IDs detect re-imports across renamed IDs; mismatched identities require review', () => {
  const p = record();
  assert.equal(planPropertyImport([p], [{ ...p, id: 'new-local-id' }]).skipped.length, 1);
  assert.equal(planPropertyImport([p], [{ ...p, address: 'Different address' }]).conflicts.length, 1);
  assert.equal(planPropertyImport([p], [{ ...record('other-id') }]).conflicts.length, 1);
  assert.equal(planPropertyImport([p], [{ ...p, importIdentity: { source: 'another-source', recordId: p.id } }]).conflicts.length, 1);
  assert.equal(planPropertyImport([p], [{ ...p, householdFlags: ['do_not_contact'] }]).conflicts.length, 1);
});

function database({ backupFails = false, concurrentChange = false } = {}) {
  let revision = 3;
  let data = [record()];
  const backups: Property[][] = [];
  let writes = 0;
  const sql = async (parts: TemplateStringsArray, ...args: unknown[]) => {
    const query = parts.join('?');
    if (query.startsWith('SELECT revision')) return [{ revision, data: structuredClone(data) }];
    writes++;
    assert.match(query, /WITH backup AS[\s\S]*INSERT INTO atlas_import_backups[\s\S]*UPDATE atlas_state/);
    assert.match(query, /EXISTS \(SELECT 1 FROM backup\)/);
    if (backupFails) throw new Error('Backup storage unavailable');
    if (concurrentChange) return [];
    backups.push(structuredClone(data));
    data = JSON.parse(args[3] as string);
    return [{ revision: ++revision }];
  };
  return { sql: sql as any, state: () => ({ revision, data, backups, writes }) };
}

test('server imports back up before append, preserve existing records and skip repeated imports', async () => {
  const db = database();
  const incoming = { ...record('new'), occupantSummary: 'New family' };
  const result = await importProperties(db.sql, { revision: 3, properties: [incoming] });
  assert.equal(result.added, 1);
  assert.ok(result.backupId);
  assert.equal(db.state().backups[0].length, 1);
  assert.equal(db.state().data.length, 2);
  assert.equal(db.state().data[0].id, 'test-household');
  const repeat = await importProperties(db.sql, { revision: 4, properties: [incoming] });
  assert.equal(repeat.added, 0);
  assert.equal(repeat.backupId, null);
  assert.equal(db.state().writes, 1);
});

test('backup failures, invalid records, stale previews and concurrent updates cannot replace the atlas', async () => {
  const incoming = { ...record('new'), occupantSummary: 'New family' };
  for (const options of [{ backupFails: true }, { concurrentChange: true }]) {
    const db = database(options);
    await assert.rejects(importProperties(db.sql, { revision: 3, properties: [incoming] }));
    assert.equal(db.state().data.length, 1);
    assert.equal(db.state().revision, 3);
  }
  const db = database();
  await assert.rejects(importProperties(db.sql, { revision: 2, properties: [incoming] }), /changed/);
  await assert.rejects(importProperties(db.sql, { revision: 3, properties: [{}] }), /invalid/);
  assert.equal(db.state().writes, 0);
});
