'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AddVideoForm } from '@/components/AddVideoForm';
import { Picture } from '@/components/Picture';
import { ErrorNotice, Skeleton } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { ago, compact } from '@/lib/format';
import type { ChannelList, FeedVideo } from '@/lib/types';
import { PLATFORM_NAME } from '@/shared/video-url';

type Page = { items: FeedVideo[]; nextOffset: number | null };

const SORTS = { outlier: 'Outlier score', views: 'Most views', engagement: 'Engagement', momentum: 'Growing fastest', recent: 'Newest' } as const;
const UNIT_DAYS = { days: 1, weeks: 7, months: 30 } as const;

type Filters = {
  channel: string;
  q: string;
  minOutlier: string;
  maxOutlier: string;
  minViews: string;
  maxViews: string;
  minEngagement: string;
  maxEngagement: string;
  within: string;
  unit: keyof typeof UNIT_DAYS;
  platform: '' | 'youtube' | 'tiktok' | 'instagram';
  type: 'all' | 'shorts' | 'long';
  analyzed: boolean;
  unanalyzed: boolean;
  sort: keyof typeof SORTS;
};

const DEFAULTS: Filters = {
  channel: '', q: '', minOutlier: '', maxOutlier: '', minViews: '', maxViews: '', minEngagement: '', maxEngagement: '',
  within: '1', unit: 'months', platform: '', type: 'all', analyzed: true, unanalyzed: true, sort: 'outlier',
};
const SAVED_KEY = 'videos.savedFilter';

function loadSaved(): Filters | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Filters>) } : null;
  } catch {
    return null;
  }
}

function toQuery(f: Filters, offset: number): URLSearchParams {
  const q = new URLSearchParams({ type: f.type, sort: f.sort, offset: String(offset), days: 'all' });
  if (f.channel) {
    q.set('channelId', f.channel);
    q.set('scope', 'all');
  }
  const within = Number(f.within);
  if (f.within && within > 0) q.set('withinDays', String(Math.round(within * UNIT_DAYS[f.unit])));
  const nums: [keyof Filters, string][] = [
    ['minOutlier', 'minOutlier'], ['maxOutlier', 'maxOutlier'], ['minViews', 'minViews'], ['maxViews', 'maxViews'],
    ['minEngagement', 'minEngagement'], ['maxEngagement', 'maxEngagement'],
  ];
  for (const [key, param] of nums) {
    const v = String(f[key]).replace(/[,\s%x]/gi, '');
    if (v !== '' && Number.isFinite(Number(v))) q.set(param, v);
  }
  if (f.q.trim()) q.set('q', f.q.trim());
  if (f.platform) q.set('platform', f.platform);
  q.set('status', f.analyzed && f.unanalyzed ? 'all' : f.analyzed ? 'analyzed' : 'unanalyzed');
  return q;
}

function engagementRate(v: FeedVideo): number | null {
  if (!v.viewCount) return null;
  const rate = (((v.likeCount ?? 0) + (v.commentCount ?? 0)) / v.viewCount) * 100;
  return rate < 10 ? Math.round(rate * 10) / 10 : Math.round(rate);
}

const svg = { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const TrendIcon = () => (<svg {...svg}><path d="M2 11l4-4 3 3 5-6" /><path d="M10 4h4v4" /></svg>);
const EyeIcon = () => (<svg {...svg}><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></svg>);
const SparkIcon = () => (<svg {...svg}><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" /></svg>);

const PLATFORM_GLYPH: Record<FeedVideo['platform'], ReactNode> = {
  youtube: (<svg viewBox="0 0 16 16" aria-hidden><path d="M6 4.5v7l6-3.5z" fill="currentColor" /></svg>),
  instagram: (<svg {...svg} strokeWidth={1.6}><rect x="2.5" y="2.5" width="11" height="11" rx="3.2" /><circle cx="8" cy="8" r="2.6" /><circle cx="11.4" cy="4.6" r="0.4" fill="currentColor" /></svg>),
  tiktok: (<svg viewBox="0 0 16 16" aria-hidden><path d="M9.5 2h2a3 3 0 0 0 2.5 2.5v2a5 5 0 0 1-2.5-.8V10a4 4 0 1 1-4-4v2.1A1.9 1.9 0 1 0 9.5 10z" fill="currentColor" /></svg>),
};

function VideoCard({ video }: { video: FeedVideo }) {
  const eng = engagementRate(video);
  const portrait = video.isShort || video.platform !== 'youtube';
  return (
    <Link className="vcard" href={`/app/videos/${video.id}`} data-short={portrait}>
      <span className="vcard-media">
        <Picture className="vthumb" src={video.thumbnailUrl} />
        <span className="vcard-badge" data-p={video.platform} title={PLATFORM_NAME[video.platform]}>
          {PLATFORM_GLYPH[video.platform]}
        </span>
        {video.analyzed && <span className="vcard-done">Analyzed</span>}
      </span>
      <span className="vcard-title" title={video.title}>{video.title}</span>
      <span className="vcard-meta">
        <span>{video.channelHandle ?? video.channelTitle}</span>
        <span>{ago(video.publishedAt)}</span>
      </span>
      <span className="pills">
        {video.outlierMultiple !== null && (
          <span className="pill pill-green" title="Views compared with the channel's normal"><TrendIcon />{video.outlierMultiple}x</span>
        )}
        {video.viewCount !== null && (
          <span className="pill pill-blue" title="Views"><EyeIcon />{compact(video.viewCount)}</span>
        )}
        {eng !== null && (
          <span className="pill pill-orange" title="Likes and comments per view"><SparkIcon />{eng}%</span>
        )}
      </span>
    </Link>
  );
}

function Range({ label, min, max, onMin, onMax, minHint, maxHint }: {
  label: string; min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void; minHint: string; maxHint: string;
}) {
  return (
    <div className="filter">
      <span>{label}</span>
      <div className="range">
        <input className="input" inputMode="decimal" aria-label={`${label}, minimum`} placeholder={minHint} value={min} onChange={(e) => onMin(e.target.value)} />
        <span>–</span>
        <input className="input" inputMode="decimal" aria-label={`${label}, maximum`} placeholder={maxHint} value={max} onChange={(e) => onMax(e.target.value)} />
      </div>
    </div>
  );
}

function Feed() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  // A link from Channels (?channel=…) wins over the saved filter.
  useEffect(() => {
    const channel = params.get('channel');
    if (channel) setFilters({ ...DEFAULTS, channel, within: params.get('days') === 'all' ? '' : DEFAULTS.within });
    else setFilters(loadSaved() ?? DEFAULTS);
    setReady(true);
  }, [params]);

  const [channels, setChannels] = useState<ChannelList | null>(null);
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api<ChannelList>('/api/channels').then(setChannels).catch(() => undefined);
  }, []);

  const noStatus = !filters.analyzed && !filters.unanalyzed;
  const query = toQuery(filters, 0).toString();

  const fetchPage = useCallback((offset: number) => {
    const q = new URLSearchParams(query);
    q.set('offset', String(offset));
    return api<Page>(`/api/videos?${q}`);
  }, [query]);

  useEffect(() => {
    if (!ready) return;
    if (noStatus) {
      setVideos([]);
      setNext(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    // Typing in a range box should not send a request per keystroke.
    const timer = setTimeout(() => {
      fetchPage(0)
        .then((page) => {
          if (!live) return;
          setVideos(page.items);
          setNext(page.nextOffset);
        })
        .catch((err) => live && setError(err))
        .finally(() => live && setLoading(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [fetchPage, ready, noStatus]);

  const set = <K extends keyof Filters>(name: K, value: Filters[K]) => {
    setSavedNote('');
    setFilters((f) => ({ ...f, [name]: value }));
  };

  function save() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(filters));
      setSavedNote('Saved');
    } catch {
      setSavedNote('Could not save in this browser');
    }
  }

  async function more() {
    if (next === null) return;
    setLoading(true);
    try {
      const page = await fetchPage(next);
      setVideos((v) => [...(v ?? []), ...page.items]);
      setNext(page.nextOffset);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }

  const noChannels = channels !== null && channels.items.length === 0;

  return (
    <div className="feed">
      <aside className="feed-filters" aria-label="Filters">
        <div className="feed-filters-head">
          <h2>Filters</h2>
          <button type="button" className="link-btn" onClick={() => { setFilters(DEFAULTS); setSavedNote(''); }}>
            Clear
          </button>
        </div>

        <label className="filter">
          <span>Channels</span>
          <select className="select" value={filters.channel} onChange={(e) => set('channel', e.target.value)}>
            <option value="">All channels</option>
            {channels?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.isOwn ? ' (yours)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="filter">
          <span>Keywords</span>
          <input className="input" type="search" placeholder="Search captions and titles" value={filters.q} onChange={(e) => set('q', e.target.value)} maxLength={100} />
        </label>

        <Range label="Outlier score" min={filters.minOutlier} max={filters.maxOutlier} onMin={(v) => set('minOutlier', v)} onMax={(v) => set('maxOutlier', v)} minHint="1x" maxHint="100x" />
        <Range label="Views" min={filters.minViews} max={filters.maxViews} onMin={(v) => set('minViews', v)} onMax={(v) => set('maxViews', v)} minHint="0" maxHint="10,000,000" />
        <Range label="Engagement" min={filters.minEngagement} max={filters.maxEngagement} onMin={(v) => set('minEngagement', v)} onMax={(v) => set('maxEngagement', v)} minHint="0%" maxHint="100%" />

        <div className="filter">
          <span>Posted in last</span>
          <div className="range" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)' }}>
            <input className="input" inputMode="numeric" aria-label="Posted in last, amount" placeholder="Any" value={filters.within} onChange={(e) => set('within', e.target.value.replace(/\D/g, ''))} />
            <select className="select" aria-label="Posted in last, unit" value={filters.unit} onChange={(e) => set('unit', e.target.value as Filters['unit'])}>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>

        <label className="filter">
          <span>Platform</span>
          <select className="select" value={filters.platform} onChange={(e) => set('platform', e.target.value as Filters['platform'])}>
            <option value="">All platforms</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </select>
        </label>

        <label className="filter">
          <span>Format</span>
          <select className="select" value={filters.type} onChange={(e) => set('type', e.target.value as Filters['type'])}>
            <option value="all">Short and long</option>
            <option value="shorts">Short-form only</option>
            <option value="long">Long-form only</option>
          </select>
        </label>

        <div className="filter">
          <span>Status</span>
          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={filters.analyzed} onChange={(e) => set('analyzed', e.target.checked)} />
              Analyzed
            </label>
            <label className="toggle">
              <input type="checkbox" checked={filters.unanalyzed} onChange={(e) => set('unanalyzed', e.target.checked)} />
              Unanalyzed
            </label>
          </div>
        </div>

        <button type="button" className="btn btn-block" onClick={save}>
          {savedNote || 'Save filter'}
        </button>
      </aside>

      <section aria-label="Videos" aria-busy={loading}>
        <div className="feed-bar">
          <h1>Videos</h1>
          <div className="row" style={{ gap: 8 }}>
            <label className="row" style={{ gap: 6 }}>
              <span className="muted small">Sort by</span>
              <select className="select" value={filters.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])}>
                {Object.entries(SORTS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
            <details className="menu">
              <summary className="btn btn-sm btn-primary">Add video</summary>
              <div className="menu-items" style={{ minWidth: 320, padding: 12 }}>
                <AddVideoForm />
              </div>
            </details>
          </div>
        </div>

        <div className="stack">
          <ErrorNotice error={error} />
          {!videos && !error && <Skeleton lines={6} />}
          {videos && videos.length === 0 && !loading && (
            <div className="empty">
              {noChannels ? (
                <>
                  <h2>Add a channel to fill this page</h2>
                  <p className="muted">Track a YouTube channel or Instagram account and its new posts show up here, ranked by how far they beat that creator&apos;s normal.</p>
                  <div className="row">
                    <Link className="btn btn-primary" href="/app/discover">Find channels</Link>
                    <Link className="btn" href="/app/competitors">Paste a channel link</Link>
                  </div>
                </>
              ) : noStatus ? (
                <>
                  <h2>Pick a status</h2>
                  <p className="muted">Tick Analyzed, Unanalyzed, or both.</p>
                </>
              ) : (
                <>
                  <h2>No videos match these filters</h2>
                  <p className="muted">Widen a range or a time period, or press Clear.</p>
                </>
              )}
            </div>
          )}
          {videos && videos.length > 0 && (
            <div className="vgrid" style={{ opacity: loading ? 0.55 : 1 }}>
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
          {next !== null && videos && videos.length > 0 && (
            <div>
              <button type="button" className="btn" onClick={more} disabled={loading}>
                {loading ? 'Loading' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}
