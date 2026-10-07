'use client';

import { useEffect, useId, useState } from 'react';
import { Icon } from './icons';

function CountUp({ value }: { value: string }) {
  const match = value.replaceAll(',', '').match(/^([+-]?)(\d+(?:\.\d+)?)(.*)$/);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!match || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const target = Number(match[2]);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - progress) ** 3;
      const current = target * eased;
      const number = match[2]!.includes('.') ? current.toFixed(1) : Math.round(current).toLocaleString('en-US');
      setShown(`${match[1]}${number}${match[3]}`);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

export function MetricCard({ label, value, detail, hero = false, pending = false, hint, progress }: { label: string; value: string; detail?: string; hero?: boolean; pending?: boolean; hint?: string; progress?: number }) {
  const id = useId();
  const [tipOpen, setTipOpen] = useState(false);
  return (
    <div className={`metric-card ${hero ? 'metric-hero bg-hero-surface text-hero-text' : 'bg-surface text-text'} border-border`}>
      <dt className={`metric-label ${hero ? 'text-hero-muted' : 'text-muted'}`}>
        {label}{hero && <Icon.feed />}
        {hint && <span className="metric-help" onMouseEnter={() => setTipOpen(true)} onMouseLeave={() => setTipOpen(false)}>
          <button type="button" className="info-button" aria-label={`About ${label.toLowerCase()}`} aria-describedby={id} aria-expanded={tipOpen} onFocus={() => setTipOpen(true)} onBlur={() => setTipOpen(false)} onClick={() => setTipOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setTipOpen(false); }}><Icon.info /></button>
          <span id={id} role="tooltip" className="metric-tooltip" hidden={!tipOpen}>{hint}</span>
        </span>}
      </dt>
      <dd className={`metric-value ${hero && !pending ? 'text-score' : pending ? (hero ? 'text-hero-muted' : 'text-muted') : 'text-text'}`} data-pending={pending}><CountUp value={value} /></dd>
      {detail && <dd className={`metric-detail ${hero ? 'text-hero-muted' : 'text-muted'}`}>{detail}</dd>}
      {hero && progress !== undefined && <dd className="comparison-bar" aria-label={`${Math.round(progress)} percent of comparison scale`}><span style={{ width: `${Math.min(100, Math.max(3, progress))}%` }} /></dd>}
    </div>
  );
}
