'use client';

import { PLATFORMS, PLATFORM_LABELS } from '@/shared/catalog';
import { Field } from './ui';

export function PlatformSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Platform" optional>
      {(p) => (
        <select {...p} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Any</option>
          {PLATFORMS.map((key) => (
            <option key={key} value={key}>
              {PLATFORM_LABELS[key]}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
