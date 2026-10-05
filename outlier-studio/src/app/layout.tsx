import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import './globals.css';
import { APP } from '@/config/app';

export const metadata: Metadata = { title: { default: APP.name, template: `%s | ${APP.name}` }, description: APP.tagline };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#17182e' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
