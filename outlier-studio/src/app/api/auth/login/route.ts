import { LoginInput, login } from '@/server/auth/service';
import { createSession } from '@/server/auth/session';
import { json, readJson, route } from '@/server/http';
import { clientIp } from '@/server/ratelimit';

export const runtime = 'nodejs';

export const POST = route('public', async ({ req }) => {
  const input = await readJson(req, LoginInput);
  const user = await login(input, clientIp(req));
  return json({ user }, { headers: { 'set-cookie': await createSession(user.id) } });
});
