import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogoMark } from '@/components/LogoMark';
import { currentUser } from '@/server/auth/current';
import './auth.css';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await currentUser()) redirect('/app');
  return (
    <div className="auth-experience">
      <header className="auth-header">
        <Link href="/" className="auth-brand" aria-label="Outlier Studio home">
          <LogoMark />
          outlier<span>studio</span><b>.</b>
        </Link>
        <div className="auth-header-actions"><Link href="/">Back to home <span aria-hidden="true">↗</span></Link><ThemeToggle /></div>
      </header>
      <aside className="auth-story" aria-label="From winning video to your next script">
        <div className="auth-story-grid" aria-hidden="true" />
        <div className="auth-story-content">
          <span className="auth-eyebrow"><i /> YOUR NEXT GREAT IDEA STARTS HERE</span>
          <h2>Find the signal.<br /><span>Make your mark.</span></h2>
          <p>Discover the videos that break the pattern. Understand why they work. Write something that’s unmistakably yours.</p>
          <div className="auth-proof">
            <div className="auth-proof-top"><span>THE ANATOMY OF AN OUTLIER</span><span>EXAMPLE</span></div>
            <div className="auth-proof-metric"><div><span>Outlier score</span><strong>276.1<span>×</span></strong></div><span className="auth-trend" aria-hidden="true">↗</span></div>
            <div className="auth-chart" aria-hidden="true">{[12, 18, 14, 26, 20, 34, 28, 46, 39, 60, 77, 100].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
            <div className="auth-chart-caption"><span>Channel’s normal</span><span>A different league ↗</span></div>
            <div className="auth-hook"><span>THE HOOK</span><blockquote>“Your coffee is not bitter because of the beans.”</blockquote><p>One familiar belief. One unexpected reframe.</p></div>
            <div className="auth-proof-bottom"><span>Find the winner</span><b aria-hidden="true">→</b><span>Write your version</span></div>
          </div>
          <div className="auth-story-foot"><span>RESEARCH → INSIGHT → YOUR NEXT TAKE</span><p>A creative process you can repeat.</p></div>
        </div>
      </aside>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer"><span>Outlier Studio</span><span>Less guessing. More creating.</span></footer>
    </div>
  );
}
