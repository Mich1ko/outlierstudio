'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { compact, num, when } from '@/lib/format';
import type { VideoCheck } from '@/lib/types';

const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

/** Round axis steps: 1, 2 or 5 times a power of ten. */
function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
}

/**
 * Views at each check, as one line. Hover, touch or use the arrow keys to read
 * a point; the same numbers are in the table under the chart.
 */
export function ViewsChart({ history }: { history: VideoCheck[] }) {
  const points = useMemo(
    () => history.filter((h): h is VideoCheck & { viewCount: number } => h.viewCount !== null).map((h) => ({ t: new Date(h.takenAt).getTime(), v: h.viewCount, iso: h.takenAt })),
    [history],
  );
  const wrap = useRef<HTMLDivElement>(null);
  // Unknown until measured, so the first paint never draws wider than the screen.
  const [measured, setWidth] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (points.length < 2) return null;
  if (measured === null) return <div className="chart" ref={wrap} />;
  const width = measured;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const minV = Math.min(...points.map((p) => p.v));
  const maxV = Math.max(...points.map((p) => p.v));
  const step = niceStep(Math.max(1, maxV - minV), 3);
  const y0 = Math.floor(minV / step) * step;
  const y1 = Math.max(y0 + step, Math.ceil(maxV / step) * step);
  const ticks: number[] = [];
  for (let t = y0; t <= y1 + step / 2; t += step) ticks.push(t);

  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (last.t === first.t ? 0 : ((t - first.t) / (last.t - first.t)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - y0) / (y1 - y0)) * innerH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(last.t).toFixed(1)},${PAD.top + innerH} L${x(first.t).toFixed(1)},${PAD.top + innerH} Z`;

  const nearest = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i]!.t) - px) < Math.abs(x(points[best]!.t) - px)) best = i;
    return best;
  };
  const onPointer = (e: PointerEvent) => setActive(nearest(e.clientX));
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const current = active ?? points.length - 1;
    setActive(e.key === 'Home' ? 0 : e.key === 'End' ? points.length - 1 : Math.min(points.length - 1, Math.max(0, current + (e.key === 'ArrowLeft' ? -1 : 1))));
  };

  const shown = active === null ? null : points[active]!;
  const tipLeft = shown ? Math.min(Math.max(x(shown.t), 70), width - 70) : 0;

  return (
    <div className="chart" ref={wrap}>
      <svg
        width={width}
        height={H}
        role="img"
        tabIndex={0}
        aria-label={`Views at each check, from ${num(first.v)} on ${when(first.iso)} to ${num(last.v)} on ${when(last.iso)}. Use the left and right arrow keys to read each check.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart-tick" x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {compact(t)}
            </text>
          </g>
        ))}
        <text className="chart-tick" x={PAD.left} y={H - 8}>
          {when(first.iso)}
        </text>
        <text className="chart-tick" x={width - PAD.right} y={H - 8} textAnchor="end">
          {when(last.iso)}
        </text>
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
        {shown && <line className="chart-cross" x1={x(shown.t)} x2={x(shown.t)} y1={PAD.top} y2={PAD.top + innerH} />}
        <circle className="chart-dot" cx={x((shown ?? last).t)} cy={y((shown ?? last).v)} r={5} />
      </svg>
      {shown && (
        <div className="chart-tip" style={{ left: tipLeft, top: Math.max(0, y(shown.v) - 58) }} role="status">
          <strong>{num(shown.v)} views</strong>
          <span>{when(shown.iso)}</span>
        </div>
      )}
    </div>
  );
}
