import { z } from 'zod';
import { notFound } from '@/server/errors';
import { json, readJson, route } from '@/server/http';
import { removeChannel, setOwnChannel } from '@/server/video/tracking';

export const runtime = 'nodejs';

export const DELETE = route('user', async ({ user, params }) => {
  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) throw notFound();
  await removeChannel(user.id, id.data);
  return json({ ok: true });
});

const Patch = z.object({ isOwn: z.boolean() });

/** Marks a tracked channel as the user's own (or back to a competitor). */
export const PUT = route('user', async ({ req, user, params }) => {
  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) throw notFound();
  const { isOwn } = await readJson(req, Patch);
  await setOwnChannel(user.id, id.data, isOwn);
  return json({ ok: true });
});
