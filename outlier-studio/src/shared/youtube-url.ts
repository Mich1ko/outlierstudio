/** Turns whatever a user pastes into something the YouTube API can look up. */
export type YouTubeRef =
  | { kind: 'channelId'; id: string }
  | { kind: 'handle'; handle: string }
  | { kind: 'username'; username: string }
  | { kind: 'video'; videoId: string };

export type ParseResult = { ok: true; ref: YouTubeRef } | { ok: false; reason: string };

const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_ID = /^[\w-]{11}$/;
/** Handles may use non-Latin letters, so this only rules out separators. */
const HANDLE = /^@?[^\s/?#@]{3,60}$/u;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);

const NOT_YOUTUBE = 'Paste a YouTube channel or video link. TikTok and Instagram are not supported.';
const UNRECOGNISED = 'That does not look like a YouTube channel or video link.';

export function parseYouTubeInput(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return { ok: false, reason: 'Paste a YouTube channel or video link.' };

  if (CHANNEL_ID.test(input)) return { ok: true, ref: { kind: 'channelId', id: input } };
  if (input.startsWith('@') && HANDLE.test(input)) return { ok: true, ref: { kind: 'handle', handle: input } };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: UNRECOGNISED };
  }
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return { ok: false, reason: /tiktok|instagram/.test(host) ? NOT_YOUTUBE : UNRECOGNISED };

  const parts = url.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const video = (id: string | null | undefined): ParseResult =>
    id && VIDEO_ID.test(id) ? { ok: true, ref: { kind: 'video', videoId: id } } : { ok: false, reason: UNRECOGNISED };

  if (host === 'youtu.be') return video(parts[0]);

  const [first, second] = parts;
  if (!first) return { ok: false, reason: 'That is the YouTube home page. Paste a channel or video link.' };
  if (first.startsWith('@')) return HANDLE.test(first) ? { ok: true, ref: { kind: 'handle', handle: first } } : { ok: false, reason: UNRECOGNISED };
  if (first === 'channel') return second && CHANNEL_ID.test(second) ? { ok: true, ref: { kind: 'channelId', id: second } } : { ok: false, reason: UNRECOGNISED };
  if (first === 'user') return second ? { ok: true, ref: { kind: 'username', username: second } } : { ok: false, reason: UNRECOGNISED };
  if (first === 'c') {
    return { ok: false, reason: 'Old-style /c/ links cannot be looked up. Paste the channel\'s @handle link or a link to one of its videos.' };
  }
  if (first === 'watch') return video(url.searchParams.get('v'));
  if (first === 'shorts' || first === 'live' || first === 'embed' || first === 'v') return video(second);
  return { ok: false, reason: UNRECOGNISED };
}

export const youtubeVideoUrl = (videoId: string, isShort: boolean) =>
  isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
export const youtubeChannelUrl = (channelId: string) => `https://www.youtube.com/channel/${channelId}`;

/** Where to watch a video or visit its author, on whichever platform it is from. */
export function watchUrl(v: { platform: string; externalId: string; isShort: boolean; sourceUrl: string | null }): string {
  return v.sourceUrl ?? youtubeVideoUrl(v.externalId, v.isShort);
}
export function authorUrl(c: { platform: string; externalId: string }): string {
  if (c.platform === 'tiktok') return `https://www.tiktok.com/@${encodeURIComponent(c.externalId)}`;
  if (c.platform === 'instagram') return `https://www.instagram.com/${encodeURIComponent(c.externalId)}/`;
  return youtubeChannelUrl(c.externalId);
}

/** Videos this short are treated as Shorts. The API has no "is a Short" field. */
export const SHORT_MAX_SECONDS = 180;

/** ISO 8601 duration as returned by the API, e.g. PT1M5S. Returns null if unparseable. */
export function parseIsoDuration(value: string | undefined | null): number | null {
  if (!value) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!m) return null;
  const [, d, h, min, s] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}
