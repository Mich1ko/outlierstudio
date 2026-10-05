'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorNotice, PageHead, Skeleton } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { num, usd, utcDay, when } from '@/lib/format';
import type { Usage } from '@/lib/types';
import { FEATURE_LABELS } from '@/shared/catalog';

const dash = (n: number | null) => (n === null ? 'Not reported' : num(n));

export default function UsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    api<Usage>('/api/usage').then(setUsage).catch(setError);
  }, []);

  if (error) return <ErrorNotice error={error} />;
  if (!usage) return <Skeleton lines={6} />;

  const { month } = usage;

  return (
    <div className="stack-lg" style={{ maxWidth: 1000 }}>
      <PageHead title="Usage">Groq requests and estimated cost since {utcDay(usage.periodStart)}. No limits apart from {usage.requestsPerMinute} requests per minute.</PageHead>

      <section className="stack">
        <h2>This month</h2>
        <div className="tiles">
          <div className="tile">
            <b>{num(month.requests)}</b>
            <span>Requests{month.failed > 0 ? `, ${month.failed} failed` : ''}</span>
          </div>
          <div className="tile">
            <b>{num(month.totalTokens)}</b>
            <span>Tokens, as reported by Groq</span>
          </div>
          <div className="tile">
            <b>{usd(month.estimatedCostUsd)}</b>
            <span>Estimated AI cost</span>
          </div>
          <div className="tile">
            <b>{month.requests > 0 ? `${(month.avgLatencyMs / 1000).toFixed(1)} s` : 'None yet'}</b>
            <span>Average response time</span>
          </div>
        </div>
        <p className="muted small">
          {usage.costNote}
          {month.unpricedRequests > 0 && ` ${month.unpricedRequests} request${month.unpricedRequests === 1 ? ' is' : 's are'} not included because no price or token count was available.`}
        </p>
      </section>

      {usage.byFeature.length > 0 && (
        <section className="stack">
          <h2>By tool</h2>
          <div className="panel panel-flush table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th className="num">Requests</th>
                  <th className="num">Tokens in</th>
                  <th className="num">Tokens out</th>
                  <th className="num">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.byFeature.map((f) => (
                  <tr key={f.feature}>
                    <td>{FEATURE_LABELS[f.feature] ?? f.feature}</td>
                    <td className="num">{num(f.requests)}</td>
                    <td className="num">{num(f.inputTokens)}</td>
                    <td className="num">{num(f.outputTokens)}</td>
                    <td className="num">{usd(f.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="stack">
        <h2>Recent requests</h2>
        {usage.recent.length === 0 ? (
          <p className="muted">No requests yet. They are listed here as soon as you use a tool.</p>
        ) : (
          <div className="panel panel-flush table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Tool</th>
                  <th>Result</th>
                  <th>Model</th>
                  <th className="num">Tokens</th>
                  <th className="num">Est. cost</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((r) => (
                  <tr key={r.id}>
                    <td>{when(r.createdAt)}</td>
                    <td>{FEATURE_LABELS[r.feature] ?? r.feature}</td>
                    <td>
                      {r.status === 'succeeded' ? (
                        <span className="tag tag-ok">Done</span>
                      ) : r.errorCode === 'client_aborted' ? (
                        <span className="tag">Stopped</span>
                      ) : r.status === 'failed' ? (
                        <span className="tag tag-bad" title={r.errorCode ?? undefined}>
                          Failed
                        </span>
                      ) : (
                        <span className="tag">Running</span>
                      )}
                    </td>
                    <td>{r.model}</td>
                    <td className="num">{dash(r.totalTokens)}</td>
                    <td className="num">{r.estimatedCostUsd === null ? 'Not priced' : usd(r.estimatedCostUsd)}</td>
                    <td>{r.generationId ? <Link href={`/app/library/${r.generationId}`}>Open</Link> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
