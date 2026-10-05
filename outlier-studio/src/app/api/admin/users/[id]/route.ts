import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { creditsUsedThisMonth, effectiveLimits } from '@/server/ai/limits';
import { getDb } from '@/server/db/client';
import { userLimits, users } from '@/server/db/schema';
import { notFound } from '@/server/errors';
import { json, readJson, route } from '@/server/http';
import { PLANS } from '@/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** null clears an override and returns the user to their plan's default. */
const Input = z.object({
  plan: z.enum(PLANS).optional(),
  monthlyCredits: z.number().int().min(0).max(1_000_000).nullable().optional(),
  requestsPerMinute: z.number().int().min(1).max(600).nullable().optional(),
});

async function view(id: string) {
  const db = await getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, plan: users.plan })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!user) throw notFound();
  const limits = await effectiveLimits(db, id);
  return { user, limits, creditsUsedThisMonth: await creditsUsedThisMonth(db, id) };
}

const userId = (params: Record<string, string>) => {
  const parsed = z.string().uuid().safeParse(params.id);
  if (!parsed.success) throw notFound();
  return parsed.data;
};

export const GET = route('admin', async ({ params }) => json(await view(userId(params))));

export const PUT = route('admin', async ({ req, params }) => {
  const id = userId(params);
  const input = await readJson(req, Input);
  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!exists) throw notFound();

  if (input.plan) await db.update(users).set({ plan: input.plan }).where(eq(users.id, id));
  if (input.monthlyCredits !== undefined || input.requestsPerMinute !== undefined) {
    const set = {
      ...(input.monthlyCredits !== undefined ? { monthlyCredits: input.monthlyCredits } : {}),
      ...(input.requestsPerMinute !== undefined ? { requestsPerMinute: input.requestsPerMinute } : {}),
      updatedAt: new Date(),
    };
    await db.insert(userLimits).values({ userId: id, ...set }).onConflictDoUpdate({ target: userLimits.userId, set });
  }
  return json(await view(id));
});
