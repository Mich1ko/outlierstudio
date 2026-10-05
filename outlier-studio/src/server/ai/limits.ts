import { and, eq, gt, gte, sql } from 'drizzle-orm';
import { getDb, type Db, type Tx } from '../db/client';
import { aiRequests, userLimits, users } from '../db/schema';
import { AppError, unauthorized } from '../errors';
import { getLimits, type Feature, type Plan } from '../settings';
import { monthStart, startRequest } from './usage';

export type EffectiveLimits = { monthlyCredits: number; requestsPerMinute: number; creditCost: Record<Feature, number> };

export async function effectiveLimits(db: Db | Tx, userId: string): Promise<EffectiveLimits> {
  const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw unauthorized();
  const limits = await getLimits(db);
  const [override] = await db.select().from(userLimits).where(eq(userLimits.userId, userId)).limit(1);
  return {
    monthlyCredits: override?.monthlyCredits ?? limits.planMonthlyCredits[user.plan as Plan],
    requestsPerMinute: override?.requestsPerMinute ?? limits.requestsPerMinute,
    creditCost: limits.creditCosts,
  };
}

export async function creditsUsedThisMonth(db: Db | Tx, userId: string): Promise<number> {
  const [row] = await db
    .select({ used: sql<number>`coalesce(sum(${aiRequests.creditsCharged}), 0)::int` })
    .from(aiRequests)
    .where(and(eq(aiRequests.userId, userId), gte(aiRequests.createdAt, monthStart())));
  return row?.used ?? 0;
}

/**
 * Checks the per-minute rate limit and the monthly credit quota, then reserves
 * the credits by writing the pending request row. Runs under a per-user lock
 * so parallel requests cannot both spend the last credit.
 */
export async function reserve(userId: string, feature: Feature, model: string): Promise<string> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const limits = await effectiveLimits(tx, userId);

    const [recent] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(aiRequests)
      .where(and(eq(aiRequests.userId, userId), gt(aiRequests.createdAt, new Date(Date.now() - 60_000))));
    if ((recent?.count ?? 0) >= limits.requestsPerMinute) {
      throw new AppError(429, 'rate_limited', 'You are sending requests too quickly. Please wait a minute.', {
        retryAfterSeconds: 60,
      });
    }

    const cost = limits.creditCost[feature];
    if (cost > 0) {
      const used = await creditsUsedThisMonth(tx, userId);
      if (used + cost > limits.monthlyCredits) {
        throw new AppError(402, 'quota_exceeded', 'You have used all of your credits for this month.', {
          details: { used, limit: limits.monthlyCredits },
        });
      }
    }
    return startRequest(tx, { userId, feature, model, credits: cost });
  });
}
