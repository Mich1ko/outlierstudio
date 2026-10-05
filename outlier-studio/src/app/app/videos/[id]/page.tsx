'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnalysisView } from '@/components/GenerationViews';
import { Picture } from '@/components/Picture';
import { ErrorNotice, Field, Skeleton, useReveal } from '@/components/ui';
import { ViewsChart } from '@/components/ViewsChart';
import { api, refreshCredits, type ApiError } from '@/lib/api';
import { ago, compact, day, duration, num, when } from '@/lib/format';
import type { Generation, VideoDetail } from '@/lib/types';
import { PLATFORM_NAME } from '@/shared/video-url';
import { watchUrl } from '@/shared/youtube-url';

type AnalysisGeneration = Extract<Generation, { kind: 'analysis' }>;

/** Failures of the automatic transcript, where pasting one in is the way forward. */
const PASTE_INSTEAD = new Set(['transcripts_not_configured', 'transcript_unavailable', 'transcript_quota', 'transcript_plan_limit', 'transcript_timeout', 'transcripts_unavailable', 'video_not_accessible']);

function VideoScreen() {
  const { id } = useParams<{ id: string }>();
  const autoStart = useSearchParams().get('analyze') === '1';
  const [data, setData] = useState<VideoDetail | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisGeneration | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<ApiError | null>(null);
  const [resultRef, reveal] = useReveal<HTMLElement>();
  const started = useRef(false);

  const load = useCallback(
    () =>
      api<VideoDetail>(`/api/videos/${id}`).then((d) => {
        setData(d);
        setAnalysis((current) => current ?? d.latestAnalysis);
        return d;
      }),
    [id],
  );

  const analyze = useCallback(
    async (transcript?: string) => {
      setBusy(true);
      setError(null);
      reveal();
      try {
        const { generation } = await api<{ generation: AnalysisGeneration }>('/api/ai/analyze', { body: { videoId: id, ...(transcript ? { transcript } : {}) } });
        setAnalysis(generation);
        setPasteOpen(false);
        void load().catch(() => undefined);
      } catch (err) {
        const e = err as ApiError;
        setError(e);
        if (PASTE_INSTEAD.has(e.code)) setPasteOpen(true);
      } finally {
        setBusy(false);
        refreshCredits();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, load],
  );

  useEffect(() => {
    load()
      .then((d) => {
        // Arriving from "Analyze a link": start straight away, once, unless it has been done before.
        if (autoStart && !d.latestAnalysis && !started.current) {
          started.current = true;
          void analyze();
        }
      })
      .catch(setLoadError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function updateNumbers() {
    setUpdating(true);
    setUpdateError(null);
    try {
      await api(`/api/videos/${id}/refresh`, { method: 'POST' });
      await load();
    } catch (err) {
      setUpdateError(err as ApiError);
    } finally {
      setUpdating(false);
    }
  }

  if (loadError) {
    return (
      <div className="stack" style={{ maxWidth: 640 }}>
        {loadError.status === 404 ? (
          <div className="empty">
            <h2>This video is not in your list</h2>
            <p className="muted">Its channel may have been removed from your watchlist.</p>
          </div>
        ) : (
          <ErrorNotice error={loadError} />
        )}
        <div>
          <Link className="btn" href="/app/feed">
            Back to Videos
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return <Skeleton lines={8} />;

  const { video, history, analyses } = data;
  const platform = PLATFORM_NAME[video.platform];
  const kind = video.isShort ? 'short videos' : 'longer videos';
  const earlier = analyses.filter((a) => a.id !== analysis?.id);
  const submitPasted = (e: FormEvent) => {
    e.preventDefault();
    void analyze(pasted);
  };

  return (
    <div className="stack-lg" style={{ maxWidth: 1000 }}>
      <header className="stack">
        <Link href="/app/feed" className="small">
          Back to Videos
        </Link>
        <div className="video-head">
          <Picture className="thumb" src={video.thumbnailUrl} lazy={false} />
          <div className="stack">
            <h1 style={{ overflowWrap: 'anywhere' }}>{video.title}</h1>
            <p className="muted">
              <span className="tag">{platform}</span> {video.channelTitle}, published {day(video.publishedAt)} ({ago(video.publishedAt)})
              {video.durationSeconds !== null && video.durationSeconds > 0 && `, ${duration(video.durationSeconds)} long`}
            </p>
            <div className="row">
              <a className="btn btn-sm" href={watchUrl(video)} target="_blank" rel="noreferrer">
                Watch on {platform}
              </a>
              <Link className="btn btn-sm" href={`/app/feed?channel=${video.channelId}&days=all`}>
                More from {video.channelTitle}
              </Link>
              {!video.monitored && (
                <button type="button" className="btn btn-sm" onClick={updateNumbers} disabled={updating}>
                  {updating ? 'Updating numbers' : 'Update numbers'}
                </button>
              )}
            </div>
            <ErrorNotice error={updateError} />
          </div>
        </div>
      </header>

      <section className="tiles" aria-label="Current numbers">
        <div className="tile">
          <b>{video.outlierMultiple === null ? 'No baseline' : `${video.outlierMultiple}x`}</b>
          <span>
            {video.outlierMultiple === null
              ? video.monitored
                ? `the channel's normal for ${kind}`
                : 'needs five videos from this account'
              : `the channel's normal of ${compact(video.channelMedianViews ?? 0)} for ${kind}`}
          </span>
        </div>
        <div className="tile">
          <b>{video.viewCount === null ? 'Hidden' : num(video.viewCount)}</b>
          <span>Views, checked {ago(video.lastCheckedAt)}</span>
        </div>
        <div className="tile">
          <b>{video.viewsPerHour === null ? 'Not yet' : `+${num(Math.round(video.viewsPerHour))}`}</b>
          <span>{video.viewsPerHour === null ? 'Views per hour, after the next check' : 'Views per hour, between the last two checks'}</span>
        </div>
        <div className="tile">
          <b>{video.likeCount === null ? 'Hidden' : compact(video.likeCount)}</b>
          <span>Likes</span>
        </div>
        <div className="tile">
          <b>{video.commentCount === null ? 'Off' : compact(video.commentCount)}</b>
          <span>Comments</span>
        </div>
      </section>

      <section className="stack" ref={resultRef} style={{ scrollMarginTop: 72 }} aria-busy={busy}>
        <h2>Breakdown</h2>
        {busy ? (
          <div className="panel stack">
            <p role="status">
              <span className="tally" style={{ display: 'inline-block', marginRight: 8 }} aria-hidden="true" />
              {video.hasTranscript || pasted ? 'Breaking the video down.' : 'Getting the transcript, then breaking the video down.'} This takes about 20 seconds.
            </p>
            <Skeleton lines={6} />
          </div>
        ) : analysis ? (
          <>
            <AnalysisView analysis={analysis.output} transcript={analysis.input.transcript} title={video.title} hideMultiple />
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => analyze()}>
                Break it down again
              </button>
              <span className="muted small">Uses 1 credit.{video.hasTranscript ? ' The transcript is already saved, so no new one is fetched.' : ''}</span>
            </div>
          </>
        ) : (
          <div className="panel stack">
            <p>Get this video&apos;s hook, its structure beat by beat, and ideas for your own version.</p>
            {!data.transcriptsConfigured && !video.hasTranscript && (
              <p className="notice">
                Automatic transcripts are not set up on this server (it needs a <code>SUPADATA_API_KEY</code>). You can still paste a transcript below.
              </p>
            )}
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => analyze()}>
                Analyze this video
              </button>
              <span className="muted small">Fetches the transcript for you. Uses 1 credit.</span>
            </div>
          </div>
        )}
        <ErrorNotice error={error} />

        {!busy && (
          <details className="more" open={pasteOpen} onToggle={(e) => setPasteOpen(e.currentTarget.open)}>
            <summary>Paste a transcript instead</summary>
            <form className="panel stack" onSubmit={submitPasted} noValidate>
              <p className="muted small">
                For videos with no transcript available. On {platform}, open the video, find its transcript or captions, and copy the text across. Timestamps are fine to include.
              </p>
              <Field label="Transcript" error={error?.fields.transcript}>
                {(p) => <textarea {...p} className="textarea textarea-tall" value={pasted} onChange={(e) => setPasted(e.target.value)} maxLength={20000} />}
              </Field>
              <div>
                <button className="btn" disabled={pasted.trim().length < 40}>
                  Analyze with this transcript
                </button>
              </div>
            </form>
          </details>
        )}
      </section>

      {video.transcript && (
        <section className="stack">
          <details className="more">
            <summary>Transcript</summary>
            <p className="panel" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {video.transcript}
            </p>
          </details>
        </section>
      )}

      <section className="stack">
        <h2>Views at each check</h2>
        {history.filter((h) => h.viewCount !== null).length < 2 ? (
          <p className="muted">
            Checked once so far, {ago(video.lastCheckedAt)}.{' '}
            {video.monitored ? 'The chart starts after the next check.' : 'Use Update numbers later to start a chart; TikTok and Instagram videos are not checked automatically.'}
          </p>
        ) : (
          <div className="panel">
            <ViewsChart history={history} />
            <details className="more" style={{ marginTop: 8 }}>
              <summary>Show every check as a table</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Checked</th>
                      <th className="num">Views</th>
                      <th className="num">Likes</th>
                      <th className="num">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((h) => (
                      <tr key={h.takenAt}>
                        <td>{when(h.takenAt)}</td>
                        <td className="num">{h.viewCount === null ? 'Hidden' : num(h.viewCount)}</td>
                        <td className="num">{h.likeCount === null ? 'Hidden' : num(h.likeCount)}</td>
                        <td className="num">{h.commentCount === null ? 'Off' : num(h.commentCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}
      </section>

      {earlier.length > 0 && (
        <section className="stack">
          <h2>Earlier breakdowns of this video</h2>
          <div className="panel panel-flush rows">
            {earlier.map((a) => (
              <Link key={a.id} href={`/app/library/${a.id}`}>
                <span className="title">{a.title}</span>
                <span className="small muted">{day(a.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function VideoPage() {
  return (
    <Suspense>
      <VideoScreen />
    </Suspense>
  );
}
