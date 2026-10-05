import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from './db/client';
import { appSettings } from './db/schema';

/** Every AI-powered feature. Adding one here gives it a credit cost and usage tracking. */
export const FEATURES = ['hooks', 'script', 'analysis', 'report'] as const;
export type Feature = (typeof FEATURES)[number];

export const PLANS = ['starter', 'pro', 'visionary', 'titan'] as const;
export type Plan = (typeof PLANS)[number];

const credits = z.number().int().min(0).max(1_000_000);

export const LimitsSchema = z.object({
  planMonthlyCredits: z.object({ starter: credits, pro: credits, visionary: credits, titan: credits }),
  requestsPerMinute: z.number().int().min(1).max(600),
  /** How many competitor channels one account may track. */
  trackedChannelsPerUser: z.number().int().min(0).max(1000).default(25),
  creditCosts: z.object({
    hooks: z.number().int().min(0).max(100),
    script: z.number().int().min(0).max(100),
    analysis: z.number().int().min(0).max(100),
    report: z.number().int().min(0).max(100).default(1),
  }),
});
export type Limits = z.infer<typeof LimitsSchema>;

/**
 * Defaults an admin can change at /api/admin/limits.
 * The pro/visionary/titan allowances mirror the reference product's public
 * pricing page. The starter allowance, per-action costs and channel limit are
 * our own choice.
 */
export const DEFAULT_LIMITS: Limits = {
  planMonthlyCredits: { starter: 10, pro: 100, visionary: 250, titan: 1500 },
  requestsPerMinute: 20,
  trackedChannelsPerUser: 25,
  creditCosts: { hooks: 0, script: 1, analysis: 1, report: 1 },
};

const KEY = 'limits';

export async function getLimits(db: Db | Tx): Promise<Limits> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1);
  if (!row) return DEFAULT_LIMITS;
  const parsed = LimitsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_LIMITS;
}

export async function setLimits(db: Db, value: Limits, adminId: string): Promise<Limits> {
  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key: KEY, value, updatedBy: adminId, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: adminId, updatedAt: now } });
  return value;
}
