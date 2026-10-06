'use client';

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Icon } from './icons';
import { useTheme } from './ThemeProvider';

const options = [
  { value: 'light', label: 'Light', icon: Icon.sun },
  { value: 'dark', label: 'Dark', icon: Icon.moon },
  { value: 'system', label: 'System', icon: Icon.monitor },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((option) => option.value === theme);
  function onKeyDown(event: KeyboardEvent) {
    let next = selected;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (selected + 1) % options.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (selected + options.length - 1) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    setTheme(options[next]!.value);
    buttons.current[next]?.focus();
  }
  return (
    <div className="theme-toggle" data-compact={compact} role="radiogroup" aria-label="Appearance" onKeyDown={onKeyDown} style={{ '--theme-index': selected } as CSSProperties}>
      <span className="theme-thumb" aria-hidden="true" />
      {options.map(({ value, label, icon: ThemeIcon }, index) => (
        <button key={value} ref={(element) => { buttons.current[index] = element; }} type="button" role="radio" aria-checked={theme === value} aria-label={`Theme: ${value}`} title={label} tabIndex={theme === value ? 0 : -1} onClick={() => setTheme(value)}>
          <ThemeIcon /><span className={compact ? 'sr-only' : undefined}>{label}</span>
        </button>
      ))}
    </div>
  );
}
