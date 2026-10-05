import { z } from 'zod';
import { AppError } from '@/server/errors';
import { json, readJson, route } from '@/server/http';
import { assertUnderLimit, recordHit } from '@/server/ratelimit';
import { addVideoByLink } from '@/server/video/tracking';
import { listVideos, VideoQuery } from '@/server/video/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route('user', async ({ req, user }) => {
  const parsed = VideoQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new AppError(400, 'invalid_input', 'Invalid filter.');
  return json(await listVideos(user.id, parsed.data));
});

const Input = z.object({ url: z.string().trim().min(8).max(500) });

/** Adds one video from its link (YouTube, TikTok or Instagram) and returns its id. */
export const POST = route('user', async ({ req, user }) => {
  const { url } = await readJson(req, Input);
  // Each lookup spends a request with a data provider, so cap how fast one account can try links.
  const key = `video-add:${user.id}`;
  await assertUnderLimit(key, 30, 3600);
  await recordHit(key, 3600);
  return json(await addVideoByLink(user.id, url), { status: 201 });
});
