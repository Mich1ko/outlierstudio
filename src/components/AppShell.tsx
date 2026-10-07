'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { APP } from '@/config/app';
import type { SessionUser } from '@/lib/types';
import { Icon } from './icons';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette } from './CommandPalette';

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => drawer.current?.close();
  return (
    <div className="shell bg-bg text-text">
      <a className="skip-link btn" href="#main-content">Skip to content</a>
      <div className="desktop-sidebar"><Sidebar user={user} /></div>
      <div className="shell-content">
        <div className="topbar">
          <Link href="/app" className="brand"><span className="brand-mark" aria-hidden="true" /><span>{APP.name}</span></Link>
          <div className="topbar-controls">
            <ThemeToggle compact />
            <button className="icon-button" type="button" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => { drawer.current?.showModal(); setOpen(true); }}><Icon.menu /></button>
          </div>
        </div>
        <main className="main" id="main-content" tabIndex={-1}>{children}</main>
      </div>
      <dialog className="mobile-nav" id="mobile-navigation" ref={drawer} aria-label="Navigation" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <button type="button" className="drawer-close icon-button" aria-label="Close navigation" onClick={close}><Icon.close /></button>
        <Sidebar user={user} onNavigate={close} />
      </dialog>
      <div className="desktop-command"><CommandPalette /></div>
    </div>
  );
}
