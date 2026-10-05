import Link from 'next/link';
import { SampleScript } from '@/components/SampleScript';
import { APP } from '@/config/app';
import { currentUser } from '@/server/auth/current';

export default async function Home() {
  const user = await currentUser();
  return (
    <div className="site">
      <header className="site-head">
        <span className="brand">
          <span className="brand-mark" />
          {APP.name}
        </span>
        <nav className="row" aria-label="Account">
          {user ? (
            <Link className="btn btn-primary" href="/app">
              Open the app
            </Link>
          ) : (
            <>
              <Link className="btn btn-quiet" href="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary" href="/signup">
                Create an account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>Write your next short from the ones that already worked.</h1>
            <p className="lede">
              Track the YouTube and Instagram accounts you compete with, see which of their videos are beating the channel&apos;s normal, and turn the winners into your own hooks and scripts.
            </p>
            <div className="row">
              <Link className="btn btn-primary" href={user ? '/app' : '/signup'}>
                {user ? 'Open the app' : 'Create an account'}
              </Link>
            </div>
          </div>
          <SampleScript />
        </section>

        <ol className="steps">
          <li>
            <h2>Build a watchlist</h2>
            <p>Add YouTube channels and Instagram accounts by link. New uploads, views and subscriber counts are checked on a schedule.</p>
          </li>
          <li>
            <h2>Find the outliers</h2>
            <p>Every video is ranked against what is normal for its channel. Single TikTok and Instagram videos can be added by link.</p>
          </li>
          <li>
            <h2>Write your version</h2>
            <p>One click breaks a winner down into its hook and structure. Then get your own script, timed line by line for the camera.</p>
          </li>
        </ol>
      </main>

      <footer className="site-foot">
        <p>{APP.name}. Channel monitoring works with YouTube and Instagram. Single videos can come from YouTube, TikTok or Instagram.</p>
      </footer>
    </div>
  );
}
