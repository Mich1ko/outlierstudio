import { z } from 'zod';
import { notFound } from '@/server/errors';
import { json, route } from '@/server/http';
import { getVideoDetail } from '@/server/video/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('user', async ({ user, params }) => {
  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) throw notFound();
  return json(await getVideoDetail(user.id, id.data));
});
