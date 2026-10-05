import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as me } from '@/app/api/auth/me/route';
import { getDb } from '@/server/db/client';
import { sessions, users } from '@/server/db/schema';
import { call, newUser, useTestApp } from './support/app';

useTestApp();
const creds = { email: 'Ada@Example.com', password: 'correct horse battery', name: 'Ada' };

describe('authentication', () => {
  it('signs up, sets an HttpOnly session cookie and never returns the password hash', async () => {
    const res = await call(signup, 'POST', '/api/auth/signup', { body: creds });
    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/^sid=[^;]+; Path=\/; HttpOnly; SameSite=Lax/);
    const body = await res.json();
    expect(body.user.email).toBe('ada@example.com');
    expect(JSON.stringify(body)).not.toMatch(/password|scrypt/i);

    const who = await call(me, 'GET', '/api/auth/me', { cookie: setCookie.split(';')[0] });
    expect((await who.json()).user.email).toBe('ada@example.com');
  });

  it('ignores role and plan sent in the signup body', async () => {
    const res = await call(signup, 'POST', '/api/auth/signup', { body: { ...creds, role: 'admin', plan: 'titan' } });
    const { user } = await res.json();
    expect(user.role).toBe('user');
    expect(user.plan).toBe('starter');
  });

  it('stores passwords and session tokens hashed', async () => {
    const { cookie, user } = await newUser();
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    expect(u!.passwordHash).toMatch(/^scrypt\$/);
    expect(u!.passwordHash).not.toContain('correct horse battery');
    const [s] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(s!.tokenHash).not.toBe(cookie.split('=')[1]);
    expect(s!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await call(signup, 'POST', '/api/auth/signup', { body: creds });
    const dup = await call(signup, 'POST', '/api/auth/signup', { body: { ...creds, email: 'ada@example.com' } });
    expect(dup.status).toBe(409);
    const weak = await call(signup, 'POST', '/api/auth/signup', { body: { ...creds, email: 'b@example.com', password: 'short' } });
    expect(weak.status).toBe(400);
    expect((await weak.json()).error.code).toBe('invalid_input');
  });

  it('logs in with the right password only, with the same error for unknown emails', async () => {
    await call(signup, 'POST', '/api/auth/signup', { body: creds });
    const wrong = await call(login, 'POST', '/api/auth/login', { body: { email: creds.email, password: 'wrong password!' } });
    const unknown = await call(login, 'POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'wrong password!' } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    const ok = await call(login, 'POST', '/api/auth/login', { body: { email: creds.email, password: creds.password } });
    expect(ok.status).toBe(200);
  });

  it('logout invalidates the session on the server', async () => {
    const { cookie } = await newUser();
    expect((await call(me, 'GET', '/api/auth/me', { cookie })).status).toBe(200);
    await call(logout, 'POST', '/api/auth/logout', { cookie });
    expect((await call(me, 'GET', '/api/auth/me', { cookie })).status).toBe(401);
  });

  it('locks login after repeated failures', async () => {
    await call(signup, 'POST', '/api/auth/signup', { body: creds });
    for (let i = 0; i < 10; i++) {
      const r = await call(login, 'POST', '/api/auth/login', { body: { email: creds.email, password: `bad password ${i}` } });
      expect(r.status).toBe(401);
    }
    const locked = await call(login, 'POST', '/api/auth/login', { body: { email: creds.email, password: creds.password } });
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBeTruthy();
  });

  it('blocks cross-site writes and non-JSON bodies', async () => {
    const cross = await call(signup, 'POST', '/api/auth/signup', { body: creds, headers: { origin: 'https://evil.example' } });
    expect(cross.status).toBe(403);
    const form = await call(signup, 'POST', '/api/auth/signup', {
      rawBody: 'email=a@b.co',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(form.status).toBe(415);
  });

  it('rejects requests without a session', async () => {
    expect((await call(me, 'GET', '/api/auth/me')).status).toBe(401);
    expect((await call(me, 'GET', '/api/auth/me', { cookie: 'sid=forged' })).status).toBe(401);
  });
});
