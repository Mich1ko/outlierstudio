const int = new Intl.NumberFormat('en-US');

export const num = (n: number) => int.format(n);

export function usd(n: number): string {
  if (n === 0) return '$0.00';
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** For dates that are defined in UTC, such as the start of the credit month. */
export function utcDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
/** 1.2K, 3.4M. For counts where the exact figure does not matter. */
export const compact = (n: number) => compactFmt.format(n);

const relFmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
/** "3 hours ago", "yesterday". */
export function ago(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relFmt.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relFmt.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relFmt.format(Math.round(seconds / 86400), 'day');
  if (abs < 86400 * 365) return relFmt.format(Math.round(seconds / (86400 * 30)), 'month');
  return relFmt.format(Math.round(seconds / (86400 * 365)), 'year');
}

/** 0:45, 12:03, 1:02:03 */
export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** +1,500 / -20 / 0 */
export const signed = (n: number) => (n > 0 ? `+${num(n)}` : num(n));

export const KIND_LABEL = { hooks: 'Hooks', script: 'Script', analysis: 'Analysis', report: 'Report' } as const;
