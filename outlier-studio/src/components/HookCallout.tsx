import type { Analysis } from '@/lib/types';

export function HookCallout({ hook }: { hook: Analysis['hook'] }) {
  return (
    <section className="hook-section">
      <h2>The hook</h2>
      <blockquote className="hook-callout bg-surface-sunken border-link text-text"><p>“{hook.text}”</p></blockquote>
      <p className="hook-explanation text-muted"><strong className="text-text">{hook.pattern}.</strong> {hook.whyItWorks}</p>
    </section>
  );
}
