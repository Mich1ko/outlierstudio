import Link from 'next/link';
import { RecentList } from '@/components/RecentList';
import { PageHead } from '@/components/ui';
import { currentUser } from '@/server/auth/current';

export const metadata = { title: 'Home' };

export default async function AppHome() {
  const user = await currentUser();
  return (
    <div className="stack-lg">
      <PageHead title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}`}>Find what is working for your competitors, then write your own version.</PageHead>

      <ol className="steps" style={{ background: 'transparent' }}>
        <li>
          <h2>Build your watchlist</h2>
          <p className="muted">Add the YouTube channels you compete with. Uploads, views and subscribers are checked on a schedule.</p>
          <div>
            <Link className="btn btn-primary" href="/app/competitors">
              Open the watchlist
            </Link>
          </div>
        </li>
        <li>
          <h2>Find what is working</h2>
          <p className="muted">Videos are ranked against each channel&apos;s normal. Or paste any YouTube, TikTok or Instagram video link.</p>
          <div className="row">
            <Link className="btn" href="/app/feed">
              See the videos
            </Link>
            <Link className="btn" href="/app/analyze">
              Analyze a link
            </Link>
          </div>
        </li>
        <li>
          <h2>Write your version</h2>
          <p className="muted">One click breaks a video down. Then turn its hook and structure into your own script.</p>
          <div className="row">
            <Link className="btn" href="/app/hook-library">
              Hook library
            </Link>
            <Link className="btn" href="/app/hooks">
              Hook writer
            </Link>
            <Link className="btn" href="/app/scripts">
              Script writer
            </Link>
          </div>
        </li>
      </ol>

      <section className="stack">
        <h2>Recently saved</h2>
        <RecentList />
      </section>
    </div>
  );
}
