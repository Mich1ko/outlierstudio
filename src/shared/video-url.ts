import { parseYouTubeInput } from './youtube-url';

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram';
export type VideoLink =
  | { ok: true; platform: 'youtube'; url: string }
  | { ok: true; platform: 'tiktok' | 'instagram'; url: string }
  | { ok: false; reason: string };

const TIKTOK = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);
const INSTAGRAM = new Set(['instagram.com', 'www.instagram.com']);

/** Recognises a link to one video on YouTube, TikTok or Instagram. */
export function parseVideoLink(raw: string): VideoLink {
  const input = raw.trim();
  if (!input) return { ok: false, reason: 'Paste a link to a video.' };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: 'That does not look like a link.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'That does not look like a link.' };
  const host = url.hostname.toLowerCase();
  const clean = `https://${host}${url.pathname}`;

  if (TIKTOK.has(host)) {
    // Full links look like /@user/video/123; share links (vm., vt., /t/) are short codes.
    const ok = /\/video\/\d+/.test(url.pathname) || host.startsWith('vm.') || host.startsWith('vt.') || url.pathname.startsWith('/t/');
    return ok ? { ok: true, platform: 'tiktok', url: clean } : { ok: false, reason: 'Paste a link to one TikTok video, not a profile.' };
  }
  if (INSTAGRAM.has(host)) {
    const ok = /^\/(?:[^/]+\/)?(reel|reels|p|tv)\/[\w-]+/.test(url.pathname);
    return ok ? { ok: true, platform: 'instagram', url: clean } : { ok: false, reason: 'Paste a link to one Instagram reel or post, not a profile.' };
  }
  const yt = parseYouTubeInput(input);
  if (yt.ok && yt.ref.kind === 'video') return { ok: true, platform: 'youtube', url: input };
  if (yt.ok) return { ok: false, reason: 'That is a channel link. Add channels on the Watchlist page, or paste a link to one video here.' };
  return { ok: false, reason: 'Paste a link to a YouTube, TikTok or Instagram video.' };
}

export const PLATFORM_NAME: Record<VideoPlatform, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
