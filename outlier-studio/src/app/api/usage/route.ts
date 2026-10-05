import { usageSummary } from '@/server/ai/usage';
import { getDb } from '@/server/db/client';
import { json, route } from '@/server/http';
import { getLimits } from '@/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('user', async ({ user }) => {
  const { requestsPerMinute } = await getLimits(await getDb());
  return json({ requestsPerMinute, ...(await usageSummary(user.id)) });
});
