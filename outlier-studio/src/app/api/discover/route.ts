import { z } from 'zod';
import { json, route } from '@/server/http';
import { assertUnderLimit, recordHit } from '@/server/ratelimit';
import { youtubeConfigured } from '@/server/video/youtube';
import { apifyConfigured } from '@/server/video/apify';
import { discoverInstagramChannels, discoverYouTubeChannels } from '@/server/video/discover';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const Query = z.object({
  q: z.string().trim().min(2).max(100),
  tier: z.enum(['all', 'nano', 'micro', 'small', 'medium', 'large', 'mega', 'unknown']).default('all'),
  platform: z.enum(['youtube', 'instagram']).default('youtube'),
});

export const GET = route('user', async ({ req, user }) => {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new AppError(400, 'invalid_input', 'Enter a niche of at least two characters.');
  if (parsed.data.platform === 'youtube' && !youtubeConfigured()) {
    throw new AppError(503, 'video_data_not_configured', 'Niche search needs a YouTube API key on the server.');
  }
  if (parsed.data.platform === 'instagram' && !apifyConfigured()) {
    throw new AppError(503, 'video_data_not_configured', 'Instagram discovery needs an Apify token on the server.');
  }
  // Each uncached YouTube search spends 101 quota units; Instagram searches spend Apify credit.
  const key = `discover:${parsed.data.platform}:${user.id}`;
  await assertUnderLimit(key, 30, 3600);
  await recordHit(key, 3600);

  const all = parsed.data.platform === 'instagram'
    ? await discoverInstagramChannels(parsed.data.q)
    : await discoverYouTubeChannels(parsed.data.q);
  const filtered = parsed.data.tier === 'all' ? all : all.filter((c) => c.tier === parsed.data.tier);
  const items = filtered.map((item) => ({ ...item, platform: parsed.data.platform }));
  return json({ items, query: parsed.data.q, platform: parsed.data.platform });
});
