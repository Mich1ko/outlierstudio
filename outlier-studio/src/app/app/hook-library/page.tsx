'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CopyButton, ErrorNotice, PageHead, Skeleton } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { compact } from '@/lib/format';
import type { HookLibraryItem } from '@/lib/types';
import { PLATFORM_NAME } from '@/shared/video-url';

export default function HookLibraryPage() {
  const [items, setItems] = useState<HookLibraryItem[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    api<{ items: HookLibraryItem[] }>('/api/hook-library')
      .then((r) => setItems(r.items))
      .catch(setError);
  }, []);

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHead title="Hook library">The opening line of every video you have broken down, with why it works. Reuse the pattern, not the words.</PageHead>
      <div className="stack">
        <ErrorNotice error={error} />
        {!items && !error && <Skeleton lines={5} />}
        {items && items.length === 0 && (
          <div className="empty">
            <h2>No hooks yet</h2>
            <p className="muted">Each video you break down adds its hook here.</p>
            <div>
              <Link className="btn btn-primary" href="/app/feed">
                Pick a video to break down
              </Link>
            </div>
          </div>
        )}
        {items && items.length > 0 && (
          <ol className="panel panel-flush hook-list">
            {items.map((item) => (
              <li key={item.generationId} className="hook-item">
                <p className="hook-text">{item.hook.text}</p>
                <div className="hook-meta">
                  {item.hook.pattern && <span className="tag">{item.hook.pattern}</span>}
                  <span className="muted small">{item.hook.whyItWorks}</span>
                </div>
                <p className="small muted">
                  {item.video ? (
                    <>
                      From <Link href={`/app/videos/${item.video.id}`}>{item.video.title}</Link> by {item.video.channelTitle} on {PLATFORM_NAME[item.video.platform]}
                      {item.video.viewCount !== null && `, ${compact(item.video.viewCount)} views`}
                      {item.video.outlierMultiple !== null && `, ${item.video.outlierMultiple}x the channel's normal`}
                    </>
                  ) : (
                    <>From {item.title}</>
                  )}
                </p>
                <div className="row">
                  <CopyButton text={item.hook.text} />
                  <Link className="btn btn-sm" href={`/app/hooks?${new URLSearchParams({ topic: item.video?.title ?? item.title })}`}>
                    Write hooks like this
                  </Link>
                  <Link className="btn btn-sm" href={`/app/library/${item.generationId}`}>
                    Open the breakdown
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
