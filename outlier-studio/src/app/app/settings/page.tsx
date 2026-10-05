import Link from 'next/link';
import { AdminPanel } from '@/components/AdminPanel';
import { PersonaForm } from '@/components/PersonaForm';
import { SignOutButton } from '@/components/SignOutButton';
import { PageHead } from '@/components/ui';
import { currentUser } from '@/server/auth/current';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) return null;
  return (
    <div className="stack-lg" style={{ maxWidth: 900 }}>
      <PageHead title="Settings" />

      <section className="panel stack">
        <h2>Account</h2>
        <dl className="stack" style={{ margin: 0 }}>
          <div>
            <dt className="muted small">Name</dt>
            <dd style={{ margin: 0 }}>{user.name}</dd>
          </div>
          <div>
            <dt className="muted small">Email</dt>
            <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{user.email}</dd>
          </div>
        </dl>
        <div className="row">
          <Link className="btn" href="/app/usage">
            View usage
          </Link>
          <SignOutButton />
        </div>
      </section>

      <section className="panel stack">
        <h2>Your creator profile</h2>
        <PersonaForm />
      </section>

      {/* The admin API checks the role again on every request. */}
      {user.role === 'admin' && <AdminPanel />}
    </div>
  );
}
