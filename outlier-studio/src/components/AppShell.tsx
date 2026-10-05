'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { APP } from '@/config/app';
import { api } from '@/lib/api';
import type { SessionUser } from '@/lib/types';
import { Icon } from './icons';

const NAV = [
  {
    group: 'Research',
    items: [
      { href: '/app/feed', label: 'Videos', icon: Icon.feed },
      { href: '/app/discover', label: 'Discover', icon: Icon.search },
      { href: '/app/hook-library', label: 'Hook library', icon: Icon.hooks },
    ],
  },
  {
    group: 'Create',
    items: [
      { href: '/app/scripts', label: 'Scripts', icon: Icon.scripts },
      { href: '/app/hooks', label: 'Hook writer', icon: Icon.hooks },
      { href: '/app/analyze', label: 'Analyze a link', icon: Icon.analyze },
      { href: '/app/library', label: 'Library', icon: Icon.library },
    ],
  },
  {
    group: 'Setup',
    items: [
      { href: '/app/competitors', label: 'Channels', icon: Icon.competitors },
      { href: '/app/usage', label: 'Usage', icon: Icon.usage },
      { href: '/app/settings', label: 'Settings', icon: Icon.settings },
    ],
  },
] as const;
/** Phone tab bar. Home links to every tool. */
const TABS = [
  { href: '/app', label: 'Home', icon: Icon.home, exact: true },
  { href: '/app/feed', label: 'Videos', icon: Icon.feed, exact: false },
  { href: '/app/scripts', label: 'Scripts', icon: Icon.scripts, exact: false },
  { href: '/app/competitors', label: 'Channels', icon: Icon.competitors, exact: false },
  { href: '/app/settings', label: 'Settings', icon: Icon.settings, exact: false },
];

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = (href: string) => {
    const here = pathname.startsWith('/app/videos/') ? '/app/feed' : pathname;
    return here === href || here.startsWith(`${href}/`) ? 'page' : undefined;
  };

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/app" className="brand">
          <span className="brand-mark" />
          {APP.name}
        </Link>
        <nav aria-label="Main">
          <div className="nav">
            {NAV.map(({ group, items }) => (
              <div key={group} className="nav-section">
                <div className="nav-group">{group}</div>
                {items.map(({ href, label, icon: I }) => (
                  <Link key={href} href={href} aria-current={current(href)}>
                    <I />
                    {label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <strong>{user.name}</strong>
            <span className="muted">{user.email}</span>
          </div>
          <button type="button" className="btn btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <div>
        <div className="topbar">
          <Link href="/app" className="brand">
            <span className="brand-mark" />
            {APP.name}
          </Link>
        </div>
        <main className="main">{children}</main>
      </div>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ href, label, icon: I, exact }) => (
          <Link key={href} href={href} aria-current={exact ? (pathname === href ? 'page' : undefined) : current(href)}>
            <I />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
