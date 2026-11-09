import { useRef, useState } from 'react';
import { storageService } from '../services/storageService';
import { HouseholdFlags } from './HouseholdFlags';

type Preview = ReturnType<typeof storageService.previewImport>;

export function HouseholdImportPanel() {
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRequest = useRef(0);

  async function readFile(file?: File) {
    const request = ++fileRequest.current;
    setContent(''); setPreview(null); setMessage('');
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a JSON file smaller than 2 MB.');
      const text = await file.text();
      if (request !== fileRequest.current) return;
      setPreview(storageService.previewImport(text));
      setContent(text);
    } catch (error) { if (request === fileRequest.current) setMessage((error as Error).message); }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true); setMessage('');
    try {
      const result = await storageService.importData(content, preview.revision);
      setMessage(`${result.added} households imported and saved. ${result.skipped} existing records preserved.${result.backupId ? ' A database backup was saved before the import.' : ''}`);
      setPreview(null); setContent('');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="space-y-3 text-sm" aria-label="Import households">
    <h3 className="font-semibold">Import households</h3>
    <p className="text-slate-600 dark:text-slate-300">Choose a prepared atlas JSON file with verified map coordinates. Review additions before saving. Existing households, notes, visits, and follow-ups are preserved. A database backup is saved automatically before adding records.</p>
    <label className="block font-medium">Choose JSON file
      <input className="mt-2 block w-full text-sm" type="file" accept=".json,application/json" disabled={busy}
        onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
    {preview && <>
      <p className="font-semibold">{preview.additions.length} to add · {preview.skipped.length} already present · {preview.conflicts.length} conflicts</p>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {preview.additions.map(p => <li key={p.id} className="p-3"><strong>{p.occupantSummary || 'Household name not listed'}</strong><p>{p.address} {p.unit}</p><HouseholdFlags property={p} /></li>)}
          {preview.skipped.map((p, i) => <li key={`skip-${i}`} className="p-3 text-slate-500">{p.address}: {p.reason}</li>)}
          {preview.conflicts.map((p, i) => <li key={`conflict-${i}`} className="p-3 text-rose-700 dark:text-rose-300">{p.address}: {p.reason}</li>)}
        </ul>
      </div>
      <button disabled={busy || !preview.additions.length || !!preview.conflicts.length} onClick={() => void apply()}
        className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Importing…' : `Back up and import ${preview.additions.length} households`}</button>
    </>}
    {message && <p role="status" className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">{message}</p>}
  </section>;
}
