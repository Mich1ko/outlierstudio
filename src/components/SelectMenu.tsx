'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PlatformLogo, type LogoPlatform } from './PlatformLogo';

export type SelectOption = { value: string; label: string; icon?: LogoPlatform };

export function SelectMenu({
  value,
  options,
  onChange,
  label,
  className = '',
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  function choose(next: number) {
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  }

  return (
    <div className={`select-menu ${className}`} ref={root}>
      <button
        ref={button}
        type="button"
        className="select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            else choose((selected + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
          }
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <span className="select-option-label">{options[selected]?.icon && <PlatformLogo platform={options[selected].icon} />}{options[selected]?.label ?? label}</span><span className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="select-popover" id={`${id}-list`} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => choose(index)}>
              <span className="select-option-label">{option.icon && <PlatformLogo platform={option.icon} />}{option.label}</span>{option.value === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
