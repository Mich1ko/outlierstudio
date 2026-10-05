import { describe, expect, it } from 'vitest';
import { POST as analyze } from '@/app/api/ai/analyze/route';
import { GET as list } from '@/app/api/generations/route';
import { DELETE as remove, GET as getOne } from '@/app/api/generations/[id]/route';
import { GET as usage } from '@/app/api/usage/route';
import { GET as adminLimits, PUT as putLimits } from '@/app/api/admin/limits/route';
import { GET as adminUser, PUT as putUser } from '@/app/api/admin/users/[id]/route';
import { GET as adminUsers } from '@/app/api/admin/users/route';
import { DEFAULT_LIMITS } from '@/server/settings';
import { TRANSCRIPT, call, makeAdmin, newUser, useTestApp } from './support/app';

const groq = useTestApp();
const ANALYSIS = JSON.stringify({
  summary: 's', hook: { text: 'h', pattern: 'p', whyItWorks: 'w' }, format: 'f',
  structure: [], storytellingTactics: [], topics: [], takeaways: [], remixIdeas: [],
});

describe('users only see their own data', () => {
  it('hides generations and usage from other accounts', async () => {
    const alice = await newUser('alice@example.com');
    const bob = await newUser('bob@example.com');
    groq.enqueue({ kind: 'json', content: ANALYSIS });
    const created = await (await call(analyze, 'POST', '/api/ai/analyze', { cookie: alice.cookie, body: { transcript: TRANSCRIPT } })).json();
    const id = created.generation.id as string;

    expect((await call(getOne, 'GET', `/api/generations/${id}`, { cookie: bob.cookie, params: { id } })).status).toBe(404);
    expect((await call(remove, 'DELETE', `/api/generations/${id}`, { cookie: bob.cookie, params: { id } })).status).toBe(404);
    expect((await (await call(list, 'GET', '/api/generations', { cookie: bob.cookie })).json()).items).toEqual([]);
    const bobUsage = await (await call(usage, 'GET', '/api/usage', { cookie: bob.cookie })).json();
    expect(bobUsage.month.requests).toBe(0);
    expect(bobUsage.recent).toEqual([]);
    expect(bobUsage.credits.used).toBe(0);

    // Still there for its owner, who can then delete it.
    expect((await (await call(list, 'GET', '/api/generations', { cookie: alice.cookie })).json()).items).toHaveLength(1);
    expect((await call(getOne, 'GET', `/api/generations/${id}`, { cookie: alice.cookie, params: { id } })).status).toBe(200);
    expect((await call(remove, 'DELETE', `/api/generations/${id}`, { cookie: alice.cookie, params: { id } })).status).toBe(200);
    expect((await call(getOne, 'GET', `/api/generations/${id}`, { cookie: alice.cookie, params: { id } })).status).toBe(404);
  });

  it('returns 404 for malformed ids rather than a database error', async () => {
    const { cookie } = await newUser();
    expect((await call(getOne, 'GET', '/api/generations/nope', { cookie, params: { id: "1' or '1'='1" } })).status).toBe(404);
  });
});

describe('admin controls', () => {
  it('keeps non-admins out', async () => {
    const { cookie, user } = await newUser();
    expect((await call(adminLimits, 'GET', '/api/admin/limits', { cookie })).status).toBe(403);
    expect((await call(putLimits, 'PUT', '/api/admin/limits', { cookie, body: DEFAULT_LIMITS })).status).toBe(403);
    expect((await call(putUser, 'PUT', `/api/admin/users/${user.id}`, { cookie, params: { id: user.id }, body: { plan: 'titan' } })).status).toBe(403);
    expect((await call(adminLimits, 'GET', '/api/admin/limits')).status).toBe(401);
    expect((await call(adminUsers, 'GET', '/api/admin/users', { cookie })).status).toBe(403);
  });

  it('lets an admin change limits, plans and per-user quotas, which then apply to requests', async () => {
    const admin = await newUser('admin@example.com');
    await makeAdmin(admin.user.id);
    const member = await newUser('member@example.com');

    const bad = await call(putLimits, 'PUT', '/api/admin/limits', { cookie: admin.cookie, body: { ...DEFAULT_LIMITS, requestsPerMinute: -1 } });
    expect(bad.status).toBe(400);

    const next = { ...DEFAULT_LIMITS, planMonthlyCredits: { ...DEFAULT_LIMITS.planMonthlyCredits, starter: 0 } };
    expect((await call(putLimits, 'PUT', '/api/admin/limits', { cookie: admin.cookie, body: next })).status).toBe(200);
    expect((await (await call(adminLimits, 'GET', '/api/admin/limits', { cookie: admin.cookie })).json()).limits.planMonthlyCredits.starter).toBe(0);

    // Starter now has 0 credits: analysis is blocked before Groq is called.
    const blocked = await call(analyze, 'POST', '/api/ai/analyze', { cookie: member.cookie, body: { transcript: TRANSCRIPT } });
    expect(blocked.status).toBe(402);
    expect(groq.calls).toHaveLength(0);

    // Moving the member to Pro lifts the limit...
    const params = { id: member.user.id };
    const upgraded = await (await call(putUser, 'PUT', `/api/admin/users/${member.user.id}`, { cookie: admin.cookie, params, body: { plan: 'pro' } })).json();
    expect(upgraded.limits.monthlyCredits).toBe(100);
    groq.enqueue({ kind: 'json', content: ANALYSIS });
    expect((await call(analyze, 'POST', '/api/ai/analyze', { cookie: member.cookie, body: { transcript: TRANSCRIPT } })).status).toBe(201);

    // ...and a per-user override takes precedence over the plan.
    const capped = await (await call(putUser, 'PUT', `/api/admin/users/${member.user.id}`, { cookie: admin.cookie, params, body: { monthlyCredits: 1 } })).json();
    expect(capped).toMatchObject({ limits: { monthlyCredits: 1 }, creditsUsedThisMonth: 1 });
    expect((await call(analyze, 'POST', '/api/ai/analyze', { cookie: member.cookie, body: { transcript: TRANSCRIPT } })).status).toBe(402);

    const cleared = await (await call(putUser, 'PUT', `/api/admin/users/${member.user.id}`, { cookie: admin.cookie, params, body: { monthlyCredits: null } })).json();
    expect(cleared.limits.monthlyCredits).toBe(100);
    expect((await call(adminUser, 'GET', `/api/admin/users/${member.user.id}`, { cookie: admin.cookie, params })).status).toBe(200);

    // The account list shows plan and this month's credits, and its search treats % and _ literally.
    const all = await (await call(adminUsers, 'GET', '/api/admin/users', { cookie: admin.cookie })).json();
    expect(all.items.map((u: any) => u.email).sort()).toEqual(['admin@example.com', 'member@example.com']);
    expect(all.items.find((u: any) => u.email === 'member@example.com')).toMatchObject({ plan: 'pro', creditsUsedThisMonth: 1, monthlyCreditsOverride: null });
    expect(JSON.stringify(all)).not.toMatch(/passwordHash|scrypt/);
    const found = await (await call(adminUsers, 'GET', '/api/admin/users?q=MEMBER', { cookie: admin.cookie })).json();
    expect(found.items).toHaveLength(1);
    const wild = await (await call(adminUsers, 'GET', '/api/admin/users?q=%25', { cookie: admin.cookie })).json();
    expect(wild.items).toHaveLength(0);
  });
});
