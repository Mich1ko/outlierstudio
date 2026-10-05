'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AddVideoForm } from '@/components/AddVideoForm';
import { Picture } from '@/components/Picture';
import { ErrorNotice, Field, PageHead, Skeleton } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { ago, compact, duration } from '@/lib/format';
import type { ChannelList, FeedVideo } from '@/lib/types';
import { PLATFORM_NAME } from '@/shared/video-url';

type Page = { items: FeedVideo[]; nextOffset: number | null };

const SORTS = { outlier: 'Biggest outliers', momentum: 'Fastest growing now', recent: 'Newest', views: 'Most views' } as const;
const TYPES = { shorts: 'Shorts', long: 'Longer videos', all: 'All videos' } as const;
const PERIODS = { '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', all: 'Any time' } as const;
const DAY = 86_400_000;

function VideoRow({ video }: { video: FeedVideo }) {
  const isNew = Date.now() - new Date(video.publishedAt).getTime() < DAY;
  return (
    <Link className="video-row" href={`/app/videos/${video.id}`}>
      <Picture className="thumb" src={video.thumbnailUrl} />
      <span className="video-body">
        <span className="video-title">{video.title}</span>
        <span className="video-facts">
          {video.platform !== 'youtube' && <span className="tag">{PLATFORM_NAME[video.platform]}</span>}
          <span>{video.channelTitle}</span>
          <span>{ago(video.publishedAt)}</span>
          {video.durationSeconds !== null && video.durationSeconds > 0 && <span>{duration(video.durationSeconds)}</span>}
          {isNew && <span className="tag">New</span>}
        </span>
        <span className="video-facts">
          <span>
            <b>{video.viewCount === null ? 'Hidden' : compact(video.viewCount)}</b> views
          </span>
          {video.viewsPerHour !== null && (
            <span>
              <b>+{compact(Math.round(video.viewsPerHour))}</b> per hour
            </span>
          )}
          {video.likeCount !== null && (
            <span>
              <b>{compact(video.likeCount)}</b> likes
            </span>
          )}
          {video.commentCount !== null && (
            <span>
              <b>{compact(video.commentCount)}</b> comments
            </span>
          )}
        </span>
      </span>
      <span className="multiple-cell" data-hot={video.outlierMultiple !== null && video.outlierMultiple >= 3}>
        {video.outlierMultiple === null ? (
          <span>{video.monitored ? 'No baseline yet' : 'Added by link'}</span>
        ) : (
          <>
            <b>{video.outlierMultiple}x</b>
            <span>channel normal</span>
          </>
        )}
      </span>
    </Link>
  );
}

type Filters = { channel: string; type: keyof typeof TYPES; days: keyof typeof PERIODS; sort: keyof typeof SORTS };
const DEFAULTS: Filters = { channel: '', type: 'shorts', days: '30', sort: 'outlier' };

function fromParams(params: URLSearchParams): Filters {
  const pick = <T extends string>(name: string, allowed: Record<T, string>, fallback: T) => {
    const value = params.get(name);
    return value !== null && value in allowed ? (value as T) : fallback;
  };
  return { channel: params.get('channel') ?? '', type: pick('type', TYPES, 'shorts'), days: pick('days', PERIODS, '30'), sort: pick('sort', SORTS, 'outlier') };
}
const keyOf = (f: Filters) => `${f.channel}|${f.type}|${f.days}|${f.sort}`;

function Feed() {
  const params = useSearchParams();
  // The filters live in state; the address bar mirrors them so a filtered feed can be bookmarked or reopened.
  const [filters, setFilters] = useState<Filters>(() => fromParams(params));
  const key = keyOf(filters);
  useEffect(() => {
    const next = fromParams(params);
    setFilters((current) => (keyOf(current) === keyOf(next) ? current : next));
  }, [params]);

  const [channels, setChannels] = useState<ChannelList | null>(null);
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchPage = useCallback(
    (offset: number) => {
      const q = new URLSearchParams({ type: filters.type, days: filters.days, sort: filters.sort, offset: String(offset) });
      if (filters.channel) {
        q.set('channelId', filters.channel);
        q.set('scope', 'all');
      }
      return api<Page>(`/api/videos?${q}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    api<ChannelList>('/api/channels').then(setChannels).catch(() => undefined);
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetchPage(0)
      .then((page) => {
        if (!live) return;
        setVideos(page.items);
        setNext(page.nextOffset);
      })
      .catch((err) => live && setError(err))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [fetchPage]);

  const set = <K extends keyof Filters>(name: K, value: Filters[K]) => {
    const next = { ...filters, [name]: value };
    setFilters(next);
    const q = new URLSearchParams();
    for (const k of Object.keys(DEFAULTS) as (keyof Filters)[]) if (next[k] !== DEFAULTS[k]) q.set(k, next[k]);
    window.history.replaceState(null, '', `/app/feed${q.size ? `?${q}` : ''}`);
  };

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
    <div style={{ maxWidth: 1000 }}>
      <PageHead title="Videos">Your competitors&apos; videos, ranked against what is normal for each channel. Open one to break it down and write your own version.</PageHead>

      <details className="more panel" style={{ marginBottom: 18 }}>
        <summary>Add one video by link</summary>
        <AddVideoForm />
        <p className="muted small" style={{ marginTop: 8 }}>
          A YouTube link also adds its channel to your watchlist. TikTok and Instagram videos are added one at a time; those accounts are not monitored.
        </p>
      </details>

      <div className="filters">
        <Field label="Channel">
          {(p) => (
            <select {...p} className="select" value={filters.channel} onChange={(e) => set('channel', e.target.value)}>
              <option value="">All competitors</option>
              {channels?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.isOwn ? ' (yours)' : c.platform !== 'youtube' ? ` (${PLATFORM_NAME[c.platform]})` : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Type">
          {(p) => (
            <select {...p} className="select" value={filters.type} onChange={(e) => set('type', e.target.value as Filters['type'])}>
              {Object.entries(TYPES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Published">
          {(p) => (
            <select {...p} className="select" value={filters.days} onChange={(e) => set('days', e.target.value as Filters['days'])}>
              {Object.entries(PERIODS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Sort by">
          {(p) => (
            <select {...p} className="select" value={filters.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])}>
              {Object.entries(SORTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="stack">
        <ErrorNotice error={error} />
        {!videos && !error && <Skeleton lines={6} />}
        {videos && videos.length === 0 && (
          <div className="empty">
            {noChannels ? (
              <>
                <h2>Add a competitor to fill this list</h2>
                <p className="muted">Add a YouTube channel to your watchlist and its recent uploads appear here, ranked. Or add a single video by link above.</p>
                <div>
                  <Link className="btn btn-primary" href="/app/competitors">
                    Add a competitor
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2>No videos match these filters</h2>
                <p className="muted">Try a longer period or a different type.</p>
              </>
            )}
          </div>
        )}
        {videos && videos.length > 0 && (
          // Keep the previous list visible, dimmed, while a new filter loads.
          <div className="panel panel-flush" style={{ opacity: loading ? 0.55 : 1 }} aria-busy={loading}>
            {videos.map((v) => (
              <VideoRow key={v.id} video={v} />
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
        {filters.sort === 'momentum' && videos && videos.length > 0 && (
          <p className="muted small">Growth per hour is measured between the two most recent checks, so a video needs two checks before it has one.</p>
        )}
      </div>
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
