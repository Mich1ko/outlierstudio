import type { SVGProps } from 'react';

export type LogoPlatform = 'youtube' | 'youtube_shorts' | 'tiktok' | 'instagram';

export function PlatformLogo({ platform, ...props }: { platform: LogoPlatform } & SVGProps<SVGSVGElement>) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false, ...props } as const;
  if (platform === 'youtube' || platform === 'youtube_shorts') {
    return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m10 9 6 3-6 3V9Z" fill="currentColor" /></svg>;
  }
  if (platform === 'tiktok') {
    return <svg {...common}><path d="M14.2 3h2.6a4.6 4.6 0 0 0 4.1 4.1v2.7a7.4 7.4 0 0 1-4.1-1.2v6.1a6.2 6.2 0 1 1-6.2-6.2v3a3.2 3.2 0 1 0 3.6 3.2V3Z" fill="currentColor" /></svg>;
  }
  return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.25" /><circle cx="17.4" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>;
}
