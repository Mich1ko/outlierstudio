import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import { rateLimitHits } from './db/schema';
import { AppError } from './errors';

/**
 * Database-backed sliding window, so limits hold across server instances.
 * Used for login and signup. AI request limits are enforced in ai/limits.ts.
 */
export async function assertUnderLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const db = await getDb();
  const since = new Date(Date.now() - windowSeconds * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), gt(rateLimitHits.createdAt, since)));
  if ((row?.count ?? 0) >= limit) {
    throw new AppError(429, 'rate_limited', 'Too many attempts. Please wait and try again.', {
      retryAfterSeconds: windowSeconds,
    });
  }
}

export async function recordHit(key: string, windowSeconds: number): Promise<void> {
  const db = await getDb();
  await db.insert(rateLimitHits).values({ key });
  const cutoff = new Date(Date.now() - windowSeconds * 1000);
  await db.delete(rateLimitHits).where(and(eq(rateLimitHits.key, key), lt(rateLimitHits.createdAt, cutoff)));
}

/**
 * Best-effort client address. Only meaningful behind a proxy that sets
 * X-Forwarded-For itself (Vercel, Fly, nginx with real_ip). See README.
 */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
