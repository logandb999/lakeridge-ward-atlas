import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../src/data/mockProperties';

Object.assign(globalThis, { window: new EventTarget(), localStorage: { removeItem() {} } });
const { storageService: store } = await import('../src/services/storageService');

test('client previews without writes, blocks edits during import and checks the server save result', async () => {
  let serverRecords = structuredClone(SAMPLE_FICTIONAL_PROPERTIES.slice(0, 1));
  let revision = 2;
  let writes = 0;
  let release: (() => void) | undefined;
  let fail = false;
  globalThis.fetch = (async (url, options) => {
    if (url === '/api/auth/session') return Response.json({ user: { id: 'owner', name: 'Owner' } });
    if (url === '/api/import') {
      writes++;
      assert.equal(options?.method, 'POST');
      assert.equal(options?.credentials, 'same-origin');
      await new Promise<void>(resolve => { release = resolve; });
      if (fail) return Response.json({ error: 'The atlas changed. Reload and preview again.' }, { status: 409 });
      const body = JSON.parse(options!.body as string);
      assert.equal(body.revision, revision);
      serverRecords = [...serverRecords, ...body.properties];
      return Response.json({ properties: serverRecords, revision: ++revision, added: body.properties.length, skipped: 0, backupId: 'backup-test' });
    }
    return Response.json({ properties: serverRecords, revision });
  }) as typeof fetch;
  await store.loadPropertiesAsync();
  const incoming = { ...structuredClone(serverRecords[0]), id: 'new-household', occupantSummary: 'Another family', followUps: [], visitLogs: [] };
  const content = JSON.stringify([incoming]);
  const preview = store.previewImport(content);
  assert.equal(preview.additions.length, 1);
  assert.equal(writes, 0);
  const saved = structuredClone(store.loadProperties());
  const pending = store.importData(content, preview.revision);
  assert.throws(() => store.updatePropertyNotes(saved[0].id, { generalNotes: 'Must not mutate the cache' }), /Wait/);
  assert.deepEqual(store.loadProperties(), saved);
  assert.throws(() => store.previewImport(content), /Wait/);
  release!();
  await pending;
  assert.equal(store.getSyncState().status, 'saved');
  assert.equal(store.loadProperties().length, 2);
  assert.equal(store.previewImport(content).skipped.length, 1);
  await assert.rejects(store.importData(content, preview.revision), /changed after the preview/);

  fail = true;
  const next = JSON.stringify([{ ...incoming, id: 'third-household', occupantSummary: 'Third family' }]);
  const nextPreview = store.previewImport(next);
  const failed = store.importData(next, nextPreview.revision);
  release!();
  await assert.rejects(failed, /changed/);
  assert.equal(store.loadProperties().length, 2);
  assert.equal(store.getSyncState().status, 'conflict');
  assert.throws(() => store.previewImport(next), /reload/i);
});
