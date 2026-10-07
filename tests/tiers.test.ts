import { describe, expect, it } from 'vitest';
import { tierFor } from '@/shared/tiers';

describe('tierFor', () => {
  it('places each boundary in the larger tier', () => {
    expect(tierFor(0)).toBe('nano');
    expect(tierFor(9_999)).toBe('nano');
    expect(tierFor(10_000)).toBe('micro');
    expect(tierFor(50_000)).toBe('small');
    expect(tierFor(249_999)).toBe('small');
    expect(tierFor(250_000)).toBe('medium');
    expect(tierFor(1_000_000)).toBe('large');
    expect(tierFor(10_000_000)).toBe('mega');
  });

  it('marks hidden subscriber counts as unknown', () => {
    expect(tierFor(null)).toBe('unknown');
  });
});
