import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as addChannelRoute } from '@/app/api/channels/route';
import { apifyBudgetUsd, apifySpendThisMonth } from '@/server/video/apify';
import { refreshDue } from '@/server/video/tracking';
import { call, newUser, useTestApp } from './support/app';
import { APIFY_TOKEN, FakeApify } from './support/fake-apify';

useTestApp();
const apify = new FakeApify();

beforeAll(async () => {
  process.env.APIFY_BASE_URL = await apify.start();
});
beforeEach(() => {
  apify.reset();
  process.env.APIFY_TOKEN = APIFY_TOKEN;
  process.env.APIFY_MONTHLY_BUDGET_USD = '5';
});
afterAll(() => apify.stop());

const add = (cookie: string, url: string) => call(addChannelRoute, 'POST', '/api/channels', { cookie, body: { url } });

/** Two reels per account: one Actor start plus two free-tier reel events. */
function seedAccount(username: string) {
  const now = Date.now();
  apify.accounts.set(username, [
    { platform: 'instagram', id: `${username}-1`, username, displayName: username, title: 'One', views: 100, duration: 20, createdAt: new Date(now - 3600_000).toISOString() },
    { platform: 'instagram', id: `${username}-2`, username, displayName: username, title: 'Two', views: 50, duration: 20, createdAt: new Date(now - 7200_000).toISOString() },
  ]);
}

describe('Apify monthly budget', () => {
  it('never allows a budget above $5, whatever the setting says', () => {
    process.env.APIFY_MONTHLY_BUDGET_USD = '50';
    expect(apifyBudgetUsd()).toBe(5);
    process.env.APIFY_MONTHLY_BUDGET_USD = '2';
    expect(apifyBudgetUsd()).toBe(2);
  });

  it('refuses a run whose reservation would pass the budget, before spending anything', async () => {
    process.env.APIFY_MONTHLY_BUDGET_USD = '0.04';
    seedAccount('trailnotes');
    const { cookie } = await newUser();
    // Thirty reels reserve $0.079, which is over this $0.04 budget.
    const res = await add(cookie, 'instagram.com/trailnotes');
    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe('apify_budget');
    expect(apify.calls).toHaveLength(0);
    expect(await apifySpendThisMonth()).toBe(0);
  });

  it('stops at the budget: runs that fit go through, the next one is refused', async () => {
    process.env.APIFY_MONTHLY_BUDGET_USD = '0.09';
    seedAccount('alpha');
    seedAccount('bravo');
    seedAccount('charlie');
    const { cookie } = await newUser();
    expect((await add(cookie, 'instagram.com/alpha')).status).toBe(201);
    expect((await add(cookie, 'instagram.com/bravo')).status).toBe(201);
    // Two settled checks cost 2 x $0.0062, so a third reservation of $0.079 no longer fits.
    expect(await apifySpendThisMonth()).toBeCloseTo(0.0124, 6);
    const third = await add(cookie, 'instagram.com/charlie');
    expect(third.status).toBe(402);
    expect((await third.json()).error.code).toBe('apify_budget');
    expect(apify.calls).toHaveLength(2);
  });

  it('sends each run its spend cap, so Apify stops the run itself', async () => {
    seedAccount('trailnotes');
    const { cookie } = await newUser();
    await add(cookie, 'instagram.com/trailnotes');
    expect(apify.calls.at(-1)!.cap).toBe('0.079000');
  });

  it('counts a failed run at its reservation, so the budget errs low', async () => {
    seedAccount('trailnotes');
    const { cookie } = await newUser();
    apify.failNext = { status: 500, message: 'boom' };
    expect((await add(cookie, 'instagram.com/trailnotes')).status).toBe(503);
    expect(await apifySpendThisMonth()).toBeCloseTo(0.079, 6);
  });

  it('halts scheduled checks for a platform that has used up its budget, and reports the spend', async () => {
    process.env.APIFY_MONTHLY_BUDGET_USD = '0.09';
    seedAccount('alpha');
    const { cookie } = await newUser();
    await add(cookie, 'instagram.com/alpha');
    const db = await (await import('@/server/db/client')).getDb();
    const { channels } = await import('@/server/db/schema');
    const { sql } = await import('drizzle-orm');
    await db.update(channels).set({ lastCheckedAt: sql`now() - interval '30 hours'` });
    // Budget left: $0.0838 after the first check. A new $0.079 reservation fits.
    expect((await refreshDue()).checked).toBe(1);
    // After two settled checks, another $0.079 reservation no longer fits.
    await db.update(channels).set({ lastCheckedAt: sql`now() - interval '30 hours'` });
    const result = await refreshDue();
    expect(result.stoppedEarly).toBe(true);
    const list = await (await (await import('@/app/api/channels/route')).GET(new Request('http://localhost:3000/api/channels', { headers: { cookie } }))).json();
    expect(list.apifyBudget).toEqual({ spentUsd: expect.any(Number), budgetUsd: 0.09 });
  });
});
