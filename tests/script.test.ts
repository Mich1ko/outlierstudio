import { describe, expect, it } from 'vitest';
import { clock, parseScript } from '@/shared/script';

describe('script timing', () => {
  it('splits sections and times each line at 2.5 words per second', () => {
    const s = parseScript('HOOK\nOne two three four five.\n\nBODY\nSix seven eight nine ten.\nEleven twelve.\n\nCALL TO ACTION\nFollow.');
    expect(s.sections.map((x) => x.key)).toEqual(['hook', 'body', 'cta']);
    expect(s.sections[1]!.lines.map((l) => l.startSeconds)).toEqual([2, 4]);
    expect(s.sections[2]!.lines[0]!.startSeconds).toBeCloseTo(4.8);
    expect(s.words).toBe(13);
    expect(s.seconds).toBeCloseTo(5.2);
  });

  it('copes with partial text, markdown-style headings and missing headings', () => {
    expect(parseScript('').sections).toEqual([]);
    expect(parseScript('HOOK\nHalf a li').sections[0]!.lines[0]!.text).toBe('Half a li');
    expect(parseScript('**Hook**\nLine.\n## Body:\nMore.').sections.map((x) => x.key)).toEqual(['hook', 'body']);
    expect(parseScript('Just a line with no heading.').sections[0]!.key).toBe('body');
  });

  it('formats clock times', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(7.9)).toBe('0:07');
    expect(clock(75)).toBe('1:15');
  });
});
