'use client';

import { useState } from 'react';

/**
 * A thumbnail or avatar from another site. Those links can expire (TikTok and
 * Instagram image links do within days), so a failed image becomes a plain
 * placeholder block instead of a broken-image icon.
 */
export function Picture({ src, className, lazy = true, name = '' }: { src: string | null; className: string; lazy?: boolean; name?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  if (!src || failedSrc === src) return <span className={className} aria-hidden="true">{initials}</span>;
  let imageSrc = src;
  try {
    const host = new URL(src).hostname.toLowerCase();
    if (className.includes('avatar') && (host.endsWith('.cdninstagram.com') || host.endsWith('.fbcdn.net'))) {
      imageSrc = `/api/instagram-avatar?url=${encodeURIComponent(src)}`;
    }
  } catch { /* Invalid provider URLs use the normal broken-image fallback. */ }
  return <img className={className} src={imageSrc} alt="" loading={lazy ? 'lazy' : undefined} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />;
}
