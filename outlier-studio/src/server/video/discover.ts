import 'server-only';
import { tierFor, type TierKey } from '@/shared/tiers';
import { httpUrl, int, runActor, str } from './apify';
import { call, toChannel, type ChannelInfo, type ChannelResource } from './youtube';

/**
 * Niche search over YouTube's official API. A search costs 100 of the daily
 * 10,000 quota units, so identical queries are answered from memory for six
 * hours. Results are per server process, which is fine for one instance.
 */

const CACHE_MS = 6 * 3_600_000;
const cache = new Map<string, { at: number; items: DiscoveredChannel[] }>();

export type DiscoveredChannel = ChannelInfo & { tier: TierKey };

export async function discoverYouTubeChannels(query: string, max = 25): Promise<DiscoveredChannel[]> {
  const key = `youtube|${query.toLowerCase()}|${max}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;

  const search = await call<{ items?: { id?: { channelId?: string } }[] }>('search', {
    part: 'snippet',
    type: 'channel',
    q: query,
    maxResults: String(max),
    order: 'relevance',
  });
  const ids = (search.items ?? []).map((i) => i.id?.channelId).filter((id): id is string => Boolean(id));

  let items: DiscoveredChannel[] = [];
  if (ids.length > 0) {
    const data = await call<{ items?: ChannelResource[] }>('channels', {
      part: 'snippet,statistics,contentDetails',
      id: ids.join(','),
    });
    items = (data.items ?? []).map(toChannel).map((c) => ({ ...c, tier: tierFor(c.subscriberCount) }));
  }

  cache.set(key, { at: Date.now(), items });
  return items;
}

/** Niche search over public Instagram profiles through Apify's search Actor. */
export async function discoverInstagramChannels(query: string, max = 12): Promise<DiscoveredChannel[]> {
  const key = `instagram|${query.toLowerCase()}|${max}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;

  const data = await runActor('instagramSearch', {
    search: query,
    searchType: 'user',
    searchLimit: max,
    enhanceUserSearchWithFacebookPage: false,
    liveSearch: false,
  }, max);
  const seen = new Set<string>();
  const items = data.flatMap((item): DiscoveredChannel[] => {
    const username = str(item.username).trim().toLowerCase();
    if (!username || seen.has(username)) return [];
    seen.add(username);
    const followers = int(item.followersCount);
    return [{
      externalId: username,
      title: str(item.fullName).trim() || username,
      handle: `@${username}`,
      thumbnailUrl: httpUrl(item.profilePicUrlHD) ?? httpUrl(item.profilePicUrl),
      subscriberCount: followers,
      viewCount: null,
      videoCount: int(item.postsCount),
      uploadsPlaylistId: null,
      tier: tierFor(followers),
    }];
  });

  cache.set(key, { at: Date.now(), items });
  return items;
}
