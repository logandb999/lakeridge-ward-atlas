import { FollowUpItem, FollowUpStatus, Property, VisitLog } from '../types';
import { SAMPLE_FICTIONAL_PROPERTIES } from '../data/mockProperties';


const ACCESS_KEY = 'lakeridge_ward_atlas_access_token';

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
};
let cache: Property[] = [];
let revision: number | null = null;
let sync: SyncState = { access: 'required', status: 'idle', message: '' };
let saving = false;
let generation = 0;
let persistedGeneration = 0;
function publish() { window.dispatchEvent(new Event('atlas-storage-update')); }
function setSync(update: Partial<SyncState>) { sync = { ...sync, ...update }; publish(); }
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_KEY);
  return token ? { 'x-atlas-access-token': token } : {};
}
async function request(method: 'GET' | 'PUT', body?: unknown) {
  const response = await fetch('/api/properties', {
    method, headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Access token is invalid. Please try again.' :
      response.status === 409 ? 'Another leader saved changes. Download your unsaved changes, then load the latest records.' :
      'The shared database is unavailable. Please try again.');
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json();
}
async function load(): Promise<Property[]> {
  if (!localStorage.getItem(ACCESS_KEY)) { setSync({ access: 'required', status: 'idle' }); return cache; }
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
    if (unauthorized) localStorage.removeItem(ACCESS_KEY);
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
    setSync({ status: (error as { status?: number }).status === 409 ? 'conflict' : 'error',
      message: error instanceof Error ? error.message : 'Save failed. Your changes are still open here. Retry to save them.' });
  } finally { saving = false; }
}
function save(items: Property[]): void {
  if (sync.access !== 'ready' || revision === null || ['error', 'conflict', 'loading'].includes(sync.status)) {
    throw new Error('Reconnect to the shared database before editing.');
  }
  cache = items;
  generation++;
  publish();
  void flush();
}
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const storageService = {
  loadProperties(): Property[] { return cache; },
  async loadPropertiesAsync(): Promise<Property[]> { return load(); },
  getSyncState(): SyncState { return sync; },
  async setAccessToken(token: string): Promise<void> { localStorage.setItem(ACCESS_KEY, token.trim()); await load(); },
  async reload(): Promise<Property[]> { return load(); },
  async retrySave(): Promise<void> { await flush(); },
  hasUnsavedChanges(): boolean { return generation > persistedGeneration; },
  saveProperties(properties: Property[]): void { save(properties); },
  clearAllData(): Property[] { save([]); return []; },
  loadSampleData(): Property[] { save([...SAMPLE_FICTIONAL_PROPERTIES]); return [...SAMPLE_FICTIONAL_PROPERTIES]; },
  addProperty(data: Omit<Property, 'id' | 'followUps' | 'visitLogs' | 'updatedAt'>): Property {
    const item: Property = { ...data, id: id('prop'), followUps: [], visitLogs: [], updatedAt: new Date().toISOString() };
    save([item, ...cache]); return item;
  },
  deleteProperty(propertyId: string): void { save(cache.filter(p => p.id !== propertyId)); },
  exportData(): string { return JSON.stringify(cache, null, 2); },
  importData(content: string): boolean {
    try { const parsed = JSON.parse(content); if (Array.isArray(parsed) && parsed.every(p => p && typeof p.id === 'string' && typeof p.address === 'string')) { save(parsed); return true; } } catch (error) { console.error('Import failed', error); }
    return false;
  },
  getPropertyById(propertyId: string): Property | undefined { return cache.find(p => p.id === propertyId); },
  addFollowUp(propertyId: string, item: Omit<FollowUpItem, 'id' | 'createdAt' | 'propertyId'>): FollowUpItem {
    const p = cache.find(x => x.id === propertyId); if (!p) throw new Error(`Property ${propertyId} not found`);
    const result = { ...item, id: id('fu'), propertyId, createdAt: new Date().toISOString() }; p.followUps.unshift(result); p.updatedAt = new Date().toISOString(); save([...cache]); return result;
  },
  toggleFollowUpStatus(propertyId: string, followUpId: string, actor: string): FollowUpItem | null {
    const p = cache.find(x => x.id === propertyId); const f = p?.followUps.find(x => x.id === followUpId); if (!p || !f) return null;
    if (f.status === 'completed') { f.status = 'pending'; delete f.completedAt; delete f.completedBy; } else { f.status = 'completed'; f.completedAt = new Date().toISOString(); f.completedBy = actor; }
    p.updatedAt = new Date().toISOString(); save([...cache]); return f;
  },
  deleteFollowUp(propertyId: string, followUpId: string): void { const p = cache.find(x => x.id === propertyId); if (!p) return; p.followUps = p.followUps.filter(f => f.id !== followUpId); p.updatedAt = new Date().toISOString(); save([...cache]); },
  addVisitLog(propertyId: string, log: Omit<VisitLog, 'id'>): VisitLog {
    const p = cache.find(x => x.id === propertyId); if (!p) throw new Error(`Property ${propertyId} not found`);
    const result = { ...log, id: id('vl') }; p.visitLogs.unshift(result); p.updatedAt = new Date().toISOString(); save([...cache]); return result;
  },
  updatePropertyNotes(propertyId: string, updates: Partial<Pick<Property, 'occupantSummary' | 'occupantState' | 'accessNotes' | 'generalNotes' | 'tags'>>): Property | null {
    const index = cache.findIndex(x => x.id === propertyId); if (index < 0) return null;
    cache[index] = { ...cache[index], ...updates, updatedAt: new Date().toISOString() }; save([...cache]); return cache[index];
  },
};
