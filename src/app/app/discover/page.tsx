'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Picture } from '@/components/Picture';
import { ErrorNotice, PageHead, Skeleton } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { compact } from '@/lib/format';
import type { ChannelList } from '@/lib/types';
import { TIERS, TIER_LABEL, type TierKey } from '@/shared/tiers';
import { youtubeChannelUrl } from '@/shared/youtube-url';

type Result = {
  externalId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  tier: TierKey;
};

const FILTERS: ('all' | TierKey)[] = ['all', ...TIERS.map((t) => t.key), 'unknown'];

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<'all' | TierKey>('all');
  const [results, setResults] = useState<Result[] | null>(null);
  const [searched, setSearched] = useState('');
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api<ChannelList>('/api/channels')
      .then((list) => setTracked(new Set(list.items.map((c) => c.externalId))))
      .catch(() => undefined);
  }, []);

  async function search(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, tier });
      const data = await api<{ items: Result[]; query: string }>(`/api/discover?${params}`);
      setResults(data.items);
      setSearched(data.query);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }

  async function track(channel: Result) {
    setBusy(channel.externalId);
    setError(null);
    try {
      await api('/api/channels', { body: { url: youtubeChannelUrl(channel.externalId) } });
      setTracked((prev) => new Set(prev).add(channel.externalId));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 1100 }}>
      <PageHead title="Discover">Search a niche on YouTube and sort the channels by size. Add the ones worth watching to your watchlist.</PageHead>

      <form onSubmit={search} className="discover-search" role="search" style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. home workouts for busy parents"
          aria-label="Niche to search"
          maxLength={100}
        />
        <button className="btn btn-primary" disabled={loading || query.trim().length < 2}>
          {loading ? 'Searching' : 'Search'}
        </button>
      </form>

      <div className="chips" role="group" aria-label="Filter by follower tier">
        {FILTERS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={tier === f} onClick={() => setTier(f)}>
            {f === 'all' ? 'All sizes' : TIER_LABEL[f]}
          </button>
        ))}
      </div>

      <ErrorNotice error={error} />

      {loading && <Skeleton lines={5} />}

      {!loading && results && results.length === 0 && (
        <p className="muted">No YouTube channels matched &ldquo;{searched}&rdquo;{tier !== 'all' ? ` in ${TIER_LABEL[tier]} size` : ''}. Try a broader niche or another size.</p>
      )}

      {!loading && results && results.length > 0 && (
        <ul className="panel panel-open">
          {results.map((c) => (
            <li key={c.externalId} className="channel">
              <Picture className="avatar" src={c.thumbnailUrl} />
              <div className="channel-name">
                <span>{c.title}</span>
                <span className="muted small">
                  {c.handle ?? 'YouTube'} · {TIER_LABEL[c.tier]} · {c.videoCount ?? 0} videos
                </span>
              </div>
              <div className="stat">
                <b>{c.subscriberCount === null ? 'Hidden' : compact(c.subscriberCount)}</b>
                <span>subscribers</span>
              </div>
              {tracked.has(c.externalId) ? (
                <span className="muted small">On your watchlist</span>
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => track(c)} disabled={busy !== null}>
                  {busy === c.externalId ? 'Adding' : 'Add to watchlist'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
