import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SampleScript } from '@/components/SampleScript';
import { currentUser } from '@/server/auth/current';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await currentUser()) redirect('/app');
  return (
    <div className="auth">
      <main className="auth-form">{children}</main>
      <aside className="auth-side" aria-label="Example of a finished script">
        <SampleScript />
      </aside>
    </div>
  );
}
