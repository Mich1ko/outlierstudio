import { z } from 'zod';
import { notFound } from '@/server/errors';
import { deleteGeneration, getGeneration } from '@/server/generations';
import { json, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = (params: Record<string, string>) => {
  const parsed = z.string().uuid().safeParse(params.id);
  if (!parsed.success) throw notFound();
  return parsed.data;
};

export const GET = route('user', async ({ user, params }) => json({ generation: await getGeneration(user.id, id(params)) }));

export const DELETE = route('user', async ({ user, params }) => {
  await deleteGeneration(user.id, id(params));
  return json({ ok: true });
});
