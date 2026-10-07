import { SignupInput, signup } from '@/server/auth/service';
import { createSession } from '@/server/auth/session';
import { json, readJson, route } from '@/server/http';
import { clientIp } from '@/server/ratelimit';

export const runtime = 'nodejs';

export const POST = route('public', async ({ req }) => {
  const input = await readJson(req, SignupInput);
  const user = await signup(input, clientIp(req));
  return json({ user }, { status: 201, headers: { 'set-cookie': await createSession(user.id) } });
});
