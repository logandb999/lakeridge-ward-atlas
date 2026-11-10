import { useEffect, useState } from 'react';
import { BudgetedGoogleMap } from './BudgetedGoogleMap';
import { canReviewLocations, type LocationReviewRecord, type ReviewCoordinates } from '../lib/locationReview';

async function request(method: 'GET' | 'POST' | 'PATCH', body?: unknown) {
  const response = await fetch('/api/location-review', { method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Location review request failed.');
  return result;
}

export function LocationReview({ apiKey, email, colorScheme }: { apiKey: string; email: string; colorScheme: 'LIGHT' | 'DARK' }) {
  const allowed = canReviewLocations({ email });
  const [locations, setLocations] = useState<LocationReviewRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<ReviewCoordinates | null>(null);
  const [note, setNote] = useState('');
  const [view, setView] = useState<LocationReviewRecord['status']>('pending');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const selected = locations.find(r => r.id === selectedId);
  const visible = locations.filter(r => r.status === view);
  const dirty = !!selected && (note !== (selected.reviewNote ?? '') || draft?.lat !== selected.coordinates?.lat || draft?.lng !== selected.coordinates?.lng);
  const canLeave = () => !dirty || window.confirm('Discard the unsaved pin or review-note changes?');

  async function load() {
    const result = await request('GET');
    setLocations(result.locations); setSelectedId(''); setDraft(null); setNote('');
  }
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    request('GET').then(result => { if (active) setLocations(result.locations); }).catch(error => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [allowed]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function select(id: string) {
    if (busy || !canLeave()) return;
    const row = locations.find(r => r.id === id);
    setSelectedId(id); setDraft(row?.coordinates ?? null); setNote(row?.reviewNote ?? ''); setMessage('');
  }
  async function upload(file?: File) {
    if (!file || !canLeave()) return;
    setBusy(true); setMessage('');
    try {
      if (file.size > 500000) throw new Error('Choose a review queue smaller than 500 KB.');
      const result = await request('POST', JSON.parse(await file.text()));
      await load(); setMessage(`${result.added} review locations added; ${result.preserved} existing reviews preserved.`);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function saveReview(action: 'confirm' | 'flag_address') {
    if (!selected || (action === 'confirm' && !draft)) return;
    setBusy(true); setMessage('');
    try {
      const result = await request('PATCH', { id: selected.id, revision: selected.revision, coordinates: draft, reviewNote: note, action });
      setLocations(rows => rows.map(r => r.id === selected.id ? result.location : r));
      setSelectedId(''); setDraft(null); setNote(''); setMessage(action === 'confirm' ? 'Location confirmed and saved.' : 'Address and linked households flagged for verification.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  if (!allowed) return null;
  return <div className="flex h-full min-h-0 flex-col lg:flex-row">
    <div className="relative min-h-[280px] flex-1">
      {apiKey ? <BudgetedGoogleMap colorScheme={colorScheme} apiKey={apiKey} properties={[]} selectedPropertyId={null} onSelectProperty={() => {}}
        filter={{ status: 'all', role: 'all', zone: 'all', searchQuery: '' }}
        locationReview={{ locations: visible, selectedId, draft, onSelect: select, onMove: point => { if (!busy) setDraft(point); } }} />
        : <p className="p-6">Google Maps must be configured to review locations.</p>}
    </div>
    <section className="max-h-[50vh] w-full overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:max-h-none lg:w-[400px]" aria-label="Private location review">
      <h2 className="text-lg font-bold">Review approximate locations</h2>
      <p className="mt-1 text-sm text-slate-500">Private review for your account. Select an address, then drag its pin or click the map to place it on the building. Confirming saves the review, without importing household records.</p>
      <label className="mt-3 block text-sm">Review filter
        <select value={view} disabled={busy} onChange={e => { if (canLeave()) { setView(e.target.value as typeof view); setSelectedId(''); setDraft(null); setNote(''); } }} className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-800">
          <option value="pending">Approximate — needs review ({locations.filter(r => r.status === 'pending').length})</option>
          <option value="confirmed">Confirmed ({locations.filter(r => r.status === 'confirmed').length})</option>
          <option value="needs_contact">Address & household verification ({locations.filter(r => r.status === 'needs_contact').length})</option>
        </select>
      </label>
      <label className="mt-3 block text-xs">Load prepared review queue
        <input type="file" accept=".json" disabled={busy} className="mt-1 block w-full" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {message && <p role="status" className="my-3 rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">{message}</p>}
      <button disabled={busy} className="my-2 text-sm text-blue-600 underline" onClick={() => { if (!canLeave()) return; setBusy(true); load().catch(e => setMessage(e.message)).finally(() => setBusy(false)); }}>Reload reviews</button>
      {selected && <div className="my-3 space-y-2 rounded-xl border border-blue-300 p-3 text-sm">
        <strong>{selected.address}</strong>
        {selected.outsideWard && <p className="font-semibold text-amber-700 dark:text-amber-300">Outside ward boundaries</p>}
        {selected.addressVerificationNeeded && <p className="font-semibold text-rose-700 dark:text-rose-300">Address needs verification</p>}
        {selected.householdAddressVerificationNeeded && <p className="font-semibold text-rose-700 dark:text-rose-300">Confirm current address with the household</p>}
        {selected.householdNames?.map(name => <p key={name}>{name}</p>)}
        <p>{selected.householdIds.length} household records · {draft ? 'Pin can be adjusted' : 'Coordinates expired; a fresh lookup is needed'}</p>
        {draft && <p className="font-mono text-xs">{draft.lat.toFixed(7)}, {draft.lng.toFixed(7)}</p>}
        <label className="block">Review note<textarea maxLength={2000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} className="mt-1 w-full rounded border p-2 dark:bg-slate-800" /></label>
        <button disabled={busy || !draft || Date.parse(selected.expiresAt) <= Date.now()} onClick={() => void saveReview('confirm')} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">Confirm this building location</button>
        <button disabled={busy} onClick={() => void saveReview('flag_address')} className="block rounded-lg border border-rose-300 px-3 py-2 font-semibold text-rose-700 disabled:opacity-50">Flag address and household for verification</button>
        <p className="text-xs text-slate-500">Confirmation does not extend the Google coordinate cache expiry.</p>
      </div>}
      <ul className="space-y-1">{visible.map(r => <li key={r.id}><button disabled={busy} onClick={() => select(r.id)} className={`w-full rounded-lg border p-2 text-left text-sm ${selectedId === r.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 dark:border-slate-700'}`}>
        {r.address}{r.householdNames?.map(name => <span key={name} className="block text-xs">{name}</span>)}{r.outsideWard && <span className="block text-xs font-semibold text-amber-700">Outside ward boundaries</span>}<span className="block text-xs text-slate-500">{r.status === 'needs_contact' ? 'Address and household need verification' : !r.coordinates || Date.parse(r.expiresAt) <= Date.now() ? 'Location expired — refresh needed' : r.status === 'confirmed' ? 'Confirmed' : 'Approximate location'}</span>
      </button></li>)}</ul>
      {!busy && !visible.length && <p className="mt-3 text-sm text-slate-500">No records in this filter. Load the prepared queue if it has not been added yet.</p>}
    </section>
  </div>;
}
