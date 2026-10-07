import { parseYouTubeInput, type YouTubeRef } from './youtube-url';

/** A channel that can be tracked, from whichever platform it is on. */
export type ChannelRef = { platform: 'youtube'; ref: YouTubeRef } | { platform: 'instagram'; username: string };

export type ChannelParse = { ok: true; channel: ChannelRef } | { ok: false; reason: string };

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;
/** Instagram paths that are not profiles. */
const RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct']);

/**
 * Recognises a YouTube channel or video link, or an Instagram profile link.
 * Anything else gets the YouTube parser's explanation.
 */
export function parseChannelInput(raw: string): ChannelParse {
  const input = raw.trim();
  let url: URL | null = null;
  try {
    url = input ? new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`) : null;
  } catch {
    url = null;
  }

  if (url && INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) {
    const [first] = url.pathname.split('/').filter(Boolean);
    if (!first || RESERVED.has(first.toLowerCase()) || !USERNAME.test(first)) {
      return { ok: false, reason: 'Paste an Instagram profile link, like instagram.com/name. Single reels are added on the Videos page.' };
    }
    return { ok: true, channel: { platform: 'instagram', username: first.toLowerCase() } };
  }

  const yt = parseYouTubeInput(input);
  if (yt.ok) return { ok: true, channel: { platform: 'youtube', ref: yt.ref } };
  return { ok: false, reason: yt.reason };
}
