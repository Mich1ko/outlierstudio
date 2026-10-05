import { and, desc, eq, gte, ilike, sql } from 'drizzle-orm';
import { monthStart } from '@/server/ai/usage';
import { getDb } from '@/server/db/client';
import { aiRequests, userLimits, users } from '@/server/db/schema';
import { json, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Up to 50 accounts, newest first, optionally filtered by email. */
export const GET = route('admin', async ({ req }) => {
  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100) ?? '';
  const db = await getDb();
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const items = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      plan: users.plan,
      createdAt: users.createdAt,
      monthlyCreditsOverride: userLimits.monthlyCredits,
      creditsUsedThisMonth: sql<number>`coalesce(sum(${aiRequests.creditsCharged}), 0)::int`,
    })
    .from(users)
    .leftJoin(userLimits, eq(userLimits.userId, users.id))
    .leftJoin(aiRequests, and(eq(aiRequests.userId, users.id), gte(aiRequests.createdAt, monthStart())))
    .where(q ? ilike(users.email, `%${escaped}%`) : undefined)
    .groupBy(users.id, userLimits.monthlyCredits)
    .orderBy(desc(users.createdAt))
    .limit(50);
  return json({ items });
});
