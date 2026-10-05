import { z } from 'zod';
import { notFound } from '@/server/errors';
import { json, route } from '@/server/http';
import { refreshVideoNow } from '@/server/video/tracking';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = route('user', async ({ user, params }) => {
  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) throw notFound();
  await refreshVideoNow(user.id, id.data);
  return json({ ok: true });
});
