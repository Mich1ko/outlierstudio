'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { APP } from '@/config/app';
import { api } from '@/lib/api';
import type { SessionUser, Usage } from '@/lib/types';
import { PLAN_LABELS } from '@/shared/catalog';
import { Icon } from './icons';

const RESEARCH = [
  { href: '/app/competitors', label: 'Watchlist', icon: Icon.competitors },
  { href: '/app/feed', label: 'Videos', icon: Icon.feed },
  { href: '/app/hook-library', label: 'Hook library', icon: Icon.hooks },
] as const;
const TOOLS = [
  { href: '/app/analyze', label: 'Analyze a link', icon: Icon.analyze },
  { href: '/app/hooks', label: 'Hook writer', icon: Icon.hooks },
  { href: '/app/scripts', label: 'Script writer', icon: Icon.scripts },
] as const;
const REST = [
  { href: '/app/library', label: 'Library', icon: Icon.library },
  { href: '/app/usage', label: 'Usage', icon: Icon.usage },
  { href: '/app/settings', label: 'Settings', icon: Icon.settings },
] as const;
/** Phone tab bar. Home links to every tool; Usage is reached from the credit meter in the top bar. */
const TABS = [
  { href: '/app', label: 'Home', icon: Icon.home, exact: true },
  { href: '/app/feed', label: 'Videos', icon: Icon.feed, exact: false },
  { href: '/app/scripts', label: 'Scripts', icon: Icon.scripts, exact: false },
  { href: '/app/library', label: 'Library', icon: Icon.library, exact: false },
  { href: '/app/settings', label: 'Account', icon: Icon.settings, exact: false },
];

function Credits({ credits }: { credits: Usage['credits'] | null }) {
  const pct = credits && credits.limit > 0 ? Math.min(100, (credits.used / credits.limit) * 100) : credits ? 100 : 0;
  return (
    <Link href="/app/usage" className="credits" aria-label={credits ? `${credits.remaining} of ${credits.limit} credits left this month. Open usage.` : 'Open usage'}>
      <span>{credits ? `${credits.remaining} of ${credits.limit} credits left` : 'Credits'}</span>
      <span className="meter" data-low={credits ? credits.remaining === 0 : false}>
        <span style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [credits, setCredits] = useState<Usage['credits'] | null>(null);

  const load = useCallback(() => {
    api<Usage>('/api/usage')
      .then((u) => setCredits(u.credits))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('credits:refresh', load);
    return () => window.removeEventListener('credits:refresh', load);
  }, [load]);

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
            <div className="nav-group">Research</div>
            {RESEARCH.map(({ href, label, icon: I }) => (
              <Link key={href} href={href} aria-current={current(href)}>
                <I />
                {label}
              </Link>
            ))}
            <div className="nav-group">Create</div>
            {TOOLS.map(({ href, label, icon: I }) => (
              <Link key={href} href={href} aria-current={current(href)}>
                <I />
                {label}
              </Link>
            ))}
            <div className="nav-group">Your work</div>
            {REST.map(({ href, label, icon: I }) => (
              <Link key={href} href={href} aria-current={current(href)}>
                <I />
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="sidebar-foot">
          <Credits credits={credits} />
          <div className="who">
            <strong>{user.name}</strong>
            <span className="muted">
              {PLAN_LABELS[user.plan]} plan{user.role === 'admin' ? ', admin' : ''}
            </span>
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
          <Credits credits={credits} />
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
