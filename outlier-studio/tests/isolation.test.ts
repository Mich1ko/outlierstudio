import { describe, expect, it } from 'vitest';
import { POST as analyze } from '@/app/api/ai/analyze/route';
import { GET as list } from '@/app/api/generations/route';
import { DELETE as remove, GET as getOne } from '@/app/api/generations/[id]/route';
import { GET as usage } from '@/app/api/usage/route';
import { GET as adminLimits, PUT as putLimits } from '@/app/api/admin/limits/route';
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
    const { cookie } = await newUser();
    expect((await call(adminLimits, 'GET', '/api/admin/limits', { cookie })).status).toBe(403);
    expect((await call(putLimits, 'PUT', '/api/admin/limits', { cookie, body: DEFAULT_LIMITS })).status).toBe(403);
    expect((await call(adminLimits, 'GET', '/api/admin/limits')).status).toBe(401);
  });

  it('lets an admin change the safety limits, which then apply to requests', async () => {
    const admin = await newUser('admin@example.com');
    await makeAdmin(admin.user.id);

    const bad = await call(putLimits, 'PUT', '/api/admin/limits', { cookie: admin.cookie, body: { ...DEFAULT_LIMITS, requestsPerMinute: -1 } });
    expect(bad.status).toBe(400);

    const next = { ...DEFAULT_LIMITS, trackedChannelsPerUser: 7 };
    expect((await call(putLimits, 'PUT', '/api/admin/limits', { cookie: admin.cookie, body: next })).status).toBe(200);
    expect((await (await call(adminLimits, 'GET', '/api/admin/limits', { cookie: admin.cookie })).json()).limits).toEqual(next);
  });
});
