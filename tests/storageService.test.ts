import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../src/data/mockProperties';

const values = new Map<string, string>();
Object.assign(globalThis, {
  window: new EventTarget(),
  localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
});
const { storageService: store, getTodayDateString, getDaysDiffFromToday, computePropertyStatus } = await import('../src/services/storageService');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('local calendar dates and due status use today across DST', () => {
  const OriginalDate = Date;
  class FrozenDate extends OriginalDate {
    constructor(value?: string | number) { super(value ?? '2026-11-02T06:30:00Z'); }
  }
  globalThis.Date = FrozenDate as DateConstructor;
  try {
    assert.equal(getTodayDateString(), '2026-11-01'); // Still Sunday in Denver.
    assert.equal(getDaysDiffFromToday('2026-11-01'), 0);
    assert.equal(getDaysDiffFromToday('2026-11-02'), 1);
    assert.equal(getDaysDiffFromToday('2026-10-31'), -1);
    const property = structuredClone(SAMPLE_FICTIONAL_PROPERTIES[0]);
    property.followUps = [{ ...property.followUps[0], status: 'pending', dueDate: '2026-10-31' }];
    assert.equal(computePropertyStatus(property), 'overdue');
    property.followUps[0].dueDate = '2026-11-08';
    assert.equal(computePropertyStatus(property), 'due_soon');
    property.followUps[0].dueDate = '2026-11-09';
    assert.equal(computePropertyStatus(property), 'scheduled');
  } finally { globalThis.Date = OriginalDate; }
});

test('access, serialized saves, retry, conflict preservation and reload', async () => {
  let serverRevision = 0;
  let serverRecords = structuredClone(SAMPLE_FICTIONAL_PROPERTIES);
  let failSave = false;
  let release: (() => void) | undefined;
  const revisions: number[] = [];
  globalThis.fetch = (async (_url, options) => {
    const token = (options?.headers as Record<string, string>)['x-atlas-access-token'];
    if (token !== 'valid') return Response.json({}, { status: 401 });
    if (options?.method === 'PUT') {
      const body = JSON.parse(options.body as string);
      revisions.push(body.revision);
      if (release) await new Promise<void>(resolve => { release = resolve; });
      if (failSave) return Response.json({}, { status: 503 });
      if (body.revision !== serverRevision) return Response.json({}, { status: 409 });
      serverRecords = body.properties;
      return Response.json({ revision: ++serverRevision });
    }
    return Response.json({ properties: serverRecords, revision: serverRevision });
  }) as typeof fetch;

  await store.setAccessToken('wrong');
  assert.equal(store.getSyncState().access, 'required');
  assert.match(store.getSyncState().message, /invalid/);
  assert.throws(() => store.clearAllData(), /Reconnect/);
  await store.setAccessToken('valid');
  assert.equal(store.getSyncState().access, 'ready');
  assert.equal(store.getSyncState().status, 'saved');
  const propertyId = serverRecords[0].id;

  release = () => {};
  store.updatePropertyNotes(propertyId, { generalNotes: 'first' });
  assert.equal(store.getSyncState().status, 'saving');
  store.updatePropertyNotes(propertyId, { generalNotes: 'second' });
  const unblock = release!;
  release = undefined;
  unblock();
  await tick();
  assert.deepEqual(revisions, [0, 1]);
  assert.equal(serverRecords[0].generalNotes, 'second');
  assert.equal(store.hasUnsavedChanges(), false);

  failSave = true;
  store.updatePropertyNotes(propertyId, { generalNotes: 'keep on failure' });
  await tick();
  assert.equal(store.getSyncState().status, 'error');
  assert.equal(store.hasUnsavedChanges(), true);
  assert.match(store.exportData(), /keep on failure/);
  failSave = false;
  await store.retrySave();
  assert.equal(store.getSyncState().status, 'saved');
  assert.equal(serverRecords[0].generalNotes, 'keep on failure');

  serverRevision++; // Another leader saved after this browser loaded.
  serverRecords[0].generalNotes = 'other leader';
  store.updatePropertyNotes(propertyId, { generalNotes: 'my unsaved change' });
  await tick();
  assert.equal(store.getSyncState().status, 'conflict');
  assert.equal(serverRecords[0].generalNotes, 'other leader');
  assert.match(store.exportData(), /my unsaved change/);
  const attempts = revisions.length;
  await store.retrySave();
  assert.equal(revisions.length, attempts);
  await store.reload();
  assert.equal(store.loadProperties()[0].generalNotes, 'other leader');
  assert.equal(store.hasUnsavedChanges(), false);
});
