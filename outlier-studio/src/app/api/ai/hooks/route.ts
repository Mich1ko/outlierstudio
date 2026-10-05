import { HooksInput, generateHooks } from '@/server/ai/features/hooks';
import { json, readJson, route } from '@/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

export const POST = route('user', async ({ req, user }) => {
  const input = await readJson(req, HooksInput);
  return json(await generateHooks(user.id, input), { status: 201 });
});
