import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { APP } from '@/config/app';
import { ThemeProvider } from '@/components/ThemeProvider';
import { themeInitScript } from '@/lib/theme';

export const metadata: Metadata = { title: { default: APP.name, template: `%s | ${APP.name}` }, description: APP.tagline };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
