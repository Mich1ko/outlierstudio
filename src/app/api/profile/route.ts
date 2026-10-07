import { z } from 'zod';
import { json, readJson, route } from '@/server/http';
import { getPersona, PERSONA_MAX, setPersona } from '@/server/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('user', async ({ user }) => json({ persona: await getPersona(user.id) }));

const Input = z.object({ persona: z.string().max(PERSONA_MAX) });

export const PUT = route('user', async ({ req, user }) => {
  const { persona } = await readJson(req, Input);
  return json({ persona: await setPersona(user.id, persona) });
});
