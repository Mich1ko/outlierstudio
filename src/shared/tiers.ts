export const TIERS = [
  { key: 'nano', label: 'Nano', min: 0, max: 10_000 },
  { key: 'micro', label: 'Micro', min: 10_000, max: 50_000 },
  { key: 'small', label: 'Small', min: 50_000, max: 250_000 },
  { key: 'medium', label: 'Medium', min: 250_000, max: 1_000_000 },
  { key: 'large', label: 'Large', min: 1_000_000, max: 10_000_000 },
  { key: 'mega', label: 'Mega', min: 10_000_000, max: Infinity },
] as const;

export type TierKey = (typeof TIERS)[number]['key'] | 'unknown';

export function tierFor(subscribers: number | null): TierKey {
  if (subscribers === null) return 'unknown';
  const tier = TIERS.find((t) => subscribers >= t.min && subscribers < t.max);
  return tier?.key ?? 'mega';
}

export const TIER_LABEL: Record<TierKey, string> = {
  ...Object.fromEntries(TIERS.map((t) => [t.key, t.label])),
  unknown: 'Hidden count',
} as Record<TierKey, string>;
