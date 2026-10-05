import { z } from 'zod';
import { AppError } from '@/server/errors';
import { listGenerations } from '@/server/generations';
import { json, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  kind: z.enum(['hooks', 'script', 'analysis', 'report']).optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = route('user', async ({ req, user }) => {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new AppError(400, 'invalid_input', 'Invalid query parameters.');
  const items = await listGenerations(user.id, parsed.data);
  const last = items[items.length - 1];
  return json({ items, nextBefore: items.length === parsed.data.limit && last ? last.createdAt.toISOString() : null });
});
