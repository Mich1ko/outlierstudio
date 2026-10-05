'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { REMIX_KEY } from '@/components/GenerationViews';
import { PlatformSelect } from '@/components/PlatformSelect';
import { ScriptStage } from '@/components/ScriptStage';
import { CopyButton, ErrorNotice, Field, PageHead, ReferenceTranscript, useReveal } from '@/components/ui';
import { compact, refreshCredits, type ApiError } from '@/lib/api';
import { streamScript } from '@/lib/stream';
import { FRAMEWORK_KEYS, FRAMEWORKS, type Framework } from '@/shared/catalog';

const LENGTHS = [15, 30, 45, 60, 90, 120, 180];

function ScriptWriter() {
  const params = useSearchParams();
  const [form, setForm] = useState({
    idea: params.get('idea') ?? '',
    draft: '',
    hook: params.get('hook') ?? '',
    framework: 'problem_solution' as Framework,
    lengthSeconds: '45',
    tone: '',
    audience: '',
    platform: '',
    callToAction: '',
    referenceTranscript: '',
  });
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'idle' | 'writing' | 'done' | 'stopped'>('idle');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fromDraft, setFromDraft] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const [stageRef, reveal] = useReveal<HTMLDivElement>();
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  // A transcript handed over from the Analyze page ("Write this script").
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

  useEffect(() => () => abort.current?.abort(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const controller = new AbortController();
    abort.current = controller;
    setText('');
    setError(null);
    setSavedId(null);
    setTruncated(false);
    setPhase('writing');
    reveal();
    try {
      const done = await streamScript(
        { ...compact({ ...form, draft: fromDraft ? form.draft : '' }), lengthSeconds: Number(form.lengthSeconds) },
        { onDelta: (piece) => setText((t) => t + piece) },
        controller.signal,
      );
      setText(done.generation.kind === 'script' ? done.generation.output.text : '');
      setSavedId(done.generation.id);
      setTruncated(done.truncated);
      setPhase('done');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setPhase('stopped');
      } else {
        setError(err as ApiError);
        setPhase('idle');
      }
    } finally {
      refreshCredits();
    }
  }

  const writing = phase === 'writing';
  const fields = error?.fields ?? {};
  const status =
    phase === 'writing' ? 'Writing' : phase === 'done' ? 'Saved to your Library' : phase === 'stopped' ? 'Stopped. The draft was not saved and the credit was used.' : 'Script';

  return (
    <>
      <PageHead title="Scripts">One spoken sentence per line, with the second each line starts. Read it out loud before you film it.</PageHead>
      <div className="tool">
        <form className="panel stack" onSubmit={submit} noValidate>
          <div className="tabs" role="group" aria-label="Start from" style={{ marginBottom: 0 }}>
            <button type="button" aria-pressed={!fromDraft} onClick={() => setFromDraft(false)}>
              A new idea
            </button>
            <button type="button" aria-pressed={fromDraft} onClick={() => setFromDraft(true)}>
              My own draft
            </button>
          </div>
          {fromDraft && (
            <Field label="Your draft" hint="It is tightened and restructured. Your idea, facts and voice are kept." error={fields.draft}>
              {(p) => <textarea {...p} className="textarea textarea-tall" value={form.draft} onChange={(e) => set('draft')(e.target.value)} maxLength={6000} />}
            </Field>
          )}
          <Field label="What is the video about?" optional={fromDraft} error={fields.idea}>
            {(p) => (
              <textarea {...p} className="textarea" value={form.idea} onChange={(e) => set('idea')(e.target.value)} required maxLength={1000} placeholder="Why stretching before a run slows you down, and the two-minute warm-up to do instead" />
            )}
          </Field>
          <Field label="Opening hook" optional hint="Used word for word. Leave empty to have one written." error={fields.hook}>
            {(p) => <input {...p} className="input" value={form.hook} onChange={(e) => set('hook')(e.target.value)} maxLength={300} />}
          </Field>
          <div className="grid-2">
            <Field label="Structure">
              {(p) => (
                <select {...p} className="select" value={form.framework} onChange={(e) => set('framework')(e.target.value)}>
                  {FRAMEWORK_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FRAMEWORKS[key].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Length">
              {(p) => (
                <select {...p} className="select" value={form.lengthSeconds} onChange={(e) => set('lengthSeconds')(e.target.value)}>
                  {LENGTHS.map((s) => (
                    <option key={s} value={s}>
                      {s} seconds
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <p className="muted small">{FRAMEWORKS[form.framework].guide}</p>
          <details className="more">
            <summary>Audience, tone and ending</summary>
            <div className="stack">
              <Field label="Who is it for?" optional error={fields.audience}>
                {(p) => <input {...p} className="input" value={form.audience} onChange={(e) => set('audience')(e.target.value)} maxLength={200} />}
              </Field>
              <div className="grid-2">
                <Field label="Tone" optional error={fields.tone}>
                  {(p) => <input {...p} className="input" value={form.tone} onChange={(e) => set('tone')(e.target.value)} maxLength={60} />}
                </Field>
                <PlatformSelect value={form.platform} onChange={set('platform')} />
              </div>
              <Field label="Call to action" optional hint="What viewers should do at the end." error={fields.callToAction}>
                {(p) => <input {...p} className="input" value={form.callToAction} onChange={(e) => set('callToAction')(e.target.value)} maxLength={200} />}
              </Field>
            </div>
          </details>
          <ReferenceTranscript summary="Remix the structure of a video" value={form.referenceTranscript} onChange={set('referenceTranscript')} error={fields.referenceTranscript} />
          <ErrorNotice error={error} />
          {writing ? (
            // Distinct keys: without them React reuses one <button> for both states,
            // and the click that stops a script would also submit the form again.
            <button key="stop" type="button" className="btn" onClick={() => abort.current?.abort()}>
              Stop writing
            </button>
          ) : (
            <button key="write" type="submit" className="btn btn-primary" disabled={fromDraft ? form.draft.trim().length < 40 : form.idea.trim().length < 5}>
              {phase === 'idle' && !text ? (fromDraft ? 'Improve my draft' : 'Write script') : 'Write another version'}
            </button>
          )}
        </form>

        <div className="stack" ref={stageRef} data-active={phase !== 'idle' || text !== ''}>
          <ScriptStage
            text={text}
            streaming={writing}
            status={status}
            actions={
              text && !writing ? (
                <>
                  <CopyButton text={text} label="Copy script" />
                  {savedId && (
                    <Link className="btn btn-sm" href={`/app/library/${savedId}`}>
                      Open in Library
                    </Link>
                  )}
                </>
              ) : undefined
            }
            empty={
              <p className="stage-empty">
                <strong>Your script will appear here.</strong>
                It is written line by line while you watch, and saved when it finishes.
              </p>
            }
          />
          {truncated && <div className="notice">This script hit the length limit and may end early. Try a shorter length.</div>}
        </div>
      </div>
    </>
  );
}

export default function ScriptsPage() {
  return (
    <Suspense>
      <ScriptWriter />
    </Suspense>
  );
}
