import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { parseTheme, themeInitScript, THEME_KEY } from '@/lib/theme';

describe('theme before first paint', () => {
  it.each([
    ['dark', false, true],
    ['light', true, false],
    ['system', true, true],
    ['system', false, false],
    [null, true, true],
    ['invalid', false, false],
  ])('resolves stored %s with system dark=%s', (stored, systemDark, expectedDark) => {
    let dark: boolean | undefined;
    runInNewContext(themeInitScript, {
      localStorage: { getItem: (key: string) => { expect(key).toBe(THEME_KEY); return stored; } },
      window: { matchMedia: () => ({ matches: systemDark }) },
      document: { documentElement: { classList: { toggle: (name: string, value: boolean) => { expect(name).toBe('dark'); dark = value; } } } },
    });
    expect(dark).toBe(expectedDark);
  });

  it('falls back to the system when storage is blocked', () => {
    let dark: boolean | undefined;
    runInNewContext(themeInitScript, {
      localStorage: { getItem: () => { throw new Error('Storage blocked'); } },
      window: { matchMedia: () => ({ matches: true }) },
      document: { documentElement: { classList: { toggle: (_: string, value: boolean) => { dark = value; } } } },
    });
    expect(dark).toBe(true);
  });

  it('treats deleted and malformed preferences as System', () => {
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme('sepia')).toBe('system');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
  });
});
