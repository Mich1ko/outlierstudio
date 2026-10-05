'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        router.replace('/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
