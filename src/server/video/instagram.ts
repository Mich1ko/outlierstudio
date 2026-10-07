import 'server-only';
import { int, date, httpUrl, runActor, str, type Item } from './apify';
import type { ChannelInfo, VideoInfo } from './youtube';

/**
 * Instagram accounts, read through the Apify reel scraper. One run returns an
 * account's latest reels with their numbers; that run is the cost of a check.
 * Instagram does not expose these figures through a free API for other accounts.
 */

/** Reels read per check. */
const REELS_PER_CHECK = 30;

export const instagramItemsFor = (username: string): Promise<Item[]> =>
  runActor('instagram', { username: [username], resultsLimit: REELS_PER_CHECK }, REELS_PER_CHECK);

/** The account's details from its reels, or null when the run found nothing. */
export function instagramAccount(items: Item[], username: string): ChannelInfo | null {
  const first = items[0];
  if (!first) return null;
  return {
    externalId: username,
    title: str(first.ownerFullName) || username,
    handle: `@${username}`,
    thumbnailUrl: httpUrl(first.ownerProfilePicUrl),
    uploadsPlaylistId: null,
    subscriberCount: int(first.followersCount),
    viewCount: null,
    videoCount: null,
  };
}

/** The account's reels, newest first. Reels are short-form by nature. */
export function instagramReels(items: Item[], username: string): VideoInfo[] {
  const out: VideoInfo[] = [];
  for (const item of items) {
    const id = str(item.id) || str(item.shortCode);
    const published = date(item.timestamp);
    if (!id || !published) continue;
    const caption = str(item.caption);
    out.push({
      externalId: id,
      channelExternalId: username,
      title: (caption.split('\n')[0] ?? '').slice(0, 200) || 'Untitled reel',
      description: caption.slice(0, 2000),
      publishedAt: published,
      durationSeconds: int(item.videoDuration),
      thumbnailUrl: httpUrl(item.displayUrl),
      viewCount: int(item.videoPlayCount ?? item.videoViewCount),
      likeCount: int(item.likesCount),
      commentCount: int(item.commentsCount),
      sourceUrl: httpUrl(item.url) ?? (str(item.shortCode) ? `https://www.instagram.com/reel/${str(item.shortCode)}/` : null),
      isShort: true,
    });
  }
  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
