'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, type ApiError } from '@/lib/api';
import type { Limits } from '@/lib/types';
import { ErrorNotice, Field, Skeleton } from './ui';

export function AdminPanel() {
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
    } catch (err) {
      setError(err as ApiError);
      setState('idle');
    }
  }

  return (
    <form className="panel stack" onSubmit={save}>
      <h2>Safety limits</h2>
      <div className="grid-2">
        <Field label="AI requests per minute">{number(limits.requestsPerMinute, (n) => setLimits({ ...limits, requestsPerMinute: n }), 600)}</Field>
        <Field label="Tracked channels">{number(limits.trackedChannelsPerUser, (n) => setLimits({ ...limits, trackedChannelsPerUser: n }), 1000)}</Field>
      </div>
      <ErrorNotice error={error} />
      <div className="row">
        <button className="btn btn-primary" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving' : 'Save limits'}
        </button>
        <span role="status" className="muted small">
          {state === 'saved' ? 'Saved.' : ''}
        </span>
      </div>
    </form>
  );
}
