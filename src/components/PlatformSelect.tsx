'use client';

import { PLATFORMS, PLATFORM_LABELS } from '@/shared/catalog';
import { Field } from './ui';
import { SelectMenu } from './SelectMenu';

export function PlatformSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Platform" optional>
      {(p) => <div id={p.id}><SelectMenu label="Platform" value={value} onChange={onChange} options={[{ value: '', label: 'Any' }, ...PLATFORMS.map((key) => ({ value: key, label: PLATFORM_LABELS[key], icon: key }))]} /></div>}
    </Field>
  );
}
