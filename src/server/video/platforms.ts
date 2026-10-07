import 'server-only';
import type { ChannelRef } from '@/shared/channel-url';
import { apifyConfigured } from './apify';
import { instagramAccount, instagramItemsFor, instagramReels } from './instagram';
import type { ChannelInfo, VideoInfo } from './youtube';
import { fetchChannel, fetchRecentVideoIds, fetchVideos, youtubeConfigured } from './youtube';

/**
 * Routes each tracked channel to the client for its platform. YouTube uses the
 * official API with a key. Instagram accounts are read through Apify.
 * TikTok accounts are not monitored; their single videos are read by link.
 */

export type MonitoredPlatform = 'youtube' | 'instagram';

export const MONITORED_PLATFORMS: MonitoredPlatform[] = ['youtube', 'instagram'];

export function platformConfigured(platform: MonitoredPlatform): boolean {
  return platform === 'youtube' ? youtubeConfigured() : apifyConfigured();
}

/** Which monitored platforms have credentials on this server. */
export function platformStatus(): Record<MonitoredPlatform, boolean> {
  return { youtube: youtubeConfigured(), instagram: apifyConfigured() };
}

/**
 * Looks a channel up from what the user pasted. Null if the platform has no such
 * channel. Instagram's lookup also returns the reels it read, so the first check
 * does not pay for a second run.
 */
export async function lookupChannel(channel: ChannelRef): Promise<{ info: ChannelInfo; videos?: VideoInfo[] } | null> {
  if (channel.platform === 'youtube') {
    const info = await fetchChannel(channel.ref);
    return info ? { info } : null;
  }
  const items = await instagramItemsFor(channel.username);
  const info = instagramAccount(items, channel.username);
  return info ? { info, videos: instagramReels(items, channel.username) } : null;
}

/**
 * One check of a channel: its current numbers and recent videos. Instagram
 * needs a single run for both, so they come back together.
 */
export async function fetchSnapshot(
  platform: MonitoredPlatform,
  externalId: string,
  known?: ChannelInfo,
  knownVideoCount = 0,
): Promise<{ info: ChannelInfo; videos: VideoInfo[] } | null> {
  if (platform === 'instagram') {
    const items = await instagramItemsFor(externalId);
    const info = known ?? instagramAccount(items, externalId);
    return info ? { info, videos: instagramReels(items, externalId) } : null;
  }
  const info = known ?? (await fetchChannel({ kind: 'channelId', id: externalId }));
  if (!info) return null;
  // A newly tracked or previously partial channel gets a one-time full backfill.
  // Once its public history is present, scheduled checks only re-read the latest
  // 50 videos. A newly published upload makes videoCount grow and triggers one
  // more backfill, so gaps cannot accumulate over time.
  const historyIsComplete = info.videoCount !== null && knownVideoCount >= info.videoCount;
  const ids = info.uploadsPlaylistId ? await fetchRecentVideoIds(info.uploadsPlaylistId, historyIsComplete ? 50 : Infinity) : [];
  return { info, videos: await fetchVideos(ids) };
}
