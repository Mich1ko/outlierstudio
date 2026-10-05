import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/client';
import { users } from '../db/schema';
import { AppError } from '../errors';
import { assertUnderLimit, recordHit } from '../ratelimit';
import { dummyHash, hashPassword, verifyPassword } from './password';
import type { SessionUser } from './session';

const email = z.string().trim().toLowerCase().email().max(254);

export const SignupInput = z.object({
  email,
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
  name: z.string().trim().min(1).max(80),
});

export const LoginInput = z.object({ email, password: z.string().min(1).max(200) });

const LOGIN_WINDOW = 15 * 60;
const SIGNUP_WINDOW = 60 * 60;

const pick = (u: SessionUser): SessionUser => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export async function signup(input: z.infer<typeof SignupInput>, ip: string): Promise<SessionUser> {
  await assertUnderLimit(`signup:${ip}`, 10, SIGNUP_WINDOW);
  await recordHit(`signup:${ip}`, SIGNUP_WINDOW);

  const db = await getDb();
  const passwordHash = await hashPassword(input.password);
  // Role is never taken from the request body.
  const inserted = await db
    .insert(users)
    .values({ email: input.email, name: input.name, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning();
  const user = inserted[0];
  if (!user) throw new AppError(409, 'email_taken', 'An account with this email already exists.');
  return pick(user);
}

export async function login(input: z.infer<typeof LoginInput>, ip: string): Promise<SessionUser> {
  const keys = [`login:email:${input.email}`, `login:ip:${ip}`] as const;
  await assertUnderLimit(keys[0], 10, LOGIN_WINDOW);
  await assertUnderLimit(keys[1], 50, LOGIN_WINDOW);

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  // Always run a hash comparison so response time does not reveal whether the email exists.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) {
    await recordHit(keys[0], LOGIN_WINDOW);
    await recordHit(keys[1], LOGIN_WINDOW);
    throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect.');
  }
  return pick(user);
}
