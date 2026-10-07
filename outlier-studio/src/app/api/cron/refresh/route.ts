import { timingSafeEqual } from 'node:crypto';
import { env } from '@/server/env';
import { notFound, unauthorized } from '@/server/errors';
import { json, route } from '@/server/http';
import { refreshDue } from '@/server/video/tracking';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * For hosts without a long-running server: call this on a schedule with
 * "Authorization: Bearer <CRON_SECRET>". Disabled (404) until CRON_SECRET is set.
 */
export const POST = route('public', async ({ req }) => {
  const secret = env().CRON_SECRET;
  if (!secret) throw notFound();
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw unauthorized();
  return json(await refreshDue(40));
});
