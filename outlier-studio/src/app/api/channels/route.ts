import { z } from 'zod';
import { json, readJson, route } from '@/server/http';
import { assertUnderLimit, recordHit } from '@/server/ratelimit';
import { listChannels } from '@/server/video/queries';
import { addChannel } from '@/server/video/tracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route('user', async ({ user }) => json(await listChannels(user.id)));

const Input = z.object({ url: z.string().trim().min(2).max(300) });

export const POST = route('user', async ({ req, user }) => {
  const { url } = await readJson(req, Input);
  // Each lookup spends YouTube quota, so cap how fast one account can try links.
  const key = `channel-add:${user.id}`;
  await assertUnderLimit(key, 30, 3600);
  await recordHit(key, 3600);
  const result = await addChannel(user.id, url);
  return json(result, { status: result.alreadyTracked ? 200 : 201 });
});
