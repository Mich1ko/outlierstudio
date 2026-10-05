import 'server-only';
import type { YouTubeRef } from '@/shared/youtube-url';
import { parseIsoDuration } from '@/shared/youtube-url';
import { env } from '../env';
import { AppError } from '../errors';

/**
 * Client for the official YouTube Data API v3. It only reads public channel
 * and video data with an API key; nothing here scrapes youtube.com.
 * Quota: every call below costs 1 unit of the default 10,000 per day.
 */

const GOOGLE_API = 'https://www.googleapis.com/youtube/v3';

export type ChannelInfo = {
  externalId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
};

export type VideoInfo = {
  externalId: string;
  channelExternalId: string;
  title: string;
  description: string;
  publishedAt: Date;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  /** The video's own page, for platforms where it cannot be built from the id. */
  sourceUrl?: string | null;
  /** Set by platforms that know the format. Otherwise it is inferred from the duration. */
  isShort?: boolean;
};

const notConfigured = (message: string) => new AppError(503, 'video_data_not_configured', message);

function baseUrl(): string {
  const e = env();
  return e.NODE_ENV === 'test' && e.YOUTUBE_API_BASE_URL ? e.YOUTUBE_API_BASE_URL : GOOGLE_API;
}

export function youtubeConfigured(): boolean {
  return Boolean(env().YOUTUBE_API_KEY);
}

type ApiError = { error?: { code?: number; message?: string; errors?: { reason?: string }[] } };

export async function call<T>(resource: string, params: Record<string, string>): Promise<T> {
  const key = env().YOUTUBE_API_KEY;
  if (!key) throw notConfigured('Competitor tracking needs a YouTube API key on the server.');

  const url = new URL(`${baseUrl()}/${resource}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' } });
  } catch {
    // Deliberately not logging the error object: its message can contain the URL, which carries the key.
    throw new AppError(503, 'video_data_unavailable', 'YouTube could not be reached. Please try again shortly.');
  }
  if (res.ok) return (await res.json()) as T;

  const body = (await res.json().catch(() => ({}))) as ApiError;
  const reason = body.error?.errors?.[0]?.reason ?? '';
  if (res.status === 403 && /quota|rateLimit|dailyLimit/i.test(reason)) {
    throw new AppError(429, 'video_data_quota', "Today's YouTube API quota is used up. Checks resume when it resets at midnight Pacific time.");
  }
  if (res.status === 404) throw new AppError(404, 'video_data_not_found', 'YouTube has no such channel, playlist or video.');
  if (res.status === 400 && /keyInvalid|badRequest/i.test(reason) && /API key/i.test(body.error?.message ?? '')) {
    throw notConfigured('The YouTube API key was rejected. Check the key in the server settings.');
  }
  if (res.status === 401 || res.status === 403) {
    throw notConfigured('The YouTube API key was rejected, or YouTube Data API v3 is not enabled for it.');
  }
  if (res.status >= 500) throw new AppError(503, 'video_data_unavailable', 'YouTube is having problems. Please try again shortly.');
  throw new AppError(502, 'video_data_rejected', 'YouTube rejected the request.');
}

const toInt = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type Thumbs = Record<string, { url?: string } | undefined> | undefined;
const thumb = (t: Thumbs) => t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? null;

export type ChannelResource = {
  id: string;
  snippet?: { title?: string; customUrl?: string; thumbnails?: Thumbs };
  statistics?: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

type VideoResource = {
  id: string;
  snippet?: { title?: string; description?: string; publishedAt?: string; channelId?: string; thumbnails?: Thumbs };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

export function toChannel(c: ChannelResource): ChannelInfo {
  const s = c.statistics ?? {};
  return {
    externalId: c.id,
    title: c.snippet?.title || 'Untitled channel',
    handle: c.snippet?.customUrl?.startsWith('@') ? c.snippet.customUrl : null,
    thumbnailUrl: thumb(c.snippet?.thumbnails),
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads || null,
    subscriberCount: s.hiddenSubscriberCount ? null : toInt(s.subscriberCount),
    viewCount: toInt(s.viewCount),
    videoCount: toInt(s.videoCount),
  };
}

/** Looks a channel up by id, @handle, legacy username, or via one of its videos. Null if it does not exist. */
export async function fetchChannel(ref: YouTubeRef): Promise<ChannelInfo | null> {
  let filter: Record<string, string>;
  if (ref.kind === 'channelId') filter = { id: ref.id };
  else if (ref.kind === 'handle') filter = { forHandle: ref.handle };
  else if (ref.kind === 'username') filter = { forUsername: ref.username };
  else {
    const [video] = await fetchVideos([ref.videoId]);
    if (!video) return null;
    filter = { id: video.channelExternalId };
  }
  const data = await call<{ items?: ChannelResource[] }>('channels', { part: 'snippet,statistics,contentDetails', ...filter });
  const item = data.items?.[0];
  return item ? toChannel(item) : null;
}

/** Ids of the channel's most recent uploads, newest first (at most 50). */
export async function fetchRecentVideoIds(uploadsPlaylistId: string, max = 50): Promise<string[]> {
  try {
    const data = await call<{ items?: { contentDetails?: { videoId?: string } }[] }>('playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, max)),
    });
    return (data.items ?? []).map((i) => i.contentDetails?.videoId).filter((id): id is string => Boolean(id));
  } catch (err) {
    // A channel with no public uploads has no uploads playlist.
    if (err instanceof AppError && err.code === 'video_data_not_found') return [];
    throw err;
  }
}

export async function fetchVideos(ids: string[]): Promise<VideoInfo[]> {
  if (ids.length === 0) return [];
  const data = await call<{ items?: VideoResource[] }>('videos', {
    part: 'snippet,statistics,contentDetails',
    id: ids.slice(0, 50).join(','),
    maxResults: '50',
  });
  const out: VideoInfo[] = [];
  for (const v of data.items ?? []) {
    const published = v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null;
    if (!published || Number.isNaN(published.getTime()) || !v.snippet?.channelId) continue;
    out.push({
      externalId: v.id,
      channelExternalId: v.snippet.channelId,
      title: v.snippet.title || 'Untitled video',
      description: (v.snippet.description ?? '').slice(0, 2000),
      publishedAt: published,
      durationSeconds: parseIsoDuration(v.contentDetails?.duration),
      thumbnailUrl: thumb(v.snippet.thumbnails),
      viewCount: toInt(v.statistics?.viewCount),
      likeCount: toInt(v.statistics?.likeCount),
      commentCount: toInt(v.statistics?.commentCount),
    });
  }
  return out;
}
