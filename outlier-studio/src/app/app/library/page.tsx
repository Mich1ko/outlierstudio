'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GenerationRows } from '@/components/RecentList';
import { ErrorNotice, PageHead, Skeleton } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import type { GenerationSummary } from '@/lib/types';

const FILTERS = [
  { key: '', label: 'Everything' },
  { key: 'analysis', label: 'Analyses' },
  { key: 'hooks', label: 'Hooks' },
  { key: 'script', label: 'Scripts' },
  { key: 'report', label: 'Reports' },
] as const;

type Page = { items: GenerationSummary[]; nextBefore: string | null };

export default function LibraryPage() {
  const [kind, setKind] = useState<string>('');
  const [items, setItems] = useState<GenerationSummary[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async (filter: string, before?: string) => {
    const query = new URLSearchParams({ limit: '30', ...(filter ? { kind: filter } : {}), ...(before ? { before } : {}) });
    return api<Page>(`/api/generations?${query}`);
  }, []);

  useEffect(() => {
    let live = true;
    setItems(null);
    setError(null);
    load(kind)
      .then((page) => {
        if (!live) return;
        setItems(page.items);
        setNext(page.nextBefore);
      })
      .catch((err) => live && setError(err));
    return () => {
      live = false;
    };
  }, [kind, load]);

  async function more() {
    if (!next) return;
    setBusy(true);
    try {
      const page = await load(kind, next);
      setItems((current) => [...(current ?? []), ...page.items]);
      setNext(page.nextBefore);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Library">Everything you generate is saved here.</PageHead>
      <div className="tabs" role="group" aria-label="Filter by type">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" aria-pressed={kind === f.key} onClick={() => setKind(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="stack" style={{ maxWidth: 900 }}>
        <ErrorNotice error={error} />
        {!items && !error && <Skeleton lines={5} />}
        {items && items.length === 0 && (
          <div className="empty">
            <h2>{kind ? 'Nothing of this type yet' : 'Your library is empty'}</h2>
            <p className="muted">Breakdowns, hooks, scripts and reports are saved here as soon as they are generated.</p>
            <div>
              <Link className="btn btn-primary" href="/app/analyze">
                Analyze a video
              </Link>
            </div>
          </div>
        )}
        {items && items.length > 0 && <GenerationRows items={items} />}
        {next && (
          <div>
            <button type="button" className="btn" onClick={more} disabled={busy}>
              {busy ? 'Loading' : 'Show more'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
