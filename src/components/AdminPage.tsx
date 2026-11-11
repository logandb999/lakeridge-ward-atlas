import React, { useEffect, useState } from 'react';

type Role = 'admin' | 'user';
type Entry = { email: string; role: Role; owner?: boolean };
type Audit = { actor: string; email: string; action: string; role: Role | null; created_at: string };
type AccessList = { users: Entry[]; history: Audit[] };

export function AdminPage({ email, onOpenSetup }: { email: string; onOpenSetup: () => void }) {
  const [data, setData] = useState<AccessList>({ users: [], history: [] });
  const [newEmail, setNewEmail] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function request(method = 'GET', body?: unknown) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/users', {
        method, credentials: 'same-origin', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'User access is unavailable.');
      setData(result);
      if (method !== 'GET') setNotice(method === 'DELETE' ? 'Access removed. Their existing session can no longer access the server.' : 'Access saved. They can sign in with this Google account.');
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'User access is unavailable.'); return false; }
    finally { setBusy(false); }
  }
  useEffect(() => { void request(); }, []);
  const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800';
  return <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Administration</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage who can access the ward atlas.</p></div>
        <button onClick={onOpenSetup} className={input}>Data &amp; Setup</button>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Add a user</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use the exact email they use to sign in with Google. No invitation email is sent.</p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={async event => {
          event.preventDefault();
          const existing = data.users.find(user => user.email === newEmail.trim().toLowerCase());
          if (existing && existing.role !== role && !window.confirm(`Change ${existing.email} to ${role === 'admin' ? 'an admin with full access, including managing users' : 'a regular user'}?`)) return;
          if (await request('POST', { email: newEmail, role })) { setNewEmail(''); setRole('user'); }
        }}>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Google account email<input className={input} type="email" autoComplete="off" required maxLength={254} value={newEmail} onChange={event => setNewEmail(event.target.value)} disabled={busy} /></label>
          <label className="flex flex-col gap-1 text-sm">Role<select className={input} value={role} onChange={event => setRole(event.target.value as Role)} disabled={busy}><option value="user">Regular user</option><option value="admin">Admin</option></select></label>
          <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Add user</button>
        </form>
        <p className="mt-4 text-sm">Admins can manage users and setup. Regular users can view and edit households, notes, visits, and follow-ups.</p>
      </section>
      {error && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error} <button onClick={() => void request()} disabled={busy} className="underline">Reload users</button></div>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <h2 className="p-5 text-lg font-semibold">Authorized users ({data.users.length})</h2>
        {busy && <p role="status" className="px-5 pb-3 text-sm text-slate-500">Loading…</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">{data.users.map(user => <li key={user.email} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0"><p className="break-all font-medium">{user.email}</p><p className="text-xs text-slate-500">{user.owner ? 'Owner · protected admin' : user.email === email ? 'Your account' : user.role === 'admin' ? 'Admin' : 'Regular user'}</p></div>
          {!user.owner && user.email !== email && <div className="flex items-center gap-3">
            <select aria-label={`Role for ${user.email}`} className={input} value={user.role} disabled={busy} onChange={event => {
              const role = event.target.value;
              if (window.confirm(`Change ${user.email} to ${role === 'admin' ? 'an admin with full access, including managing users' : 'a regular user'}?`)) void request('POST', { email: user.email, role });
            }}><option value="user">Regular user</option><option value="admin">Admin</option></select>
            <button disabled={busy} className="text-sm text-rose-600 disabled:opacity-50 dark:text-rose-400" onClick={() => {
              if (window.confirm(`Remove access for ${user.email}? They will lose access on their next server request.`)) void request('DELETE', { email: user.email });
            }}>Remove</button>
          </div>}
        </li>)}</ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Recent access changes</h2>
        {!data.history.length && <p className="mt-2 text-sm text-slate-500">No access changes yet.</p>}
        <ul className="mt-3 space-y-3 text-sm">{data.history.map((item, index) => <li key={index}><p className="break-words">{item.email} · {item.action === 'removed' ? 'Access removed' : item.role === 'admin' ? 'Admin access granted' : 'Regular user access granted'}</p><p className="text-xs text-slate-500">{item.actor} · {new Date(item.created_at).toLocaleString()}</p></li>)}</ul>
      </section>
    </div>
  </div>;
}
