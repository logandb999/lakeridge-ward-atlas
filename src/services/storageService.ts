import { FollowUpItem, FollowUpStatus, Property, VisitLog } from '../types';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../data/mockProperties';
import { stripCachedLocations } from '../lib/propertyLocations';
import { parsePropertyImport, planPropertyImport } from '../lib/propertyImport';


export interface SignedInUser { id: string; email: string; name: string; role: 'admin' | 'user' }

export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function computePropertyStatus(property: Property): FollowUpStatus {
  const TODAY_STR = getTodayDateString();
  const pending = property.followUps.filter(f => f.status === 'pending');
  if (!pending.length) return property.followUps.length && property.followUps.every(f => f.status === 'completed') ? 'completed' : 'no_action';
  if (pending.some(f => f.dueDate < TODAY_STR)) return 'overdue';
  if (pending.some(f => { const diff = (new Date(f.dueDate).getTime() - new Date(getTodayDateString()).getTime()) / 86400000; return diff >= 0 && diff <= 7; })) return 'due_soon';
  return 'scheduled';
}

export function getDaysDiffFromToday(dateStr: string): number { return Math.round((new Date(dateStr).getTime() - new Date(getTodayDateString()).getTime()) / 86400000); }
export function formatDueDateLabel(dateStr: string): string {
  const diff = getDaysDiffFromToday(dateStr);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff <= 7) return `Due in ${diff}d`;
  return `Due ${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function getStatusTheme(status: FollowUpStatus) {
  switch (status) {
    case 'overdue': return { label: 'Overdue Visit', badgeBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900', markerBg: '#e11d48', markerRing: '#ffe4e6', textClass: 'text-rose-600 dark:text-rose-400' };
    case 'due_soon': return { label: 'Due This Week', badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900', markerBg: '#d97706', markerRing: '#fef3c7', textClass: 'text-amber-600 dark:text-amber-400' };
    case 'scheduled': return { label: 'Scheduled', badgeBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900', markerBg: '#0284c7', markerRing: '#e0f2fe', textClass: 'text-sky-600 dark:text-sky-400' };
    case 'completed': return { label: 'Follow-ups Completed', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900', markerBg: '#059669', markerRing: '#d1fae5', textClass: 'text-emerald-600 dark:text-emerald-400' };
    default: return { label: 'In Good Standing', badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', markerBg: '#64748b', markerRing: '#f1f5f9', textClass: 'text-slate-500 dark:text-slate-400' };
  }
}

export type SyncState = {
  access: 'required' | 'checking' | 'ready';
  status: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict';
  message: string;
  user: SignedInUser | null;
  configured: boolean;
};
let cache: Property[] = [];
let revision: number | null = null;
let sync: SyncState = { access: 'checking', status: 'idle', message: '', user: null, configured: true };
let saving = false;
let importing = false;
let generation = 0;
let persistedGeneration = 0;
function publish() { window.dispatchEvent(new Event('atlas-storage-update')); }
function setSync(update: Partial<SyncState>) { sync = { ...sync, ...update }; publish(); }
async function request(method: 'GET' | 'PUT', body?: unknown) {
  const response = await fetch('/api/properties', {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Your session has expired. Sign in with Google again.' :
      response.status === 409 ? 'Another leader saved changes. Download your unsaved changes, then load the latest records.' :
      'The shared database is unavailable. Please try again.');
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json();
}
async function load(): Promise<Property[]> {
  if (!sync.user) { setSync({ access: 'required', status: 'idle' }); return cache; }
  setSync({ access: revision === null ? 'checking' : sync.access, status: 'loading', message: '' });
  try {
    const data = await request('GET');
    if (!Array.isArray(data.properties) || !Number.isSafeInteger(data.revision)) throw new Error('Unexpected server response. Please try again.');
    cache = data.properties;
    revision = data.revision;
    generation = persistedGeneration = 0;
    setSync({ access: 'ready', status: 'saved', message: '' });
  } catch (error) {
    const unauthorized = (error as { status?: number }).status === 401;
    if (unauthorized) sync.user = null;
    setSync({ access: unauthorized || revision === null ? 'required' : 'ready', status: 'error', message: error instanceof Error ? error.message : 'Could not connect. Please try again.' });
  }
  return cache;
}
async function flush(): Promise<void> {
  if (saving || revision === null || sync.status === 'conflict') return;
  saving = true;
  try {
    while (persistedGeneration < generation) {
      const target = generation;
      const snapshot = JSON.parse(JSON.stringify(cache));
      setSync({ status: 'saving', message: '' });
      const data = await request('PUT', { properties: snapshot, revision });
      revision = data.revision;
      persistedGeneration = target;
    }
    setSync({ status: 'saved', message: '' });
  } catch (error) {
    const unauthorized = (error as { status?: number }).status === 401;
    setSync({ ...(unauthorized ? { access: 'required', user: null } as const : {}), status: (error as { status?: number }).status === 409 ? 'conflict' : 'error',
      message: error instanceof Error ? error.message : 'Save failed. Your changes are still open here. Retry to save them.' });
  } finally { saving = false; }
}
function assertCanEdit(): void {
  if (importing) throw new Error('Wait for the household import to finish before editing.');
  if (sync.access !== 'ready' || revision === null || ['error', 'conflict', 'loading'].includes(sync.status)) {
    throw new Error('Reconnect to the shared database before editing.');
  }
}
function save(items: Property[]): void {
  assertCanEdit();
  cache = items;
  generation++;
  publish();
  void flush();
}
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const storageService = {
  loadProperties(): Property[] { return cache; },
  async loadPropertiesAsync(): Promise<Property[]> {
    // Remove obsolete shared credentials from earlier app versions.
    localStorage.removeItem('lakeridge_ward_atlas_access_token');
    setSync({ access: 'checking', status: 'loading', message: '' });
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', signal: AbortSignal.timeout(20000) });
      const session = await response.json();
      if (!response.ok) {
        setSync({ access: 'required', status: 'error', configured: session.configured !== false, message: 'Google sign-in is not available yet. Please contact the app administrator.' });
        return cache;
      }
      setSync({ user: session.user, configured: true });
      if (!session.user) { setSync({ access: 'required', status: 'idle' }); return cache; }
      return load();
    } catch {
      setSync({ access: 'required', status: 'error', message: 'Could not connect. Please try again.' });
      return cache;
    }
  },
  getSyncState(): SyncState { return sync; },
  async signOut(): Promise<void> {
    if (importing) throw new Error('Wait for the household import to finish before signing out.');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Could not sign out');
      cache = []; revision = null; generation = persistedGeneration = 0;
      setSync({ access: 'required', status: 'idle', message: '', user: null });
    } catch { setSync({ status: 'error', message: 'Could not sign out. Please try again.' }); }
  },
  async reload(): Promise<Property[]> { if (importing) throw new Error('Wait for the household import to finish before reloading.'); return load(); },
  async retrySave(): Promise<void> { if (importing) return; await flush(); },
  hasUnsavedChanges(): boolean { return generation > persistedGeneration; },
  saveProperties(properties: Property[]): void { save(properties); },
  clearAllData(): Property[] { save([]); return []; },
  loadSampleData(): Property[] { save([...SAMPLE_FICTIONAL_PROPERTIES]); return [...SAMPLE_FICTIONAL_PROPERTIES]; },
  addProperty(data: Omit<Property, 'id' | 'followUps' | 'visitLogs' | 'updatedAt'>): Property {
    const item: Property = { ...data, id: id('prop'), followUps: [], visitLogs: [], updatedAt: new Date().toISOString() };
    save([item, ...cache]); return item;
  },
  deleteProperty(propertyId: string): void { save(cache.filter(p => p.id !== propertyId)); },
  exportData(): string { return JSON.stringify(stripCachedLocations(cache, true), null, 2); },
  previewImport(content: string) {
    if (sync.access !== 'ready' || sync.status !== 'saved' || generation !== persistedGeneration || importing || saving) {
      throw new Error('Wait for all changes to save, then reload if needed before importing.');
    }
    return { ...planPropertyImport(cache, parsePropertyImport(content)), revision: revision! };
  },
  async importData(content: string, expectedRevision: number) {
    const plan = this.previewImport(content);
    if (plan.revision !== expectedRevision) throw new Error('Records changed after the preview. Preview the file again.');
    if (plan.conflicts.length) throw new Error('Resolve conflicting records before importing.');
    importing = true;
    setSync({ status: 'saving', message: 'Importing households…' });
    try {
      const response = await fetch('/api/import', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, properties: parsePropertyImport(content) }), signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.error || 'Import failed. Reload before retrying.'), { status: response.status });
      if (!Array.isArray(result.properties) || !Number.isSafeInteger(result.revision) ||
        !Number.isSafeInteger(result.added) || result.added < 0 || !Number.isSafeInteger(result.skipped) || result.skipped < 0 ||
        (result.added > 0 && (typeof result.backupId !== 'string' || !result.backupId))) throw new Error('Import response could not be verified. Reload the atlas.');
      cache = result.properties;
      revision = result.revision;
      setSync({ status: 'saved', message: '' });
      return result as { added: number; skipped: number; backupId: string | null };
    } catch (error) {
      const status = (error as { status?: number }).status;
      setSync({ ...(status === 401 ? { access: 'required' as const, user: null } : {}), status: status === 409 ? 'conflict' : 'error',
        message: error instanceof Error ? error.message : 'Import could not be verified. Reload before retrying.' });
      throw error;
    } finally { importing = false; }
  },
  getPropertyById(propertyId: string): Property | undefined { return cache.find(p => p.id === propertyId); },
  addFollowUp(propertyId: string, item: Omit<FollowUpItem, 'id' | 'createdAt' | 'propertyId'>): FollowUpItem {
    assertCanEdit();
    const p = cache.find(x => x.id === propertyId); if (!p) throw new Error(`Property ${propertyId} not found`);
    const result = { ...item, id: id('fu'), propertyId, createdAt: new Date().toISOString() }; p.followUps.unshift(result); p.updatedAt = new Date().toISOString(); save([...cache]); return result;
  },
  toggleFollowUpStatus(propertyId: string, followUpId: string, actor: string): FollowUpItem | null {
    assertCanEdit();
    const p = cache.find(x => x.id === propertyId); const f = p?.followUps.find(x => x.id === followUpId); if (!p || !f) return null;
    if (f.status === 'completed') { f.status = 'pending'; delete f.completedAt; delete f.completedBy; } else { f.status = 'completed'; f.completedAt = new Date().toISOString(); f.completedBy = actor; }
    p.updatedAt = new Date().toISOString(); save([...cache]); return f;
  },
  deleteFollowUp(propertyId: string, followUpId: string): void { assertCanEdit(); const p = cache.find(x => x.id === propertyId); if (!p) return; p.followUps = p.followUps.filter(f => f.id !== followUpId); p.updatedAt = new Date().toISOString(); save([...cache]); },
  addVisitLog(propertyId: string, log: Omit<VisitLog, 'id'>): VisitLog {
    assertCanEdit();
    const p = cache.find(x => x.id === propertyId); if (!p) throw new Error(`Property ${propertyId} not found`);
    const result = { ...log, id: id('vl') }; p.visitLogs.unshift(result); p.updatedAt = new Date().toISOString(); save([...cache]); return result;
  },
  updatePropertyNotes(propertyId: string, updates: Partial<Pick<Property, 'occupantSummary' | 'occupantState' | 'accessNotes' | 'generalNotes' | 'tags' | 'householdFlags' | 'wardMembership'>>): Property | null {
    assertCanEdit();
    const index = cache.findIndex(x => x.id === propertyId); if (index < 0) return null;
    cache[index] = { ...cache[index], ...updates, updatedAt: new Date().toISOString() }; save([...cache]); return cache[index];
  },
};
