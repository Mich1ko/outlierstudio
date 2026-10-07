import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { sessions, users, type User } from '../db/schema';
import { env } from '../env';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'role'>;

function cookie(value: string, maxAgeSeconds: number): string {
  const parts = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (env().NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

/** Creates a session row and returns the Set-Cookie header value. */
export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  // Opportunistic cleanup of this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  return cookie(token, SESSION_DAYS * 86_400);
}

export function clearSessionCookie(): string {
  return cookie('', 0);
}

function readToken(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=') || null;
  }
  return null;
}

export async function getUserByToken(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export function getSessionUser(req: Request): Promise<SessionUser | null> {
  return getUserByToken(readToken(req));
}

export async function destroySession(req: Request): Promise<void> {
  const token = readToken(req);
  if (!token) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
