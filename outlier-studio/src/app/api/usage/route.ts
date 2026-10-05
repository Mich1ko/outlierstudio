import { creditsUsedThisMonth, effectiveLimits } from '@/server/ai/limits';
import { usageSummary } from '@/server/ai/usage';
import { getDb } from '@/server/db/client';
import { json, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('user', async ({ user }) => {
  const db = await getDb();
  const [limits, used, summary] = [await effectiveLimits(db, user.id), await creditsUsedThisMonth(db, user.id), await usageSummary(user.id)];
  return json({
    plan: user.plan,
    credits: { used, limit: limits.monthlyCredits, remaining: Math.max(0, limits.monthlyCredits - used), costPerAction: limits.creditCost },
    requestsPerMinute: limits.requestsPerMinute,
    ...summary,
  });
});
