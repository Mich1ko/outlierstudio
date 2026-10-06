'use client';

import { useId, useState } from 'react';
import { Icon } from './icons';

export function MetricCard({ label, value, detail, hero = false, pending = false, hint }: { label: string; value: string; detail?: string; hero?: boolean; pending?: boolean; hint?: string }) {
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
      <dd className={`metric-value ${hero && !pending ? 'text-score' : pending ? (hero ? 'text-hero-muted' : 'text-muted') : 'text-text'}`} data-pending={pending}>{value}</dd>
      {detail && <dd className={`metric-detail ${hero ? 'text-hero-muted' : 'text-muted'}`}>{detail}</dd>}
    </div>
  );
}
