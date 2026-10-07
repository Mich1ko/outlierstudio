import 'server-only';
import { cookies } from 'next/headers';
import { getUserByToken, SESSION_COOKIE, type SessionUser } from './session';

/** The signed-in user for server components, read from the session cookie. */
export async function currentUser(): Promise<SessionUser | null> {
  return getUserByToken((await cookies()).get(SESSION_COOKIE)?.value);
}
