import { getDb } from '@/server/db/client';
import { json, readJson, route } from '@/server/http';
import { LimitsSchema, getLimits, setLimits } from '@/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('admin', async () => json({ limits: await getLimits(await getDb()) }));

export const PUT = route('admin', async ({ req, user }) => {
  const input = await readJson(req, LimitsSchema);
  return json({ limits: await setLimits(await getDb(), input, user.id) });
});
