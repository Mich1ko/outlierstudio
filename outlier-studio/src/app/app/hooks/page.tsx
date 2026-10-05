'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { REMIX_KEY } from '@/components/GenerationViews';
import { HooksList } from '@/components/GenerationViews';
import { PlatformSelect } from '@/components/PlatformSelect';
import { ErrorNotice, Field, PageHead, useReveal, ReferenceTranscript, Skeleton } from '@/components/ui';
import { api, compact, type ApiError } from '@/lib/api';
import type { Generation } from '@/lib/types';

type HooksGeneration = Extract<Generation, { kind: 'hooks' }>;

function HooksTool() {
  const params = useSearchParams();
  const [form, setForm] = useState({ topic: params.get('topic') ?? '', audience: '', tone: '', platform: '', count: '10', referenceTranscript: '' });
  // A transcript handed over from a video breakdown ("Write hooks like this").
  useEffect(() => {
    if (params.get('remix') !== '1') return;
    try {
      const carried = sessionStorage.getItem(REMIX_KEY);
      if (carried) {
        setForm((f) => ({ ...f, referenceTranscript: carried }));
        sessionStorage.removeItem(REMIX_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  }, [params]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<HooksGeneration | null>(null);
  const [resultRef, reveal] = useReveal<HTMLElement>();
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    reveal();
    try {
      const { generation } = await api<{ generation: HooksGeneration }>('/api/ai/hooks', {
        body: { ...compact(form), count: Number(form.count) },
      });
      setResult(generation);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const fields = error?.fields ?? {};
  return (
    <>
      <PageHead title="Hooks">The first line decides whether anyone hears the second. Generate a set, then pick the one you would actually say.</PageHead>
      <div className="tool">
        <form className="panel stack" onSubmit={submit} noValidate>
          <Field label="What is the video about?" error={fields.topic}>
            {(p) => (
              <textarea {...p} className="textarea" value={form.topic} onChange={(e) => set('topic')(e.target.value)} required maxLength={300} placeholder="Why stretching before a run slows you down" />
            )}
          </Field>
          <Field label="Who is it for?" optional error={fields.audience}>
            {(p) => <input {...p} className="input" value={form.audience} onChange={(e) => set('audience')(e.target.value)} maxLength={200} placeholder="New runners training for a first 5K" />}
          </Field>
          <div className="grid-2">
            <Field label="Tone" optional error={fields.tone}>
              {(p) => <input {...p} className="input" value={form.tone} onChange={(e) => set('tone')(e.target.value)} maxLength={60} placeholder="Blunt, friendly" />}
            </Field>
            <Field label="How many">
              {(p) => (
                <select {...p} className="select" value={form.count} onChange={(e) => set('count')(e.target.value)}>
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <PlatformSelect value={form.platform} onChange={set('platform')} />
          <ReferenceTranscript summary="Model the hooks on a video" value={form.referenceTranscript} onChange={set('referenceTranscript')} error={fields.referenceTranscript} />
          <ErrorNotice error={error} />
          <button className="btn btn-primary" disabled={busy || form.topic.trim().length < 3}>
            {busy ? 'Generating hooks' : 'Generate hooks'}
          </button>
        </form>

        <section ref={resultRef} data-active={busy || result !== null} aria-live="polite" aria-busy={busy}>
          {busy ? (
            <div className="panel">
              <Skeleton lines={6} />
            </div>
          ) : result ? (
            <div className="stack">
              <p className="muted small">
                {result.output.hooks.length} hooks for &ldquo;{result.title}&rdquo;. Saved to your Library.
              </p>
              <HooksList hooks={result.output.hooks} topic={result.input.topic} />
            </div>
          ) : (
            <div className="empty">
              <h2>Your hooks will appear here</h2>
              <p className="muted">Describe the video on the left. Each hook comes with its pattern and the reason it holds attention.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function HooksPage() {
  return (
    <Suspense>
      <HooksTool />
    </Suspense>
  );
}
