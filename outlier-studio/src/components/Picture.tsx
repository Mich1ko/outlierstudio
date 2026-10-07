'use client';

import { useState } from 'react';

/**
 * A thumbnail or avatar from another site. Those links can expire (TikTok and
 * Instagram image links do within days), so a failed image becomes a plain
 * placeholder block instead of a broken-image icon.
 */
export function Picture({ src, className, lazy = true }: { src: string | null; className: string; lazy?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={className} />;
  return <img className={className} src={src} alt="" loading={lazy ? 'lazy' : undefined} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
