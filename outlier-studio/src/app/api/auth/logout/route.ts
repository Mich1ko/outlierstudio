import { clearSessionCookie, destroySession } from '@/server/auth/session';
import { json, route } from '@/server/http';

export const runtime = 'nodejs';

export const POST = route('public', async ({ req }) => {
  await destroySession(req);
  return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie() } });
});
