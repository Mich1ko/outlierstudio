import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { aiRequests } from '../db/schema';
import { AppError } from '../errors';
import { getLimits, type Feature } from '../settings';
import { startRequest } from './usage';

/**
 * Checks the per-minute rate limit, then writes the pending request row. Runs
 * under a per-user lock so a burst of parallel requests is counted correctly.
 */
export async function reserve(userId: string, feature: Feature, model: string): Promise<string> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const { requestsPerMinute } = await getLimits(tx);
    const [recent] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(aiRequests)
      .where(and(eq(aiRequests.userId, userId), gt(aiRequests.createdAt, new Date(Date.now() - 60_000))));
    if ((recent?.count ?? 0) >= requestsPerMinute) {
      throw new AppError(429, 'rate_limited', 'You are sending requests too quickly. Please wait a minute.', {
        retryAfterSeconds: 60,
      });
    }
    return startRequest(tx, { userId, feature, model, credits: 0 });
  });
}
