'use client';

import { useState, type FormEvent } from 'react';
import { AddVideoForm } from '@/components/AddVideoForm';
import { AnalysisView } from '@/components/GenerationViews';
import { PlatformSelect } from '@/components/PlatformSelect';
import { ErrorNotice, Field, PageHead, useReveal, Skeleton } from '@/components/ui';
import { api, compact, refreshCredits, type ApiError } from '@/lib/api';
import type { Generation } from '@/lib/types';

type AnalysisGeneration = Extract<Generation, { kind: 'analysis' }>;

const wholeNumber = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(/[,\s]/g, '')));

export default function AnalyzePage() {
  const [form, setForm] = useState({ transcript: '', title: '', platform: '', sourceUrl: '', views: '', channelMedianViews: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<AnalysisGeneration | null>(null);
  const [resultRef, reveal] = useReveal<HTMLElement>();
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    reveal();
    try {
      const { views, channelMedianViews, ...text } = form;
      const { generation } = await api<{ generation: AnalysisGeneration }>('/api/ai/analyze', {
        body: compact({ ...text, views: wholeNumber(views), channelMedianViews: wholeNumber(channelMedianViews) }),
      });
      setResult(generation);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
      refreshCredits();
    }
  }

  const fields = error?.fields ?? {};
  return (
    <>
      <PageHead title="Analyze a link">Paste a link to a video that performed. The transcript is fetched for you and the video is broken down into its hook, structure and ideas for your own version.</PageHead>

      <div className="panel" style={{ maxWidth: 760, marginBottom: 28 }}>
        <AddVideoForm analyze label="Link to the video" button="Analyze this video" />
        <p className="muted small" style={{ marginTop: 8 }}>Uses 1 credit. The video is also saved to your Videos list.</p>
      </div>

      <h2 style={{ marginBottom: 12 }}>No link? Paste a transcript</h2>
      <div className="tool">
        <form className="panel stack" onSubmit={submit} noValidate>
          <Field label="Transcript" hint="The spoken words of the video, at least a few sentences." error={fields.transcript}>
            {(p) => <textarea {...p} className="textarea textarea-tall" value={form.transcript} onChange={(e) => set('transcript')(e.target.value)} required maxLength={20000} />}
          </Field>
          <Field label="Title" optional error={fields.title}>
            {(p) => <input {...p} className="input" value={form.title} onChange={(e) => set('title')(e.target.value)} maxLength={200} />}
          </Field>
          <details className="more">
            <summary>Add performance numbers and source</summary>
            <div className="stack">
              <div className="grid-2">
                <Field label="Views" optional hint="For this video." error={fields.views}>
                  {(p) => <input {...p} className="input" inputMode="numeric" value={form.views} onChange={(e) => set('views')(e.target.value)} />}
                </Field>
                <Field label="Usual views" optional hint="The channel's median per video." error={fields.channelMedianViews}>
                  {(p) => <input {...p} className="input" inputMode="numeric" value={form.channelMedianViews} onChange={(e) => set('channelMedianViews')(e.target.value)} />}
                </Field>
              </div>
              <PlatformSelect value={form.platform} onChange={set('platform')} />
              <Field label="Source link" optional error={fields.sourceUrl}>
                {(p) => <input {...p} className="input" type="url" value={form.sourceUrl} onChange={(e) => set('sourceUrl')(e.target.value)} placeholder="https://" />}
              </Field>
            </div>
          </details>
          <ErrorNotice error={error} />
          <button className="btn btn-primary" disabled={busy || form.transcript.trim().length < 40}>
            {busy ? 'Analyzing video' : 'Analyze video'}
          </button>
        </form>

        <section ref={resultRef} data-active={busy || result !== null} aria-live="polite" aria-busy={busy}>
          {busy ? (
            <div className="panel">
              <Skeleton lines={8} />
            </div>
          ) : result ? (
            <div className="stack">
              <p className="muted small">Saved to your Library.</p>
              <AnalysisView analysis={result.output} transcript={result.input.transcript} title={result.title} />
            </div>
          ) : (
            <div className="empty">
              <h2>The breakdown will appear here</h2>
              <p className="muted">It reads the transcript only, so it covers what was said and how it was structured, not the visuals or editing.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
