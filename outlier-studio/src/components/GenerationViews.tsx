'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { compact } from '@/lib/format';
import type { Analysis, Hook, Report } from '@/lib/types';
import { HOOK_PATTERN_LABELS } from '@/shared/catalog';
import { CopyButton } from './ui';

const scriptLink = (params: Record<string, string>) => `/app/scripts?${new URLSearchParams(params)}`;

export function HooksList({ hooks, topic }: { hooks: Hook[]; topic: string }) {
  return (
    <ol className="panel panel-flush hook-list">
      {hooks.map((hook, i) => (
        <li key={i} className="hook-item">
          <p className="hook-text">{hook.text}</p>
          <div className="hook-meta">
            <span className="tag">{HOOK_PATTERN_LABELS[hook.pattern] ?? hook.pattern}</span>
            <span className="muted small">{hook.why}</span>
          </div>
          <div className="row">
            <CopyButton text={hook.text} />
            <Link className="btn btn-sm" href={scriptLink({ hook: hook.text, idea: topic })}>
              Write a script with this hook
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** sessionStorage key used to carry a long transcript from Analyze to Scripts. */
export const REMIX_KEY = 'remix-transcript';

export function AnalysisView({ analysis, transcript, title, hideMultiple }: { analysis: Analysis; transcript?: string; title?: string; hideMultiple?: boolean }) {
  const router = useRouter();

  /** Carries the transcript to another tool; returns the query flag to add when it worked. */
  function carry(): Record<string, string> {
    if (!transcript) return {};
    try {
      sessionStorage.setItem(REMIX_KEY, transcript);
      return { remix: '1' };
    } catch {
      return {};
    }
  }

  function remix(idea: { title: string; angle: string }) {
    let carried = false;
    if (transcript) {
      try {
        sessionStorage.setItem(REMIX_KEY, transcript);
        carried = true;
      } catch {
        /* storage unavailable: the script is written without the reference */
      }
    }
    router.push(scriptLink({ idea: `${idea.title}. ${idea.angle}`, ...(carried ? { remix: '1' } : {}) }));
  }

  return (
    <div className="panel analysis">
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => router.push(scriptLink({ idea: title ?? analysis.summary, ...carry() }))}>
          Write a script like this
        </button>
        <button type="button" className="btn" onClick={() => router.push(`/app/hooks?${new URLSearchParams({ topic: title ?? analysis.summary, ...carry() })}`)}>
          Write hooks like this
        </button>
      </div>
      <section>
        {analysis.outlierMultiple !== null && !hideMultiple && (
          <p className="multiple">
            <b>{analysis.outlierMultiple}x</b>
            <span className="muted">this channel&apos;s median views</span>
          </p>
        )}
        <p>{analysis.summary}</p>
        <div className="row">
          <span className="tag">{analysis.format}</span>
          {analysis.topics.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2>The hook</h2>
        <p className="quote">{analysis.hook.text}</p>
        <p>
          <strong>{analysis.hook.pattern}.</strong> {analysis.hook.whyItWorks}
        </p>
      </section>

      {analysis.structure.length > 0 && (
        <section>
          <h2>How it is built</h2>
          <ol className="beats">
            {analysis.structure.map((s, i) => (
              <li key={i}>
                <div>
                  <strong>{s.section}</strong>
                  <p>{s.summary}</p>
                  <p className="muted small">{s.purpose}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {analysis.storytellingTactics.length > 0 && (
        <section>
          <h2>Storytelling tactics</h2>
          <ul className="bullets">
            {analysis.storytellingTactics.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {analysis.takeaways.length > 0 && (
        <section>
          <h2>What to take from it</h2>
          <ul className="bullets">
            {analysis.takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {analysis.remixIdeas.length > 0 && (
        <section>
          <h2>Remix it</h2>
          <p className="muted small">Each idea keeps this video&apos;s structure and changes the subject.</p>
          <div>
            {analysis.remixIdeas.map((idea, i) => (
              <div key={i} className="remix">
                <strong>{idea.title}</strong>
                <p>{idea.angle}</p>
                <div>
                  <button type="button" className="btn btn-sm" onClick={() => remix(idea)}>
                    Write this script
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="muted small">Based on the transcript only. Visuals, editing and audio are not analysed.</p>
    </div>
  );
}

export function ReportView({ report }: { report: Report }) {
  const f = report.facts;
  return (
    <div className="stack-lg">
      <div className="tiles">
        <div className="tile">
          <b>{f.subscribers === null ? 'Hidden' : compact(f.subscribers)}</b>
          <span>Subscribers</span>
        </div>
        <div className="tile">
          <b>{f.uploadsInLast30Days}</b>
          <span>Uploads in the last 30 days</span>
        </div>
        <div className="tile">
          <b>{f.typicalShortViews === null ? 'None' : compact(f.typicalShortViews)}</b>
          <span>Typical views on a Short</span>
        </div>
        <div className="tile">
          <b>{f.videosConsidered}</b>
          <span>Videos this report looked at</span>
        </div>
      </div>
      <div className="panel analysis">
        <section>
          <p>{report.summary}</p>
        </section>
        <section>
          <h2>What is working</h2>
          <ol className="beats">
            {report.whatIsWorking.map((w, i) => (
              <li key={i}>
                <div>
                  <strong>{w.pattern}</strong>
                  <p className="muted">{w.evidence}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        {report.whatIsNot.length > 0 && (
          <section>
            <h2>What is not</h2>
            <ul className="bullets">
              {report.whatIsNot.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}
        {report.topics.length > 0 && (
          <section>
            <h2>Topics</h2>
            <div>
              {report.topics.map((t, i) => (
                <div key={i} className="remix">
                  <strong>{t.topic}</strong>
                  <p className="muted">{t.note}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {report.titlePatterns.length > 0 && (
          <section>
            <h2>Title patterns</h2>
            <ul className="bullets">
              {report.titlePatterns.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h2>{report.isOwn ? 'What to do next' : 'What to try on your channel'}</h2>
          <ul className="bullets">
            {report.recommendations.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
        <p className="muted small">Written from titles, lengths and view counts at the time of the report, plus the hooks from your own breakdowns of this channel.</p>
      </div>
    </div>
  );
}
