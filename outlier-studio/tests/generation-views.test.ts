import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AnalysisView } from '@/components/GenerationViews';
import type { Analysis } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const base: Analysis = {
  summary: 'A saved analysis',
  hook: { text: 'Opening line', pattern: 'Question', whyItWorks: 'Creates curiosity' },
  format: 'Explainer', structure: [], topics: [], takeaways: [], remixIdeas: [], outlierMultiple: null,
};
const technique = { name: 'Open loop', kind: 'tactic', quote: 'Wait for it', effect: 'Builds anticipation' };

// Cast deliberately: persisted JSON is not runtime-validated by a TS type.
function render(fields: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(AnalysisView, { analysis: { ...base, ...fields } as Analysis }));
}

describe('saved analysis rendering', () => {
  it('renders current techniques without the retired storytellingTactics field', () => {
    const html = render({ techniques: [technique] });
    expect(html).toContain('Open loop');
    expect(html).toContain('Builds anticipation');
    expect(html).not.toContain('Storytelling tactics');
  });

  it('keeps legacy storytelling tactics visible', () => {
    expect(render({ storytellingTactics: ['Legacy open loop'] })).toContain('Legacy open loop');
  });

  it.each([undefined, null, [], 'invalid', { length: 1 }])('tolerates absent or invalid optional lists: %j', (value) => {
    const html = render({ techniques: value, storytellingTactics: value });
    expect(html).toContain('A saved analysis');
    expect(html).not.toContain('Storytelling tactics');
    expect(html).not.toContain('Tactics, tricks and techniques</h2>');
  });

  it('ignores invalid entries while keeping valid techniques', () => {
    expect(render({ techniques: [null, {}, { ...technique, name: {} }, technique] })).toContain('Open loop');
  });

  it('falls back to valid legacy tactics when no usable techniques remain', () => {
    const html = render({ techniques: [null, {}], storytellingTactics: [null, {}, 'Legacy open loop'] });
    expect(html).toContain('Legacy open loop');
  });

  it('prefers current techniques when both formats are present', () => {
    const html = render({ techniques: [technique], storytellingTactics: ['Legacy open loop'] });
    expect(html).toContain('Open loop');
    expect(html).not.toContain('Legacy open loop');
  });
});
