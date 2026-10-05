import { WORDS_PER_SECOND } from './catalog';

export type ScriptSectionKey = 'hook' | 'body' | 'cta';
export type ScriptLine = { text: string; words: number; startSeconds: number };
export type ScriptSection = { key: ScriptSectionKey; label: string; lines: ScriptLine[] };
export type ParsedScript = { sections: ScriptSection[]; words: number; seconds: number };

const HEADINGS: [RegExp, ScriptSectionKey, string][] = [
  [/^\W*hook\W*$/i, 'hook', 'Hook'],
  [/^\W*body\W*$/i, 'body', 'Body'],
  [/^\W*call to action\W*$/i, 'cta', 'Call to action'],
];

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Splits a generated script into its sections and gives every line the time
 * at which it would be spoken, at 2.5 words per second. Works on partial text,
 * so it can render while the script is still streaming. Text before the first
 * heading is treated as body.
 */
export function parseScript(text: string): ParsedScript {
  const sections: ScriptSection[] = [];
  let current: ScriptSection | undefined;
  let words = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = HEADINGS.find(([re]) => re.test(line));
    if (heading) {
      current = { key: heading[1], label: heading[2], lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { key: 'body', label: 'Body', lines: [] };
      sections.push(current);
    }
    const n = countWords(line);
    current.lines.push({ text: line, words: n, startSeconds: words / WORDS_PER_SECOND });
    words += n;
  }
  return { sections, words, seconds: words / WORDS_PER_SECOND };
}

/** 0:07 style clock for timing marks. */
export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
