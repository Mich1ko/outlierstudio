'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { parseTheme, THEME_KEY, THEME_QUERY, type ResolvedTheme, type Theme } from '@/lib/theme';

type ThemeContextValue = { theme: Theme; resolvedTheme: ResolvedTheme; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Stable server / hydration output. The head script already styles the first paint.
  const [theme, setChoice] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  const apply = useCallback((choice: Theme) => {
    const dark = choice === 'dark' || (choice === 'system' && window.matchMedia(THEME_QUERY).matches);
    document.documentElement.classList.toggle('dark', dark);
    setChoice(choice);
    setResolvedTheme(dark ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((choice: Theme) => {
    apply(choice);
    try { localStorage.setItem(THEME_KEY, choice); } catch { /* Still works for this session. */ }
  }, [apply]);

  useEffect(() => {
    let choice: Theme = 'system';
    try { choice = parseTheme(localStorage.getItem(THEME_KEY)); } catch { /* System is the default. */ }
    apply(choice);
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === THEME_KEY || event.key === null)) {
        apply(parseTheme(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => document.documentElement.setAttribute('data-theme-ready', ''));
    });
    return () => {
      window.removeEventListener('storage', onStorage);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      document.documentElement.removeAttribute('data-theme-ready');
    };
  }, [apply]);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia(THEME_QUERY);
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme, apply]);

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
