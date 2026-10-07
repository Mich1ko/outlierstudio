import { z } from 'zod';
import { json, route } from '@/server/http';
import { assertUnderLimit, recordHit } from '@/server/ratelimit';
import { youtubeConfigured } from '@/server/video/youtube';
import { discoverYouTubeChannels } from '@/server/video/discover';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Query = z.object({
  q: z.string().trim().min(2).max(100),
  tier: z.enum(['all', 'nano', 'micro', 'small', 'medium', 'large', 'mega', 'unknown']).default('all'),
});

export const GET = route('user', async ({ req, user }) => {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new AppError(400, 'invalid_input', 'Enter a niche of at least two characters.');
  if (!youtubeConfigured()) {
    throw new AppError(503, 'video_data_not_configured', 'Niche search needs a YouTube API key on the server.');
  }
  // Each uncached search spends 101 units of the daily YouTube quota.
  const key = `discover:${user.id}`;
  await assertUnderLimit(key, 30, 3600);
  await recordHit(key, 3600);

  const all = await discoverYouTubeChannels(parsed.data.q);
  const items = parsed.data.tier === 'all' ? all : all.filter((c) => c.tier === parsed.data.tier);
  return json({ items, query: parsed.data.q, platform: 'youtube' });
});
