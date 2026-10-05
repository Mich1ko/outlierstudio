'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, refreshCredits, type ApiError } from '@/lib/api';
import type { AdminUser, Limits, SessionUser } from '@/lib/types';
import { FEATURE_LABELS, PLAN_LABELS } from '@/shared/catalog';
import { ErrorNotice, Field, Skeleton } from './ui';

const PLANS = Object.keys(PLAN_LABELS) as SessionUser['plan'][];
const FEATURES = ['analysis', 'script', 'report', 'hooks'] as const;

function LimitsForm() {
  const [limits, setLimits] = useState<Limits | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    api<{ limits: Limits }>('/api/admin/limits')
      .then((r) => setLimits(r.limits))
      .catch(setError);
  }, []);

  if (!limits) return error ? <ErrorNotice error={error} /> : <Skeleton />;

  const number = (value: number, onChange: (n: number) => void, max: number) => (p: object) => (
    <input {...p} className="input" type="number" min={0} max={max} step={1} value={value} onChange={(e) => { setState('idle'); onChange(Math.max(0, Math.floor(Number(e.target.value) || 0))); }} />
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    setState('saving');
    setError(null);
    try {
      const r = await api<{ limits: Limits }>('/api/admin/limits', { method: 'PUT', body: limits });
      setLimits(r.limits);
      setState('saved');
      refreshCredits();
    } catch (err) {
      setError(err as ApiError);
      setState('idle');
    }
  }

  return (
    <form className="panel stack" onSubmit={save}>
      <h3>Monthly credits by plan</h3>
      <div className="grid-2">
        {PLANS.map((plan) => (
          <Field key={plan} label={PLAN_LABELS[plan]}>
            {number(limits.planMonthlyCredits[plan], (n) => setLimits({ ...limits, planMonthlyCredits: { ...limits.planMonthlyCredits, [plan]: n } }), 1_000_000)}
          </Field>
        ))}
      </div>
      <h3>Credits charged per action, and other limits</h3>
      <div className="grid-2">
        {FEATURES.map((feature) => (
          <Field key={feature} label={FEATURE_LABELS[feature] ?? feature}>
            {number(limits.creditCosts[feature], (n) => setLimits({ ...limits, creditCosts: { ...limits.creditCosts, [feature]: n } }), 100)}
          </Field>
        ))}
        <Field label="Requests per minute, per user">
          {number(limits.requestsPerMinute, (n) => setLimits({ ...limits, requestsPerMinute: n }), 600)}
        </Field>
        <Field label="Tracked channels, per user">
          {number(limits.trackedChannelsPerUser, (n) => setLimits({ ...limits, trackedChannelsPerUser: n }), 1000)}
        </Field>
      </div>
      <ErrorNotice error={error} />
      <div className="row">
        <button className="btn btn-primary" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving limits' : 'Save limits'}
        </button>
        <span role="status" className="muted small">
          {state === 'saved' ? 'Limits saved. They apply to the next request.' : ''}
        </span>
      </div>
    </form>
  );
}

function UserRow({ user, onSaved }: { user: AdminUser; onSaved: () => void }) {
  const [plan, setPlan] = useState(user.plan);
  const [override, setOverride] = useState(user.monthlyCreditsOverride === null ? '' : String(user.monthlyCreditsOverride));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const dirty = plan !== user.plan || override !== (user.monthlyCreditsOverride === null ? '' : String(user.monthlyCreditsOverride));

  async function save() {
    setState('saving');
    try {
      await api(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        body: { plan, monthlyCredits: override.trim() === '' ? null : Math.max(0, Math.floor(Number(override) || 0)) },
      });
      setState('saved');
      onSaved();
    } catch {
      setState('failed');
    }
  }

  return (
    <tr>
      <td>
        {user.email}
        {user.role === 'admin' && <span className="tag" style={{ marginLeft: 8 }}>Admin</span>}
      </td>
      <td>
        <select className="select" aria-label={`Plan for ${user.email}`} value={plan} onChange={(e) => { setPlan(e.target.value as SessionUser['plan']); setState('idle'); }} style={{ minWidth: 120 }}>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {PLAN_LABELS[p]}
            </option>
          ))}
        </select>
      </td>
      <td className="num">{user.creditsUsedThisMonth}</td>
      <td>
        <input className="input" aria-label={`Custom monthly credits for ${user.email}`} type="number" min={0} placeholder="Plan default" value={override} onChange={(e) => { setOverride(e.target.value); setState('idle'); }} style={{ width: 130 }} />
      </td>
      <td>
        <button type="button" className="btn btn-sm" onClick={save} disabled={!dirty || state === 'saving'}>
          {state === 'saving' ? 'Saving' : 'Save'}
        </button>{' '}
        <span role="status" className="small muted">
          {state === 'saved' && !dirty ? 'Saved' : state === 'failed' ? 'Could not save' : ''}
        </span>
      </td>
    </tr>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback((query: string) => {
    api<{ items: AdminUser[] }>(`/api/admin/users?${new URLSearchParams(query ? { q: query } : {})}`)
      .then((r) => { setUsers(r.items); setError(null); })
      .catch(setError);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="stack">
      <Field label="Find an account by email">
        {(p) => <input {...p} className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />}
      </Field>
      <ErrorNotice error={error} />
      {!users && !error && <Skeleton />}
      {users && users.length === 0 && <p className="muted">No accounts match that email.</p>}
      {users && users.length > 0 && (
        <div className="panel panel-flush table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Plan</th>
                <th className="num">Credits used</th>
                <th>Custom monthly credits</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} onSaved={() => { load(q); refreshCredits(); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users && users.length === 50 && <p className="muted small">Showing the 50 newest matches. Search to narrow it down.</p>}
    </div>
  );
}

export function AdminPanel() {
  return (
    <section className="stack-lg">
      <div className="stack">
        <h2>Limits for everyone</h2>
        <LimitsForm />
      </div>
      <div className="stack">
        <h2>Accounts</h2>
        <Users />
      </div>
    </section>
  );
}
