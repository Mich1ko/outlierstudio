'use client';

import { Icon } from './icons';
import { useTheme } from './ThemeProvider';

const options = [
  { value: 'light', label: 'Light', icon: Icon.sun },
  { value: 'dark', label: 'Dark', icon: Icon.moon },
  { value: 'system', label: 'System', icon: Icon.monitor },
] as const;

export function ThemeToggle({ compact: _compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const current = options.find((option) => option.value === theme) ?? options[2];
  const ThemeIcon = resolvedTheme === 'dark' ? Icon.moon : Icon.sun;
  const next = theme === 'system' ? (resolvedTheme === 'dark' ? 'light' : 'dark') : theme === 'light' ? 'dark' : 'system';
  return (
    <button type="button" className="theme-cycle" aria-label={`Theme: ${current.label}. Switch to ${next}.`} title={`Theme: ${current.label}`} onClick={() => setTheme(next)}>
      <span className="theme-icon-stack" aria-hidden="true"><ThemeIcon /></span><span className="sr-only">Theme: {current.label}</span>
    </button>
  );
}
