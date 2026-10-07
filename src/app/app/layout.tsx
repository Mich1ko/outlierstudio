import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { currentUser } from '@/server/auth/current';

/** Everything under /app requires a session. The API enforces this again on every request. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <AppShell user={user}>{children}</AppShell>;
}
