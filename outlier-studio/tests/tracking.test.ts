import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { GET as listChannelsRoute, POST as addChannelRoute } from '@/app/api/channels/route';
import { DELETE as removeChannelRoute } from '@/app/api/channels/[id]/route';
import { POST as refreshRoute } from '@/app/api/channels/[id]/refresh/route';
import { GET as videosRoute } from '@/app/api/videos/route';
import { GET as videoRoute } from '@/app/api/videos/[id]/route';
import { POST as cronRoute } from '@/app/api/cron/refresh/route';
import { POST as analyze } from '@/app/api/ai/analyze/route';
import { getDb } from '@/server/db/client';
import { channels, channelSnapshots, generations, videos, videoSnapshots } from '@/server/db/schema';
import { DEFAULT_LIMITS, setLimits } from '@/server/settings';
import { baselineViews, median, outlierMultiple, viewsPerHour } from '@/server/video/metrics';
import { refreshDue } from '@/server/video/tracking';
import { parseIsoDuration, parseYouTubeInput } from '@/shared/youtube-url';
import { TRANSCRIPT, call, newUser, requestRows, useTestApp } from './support/app';
import { FakeYouTube, sampleChannel } from './support/fake-youtube';

const groq = useTestApp();
const youtube = new FakeYouTube();

beforeAll(async () => {
  process.env.YOUTUBE_API_BASE_URL = await youtube.start();
});
beforeEach(() => {
  youtube.reset();
  process.env.YOUTUBE_API_KEY = 'yt_test_key';
  delete process.env.CRON_SECRET;
  delete process.env.TRACK_INTERVAL_HOURS;
});
afterAll(() => youtube.stop());

const add = (cookie: string, url: string) => call(addChannelRoute, 'POST', '/api/channels', { cookie, body: { url } });
const feed = async (cookie: string, query = '') => (await call(videosRoute, 'GET', `/api/videos${query}`, { cookie })).json();
const myChannels = async (cookie: string) => (await call(listChannelsRoute, 'GET', '/api/channels', { cookie })).json();

/** Pretend the last check happened this many hours ago. */
async function ageChecks(hours: number) {
  const db = await getDb();
  const shift = sql`- interval '${sql.raw(String(hours))} hours'`;
  await db.update(channels).set({ lastCheckedAt: sql`${channels.lastCheckedAt} ${shift}` });
  await db.update(channelSnapshots).set({ takenAt: sql`${channelSnapshots.takenAt} ${shift}` });
  await db.update(videoSnapshots).set({ takenAt: sql`${videoSnapshots.takenAt} ${shift}` });
}

describe('link parsing', () => {
  it('recognises channel, handle and video links', () => {
    const ok = (s: string) => {
      const r = parseYouTubeInput(s);
      if (!r.ok) throw new Error(`${s}: ${r.reason}`);
      return r.ref;
    };
    expect(ok('https://www.youtube.com/@runfaster')).toEqual({ kind: 'handle', handle: '@runfaster' });
    expect(ok('youtube.com/@runfaster/shorts')).toEqual({ kind: 'handle', handle: '@runfaster' });
    expect(ok('@runfaster')).toEqual({ kind: 'handle', handle: '@runfaster' });
    expect(ok('https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa')).toEqual({ kind: 'channelId', id: 'UCaaaaaaaaaaaaaaaaaaaaaa' });
    expect(ok('UCaaaaaaaaaaaaaaaaaaaaaa')).toEqual({ kind: 'channelId', id: 'UCaaaaaaaaaaaaaaaaaaaaaa' });
    expect(ok('https://www.youtube.com/user/oldname')).toEqual({ kind: 'username', username: 'oldname' });
    expect(ok('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toEqual({ kind: 'video', videoId: 'dQw4w9WgXcQ' });
    expect(ok('https://youtu.be/dQw4w9WgXcQ?si=abc')).toEqual({ kind: 'video', videoId: 'dQw4w9WgXcQ' });
    expect(ok('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ kind: 'video', videoId: 'dQw4w9WgXcQ' });
  });

  it('explains what is wrong with links it cannot use', () => {
    const reason = (s: string) => {
      const r = parseYouTubeInput(s);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason('https://www.tiktok.com/@someone')).toMatch(/TikTok and Instagram are not supported/);
    expect(reason('https://www.instagram.com/reel/abc/')).toMatch(/not supported/);
    expect(reason('https://www.youtube.com/c/LegacyName')).toMatch(/@handle/);
    expect(reason('https://evil.example/youtube.com/@x')).toMatch(/does not look like/);
    expect(reason('https://www.youtube.com/')).toMatch(/home page/);
    expect(reason('hello world')).toMatch(/does not look like/);
    expect(reason('')).toMatch(/Paste/);
  });

  it('parses durations', () => {
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('PT1M5S')).toBe(65);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('P0D')).toBe(0);
    expect(parseIsoDuration('nonsense')).toBeNull();
  });
});

describe('metrics', () => {
  const day = (n: number) => new Date(Date.now() - n * 86_400_000);
  it('computes median, baseline, multiple and momentum', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(3);
    // Fresh uploads are ignored once there are five settled videos.
    const settled = [100, 100, 100, 100, 100].map((viewCount) => ({ viewCount, publishedAt: day(3) }));
    expect(baselineViews([...settled, { viewCount: 2, publishedAt: day(0.1) }])).toBe(100);
    expect(baselineViews([{ viewCount: 50, publishedAt: day(0.1) }, { viewCount: null, publishedAt: day(4) }])).toBe(50);
    expect(outlierMultiple(1500, 100)).toBe(15);
    expect(outlierMultiple(null, 100)).toBeNull();
    expect(outlierMultiple(100, 0)).toBeNull();
    const now = new Date();
    expect(viewsPerHour({ viewCount: 1000, takenAt: new Date(now.getTime() - 2 * 3_600_000) }, 4000, now)).toBe(1500);
    expect(viewsPerHour({ viewCount: 1000, takenAt: new Date(now.getTime() - 60_000) }, 4000, now)).toBeNull();
    expect(viewsPerHour(undefined, 4000, now)).toBeNull();
    // A count that went down (YouTube removing views) is reported as zero, not negative.
    expect(viewsPerHour({ viewCount: 5000, takenAt: new Date(now.getTime() - 3_600_000) }, 4000, now)).toBe(0);
  });
});

describe('tracking a competitor', () => {
  it('adds a channel from its handle, pulls its uploads and ranks them against the channel norm', async () => {
    const { cookie } = await newUser();
    youtube.add(sampleChannel());
    const res = await add(cookie, 'https://www.youtube.com/@runfaster');
    expect(res.status).toBe(201);
    expect(youtube.calls.every((c) => c.params.key === 'yt_test_key')).toBe(true);
    // One lookup, one uploads list, one batch of video details.
    expect(youtube.calls.map((c) => c.resource)).toEqual(['channels', 'playlistItems', 'videos']);

    const mine = await myChannels(cookie);
    expect(mine).toMatchObject({ configured: true, intervalHours: 6, limit: 200 });
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ title: 'Run Faster', handle: '@runfaster', subscriberCount: 52000, medianShortViews: 10000, medianLongViews: 30000, uploadsLast7Days: 6, subscribersGained: 0, lastError: null });

    const shorts = await feed(cookie);
    expect(shorts.items).toHaveLength(9);
    expect(shorts.items[0]).toMatchObject({ title: 'Why stretching before a run slows you down', isShort: true, viewCount: 150000, outlierMultiple: 15, viewsPerHour: null, channelTitle: 'Run Faster' });
    const long = await feed(cookie, '?type=long&days=all&sort=views');
    expect(long.items.map((v: any) => v.title)).toEqual(['Full marathon training plan', 'Shoe review']);
    expect(long.items[0].outlierMultiple).toBe(1.3);
    expect((await feed(cookie, '?days=7')).items.length).toBeLessThan(9);
    expect(JSON.stringify(shorts)).not.toContain('yt_test_key');
  });

  it('filters videos by keywords, ranges, engagement, age and analysis status', async () => {
    const { cookie } = await newUser();
    youtube.add(sampleChannel());
    expect((await add(cookie, 'https://www.youtube.com/@runfaster')).status).toBe(201);
    const titles = async (q: string) => (await feed(cookie, `?type=all&days=all&${q}`)).items.map((v: any) => v.title).sort();

    expect(await titles('q=STRETCHING')).toEqual(['Why stretching before a run slows you down']);
    expect(await titles('q=%25')).toEqual([]);
    expect(await titles('minOutlier=2')).toEqual(['Why stretching before a run slows you down']);
    expect(await titles('minViews=30000')).toEqual(['Full marathon training plan', 'Why stretching before a run slows you down']);
    expect(await titles('minViews=15000&maxViews=30000')).toEqual(['Shoe review']);
    // Likes plus comments over views: the stretching video is 6.3%, the long ones 4.1% and 3.3%.
    expect(await titles('minEngagement=6')).toEqual(['Why stretching before a run slows you down']);
    expect(await titles('maxEngagement=4.5')).toEqual(['Full marathon training plan', 'Shoe review']);
    expect(await titles('withinDays=1')).toEqual([]);
    expect(await titles('withinDays=2')).toContain('Why stretching before a run slows you down');
    expect(await titles('status=analyzed')).toEqual([]);
    const unanalyzed = (await feed(cookie, '?type=all&days=all&status=unanalyzed')).items;
    expect(unanalyzed).toHaveLength(11);
    expect(unanalyzed.every((v: any) => v.analyzed === false)).toBe(true);
    expect((await feed(cookie, '?type=all&days=all&sort=engagement')).items[0].title).toBe('Why stretching before a run slows you down');
  });

  it('finds the channel from a video link and does not add it twice', async () => {
    const { cookie } = await newUser();
    youtube.add(sampleChannel());
    expect((await add(cookie, 'https://www.youtube.com/shorts/a0000000050')).status).toBe(201);
    const again = await add(cookie, '@runfaster');
    expect(again.status).toBe(200);
    expect((await again.json()).alreadyTracked).toBe(true);
    expect((await myChannels(cookie)).items).toHaveLength(1);
    const db = await getDb();
    expect(await db.select().from(videos)).toHaveLength(11);
  });

  it('rejects unusable links without spending quota, and unknown channels with a clear message', async () => {
    const { cookie } = await newUser();
    const tiktok = await add(cookie, 'https://www.tiktok.com/@someone');
    expect(tiktok.status).toBe(400);
    expect((await tiktok.json()).error).toMatchObject({ code: 'invalid_link', message: expect.stringMatching(/TikTok/) });
    expect(youtube.calls).toHaveLength(0);
    const missing = await add(cookie, '@nobodyhere');
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe('channel_not_found');
    expect((await call(addChannelRoute, 'POST', '/api/channels', { body: { url: '@runfaster' } })).status).toBe(401);
  });

  it('measures momentum and subscriber growth between checks', async () => {
    const { cookie } = await newUser();
    const channel = youtube.add(sampleChannel());
    await add(cookie, '@runfaster');
    const id = (await myChannels(cookie)).items[0].id;

    // Checking again straight away is refused, so clicks cannot burn quota.
    const tooSoon = await call(refreshRoute, 'POST', `/api/channels/${id}/refresh`, { cookie, params: { id } });
    expect(tooSoon.status).toBe(429);
    expect((await tooSoon.json()).error.code).toBe('checked_recently');

    await ageChecks(2);
    channel.subscribers = 53500;
    channel.videos.find((v) => v.id === 'a0000000050')!.views = 170000;
    channel.videos.push({ id: 'a0000000099', title: 'Brand new upload', publishedAt: new Date().toISOString(), duration: 'PT30S', views: 500 });
    expect((await call(refreshRoute, 'POST', `/api/channels/${id}/refresh`, { cookie, params: { id } })).status).toBe(200);

    const [mine] = (await myChannels(cookie)).items;
    expect(mine).toMatchObject({ subscriberCount: 53500, subscribersGained: 1500, uploadsLast7Days: 7 });
    const byMomentum = await feed(cookie, '?sort=momentum');
    expect(byMomentum.items[0].title).toBe('Why stretching before a run slows you down');
    expect(byMomentum.items[0].viewsPerHour).toBeGreaterThan(9900);
    expect(byMomentum.items[0].viewsPerHour).toBeLessThan(10100);
    expect(byMomentum.items[0].outlierMultiple).toBe(17);
    const fresh = byMomentum.items.find((v: any) => v.title === 'Brand new upload');
    expect(fresh).toMatchObject({ viewsPerHour: null, viewCount: 500 });

    const detail = await (await call(videoRoute, 'GET', `/api/videos/${byMomentum.items[0].id}`, { cookie, params: { id: byMomentum.items[0].id } })).json();
    expect(detail.history.map((h: any) => h.viewCount)).toEqual([150000, 170000]);
    expect(detail.video).toMatchObject({ channelMedianViews: 10000, externalId: 'a0000000050' });
  });

  it('handles hidden subscriber counts and hidden view counts', async () => {
    const { cookie } = await newUser();
    const channel = sampleChannel();
    channel.hiddenSubscribers = true;
    channel.videos[0]!.views = undefined;
    youtube.add(channel);
    await add(cookie, '@runfaster');
    expect((await myChannels(cookie)).items[0]).toMatchObject({ subscriberCount: null, subscribersGained: null });
    const hidden = (await feed(cookie, '?sort=recent')).items.find((v: any) => v.title === 'Running tip 1');
    expect(hidden).toMatchObject({ viewCount: null, outlierMultiple: null });
  });
});

describe('tracking limits and failures', () => {
  it('enforces the per-account channel limit', async () => {
    const admin = await newUser('limits@example.com');
    await setLimits(await getDb(), { ...DEFAULT_LIMITS, trackedChannelsPerUser: 1 }, admin.user.id);
    const { cookie } = await newUser();
    youtube.add(sampleChannel());
    youtube.add(sampleChannel('UCbbbbbbbbbbbbbbbbbbbbbb', '@other', 'b'));
    expect((await add(cookie, '@runfaster')).status).toBe(201);
    const second = await add(cookie, '@other');
    expect(second.status).toBe(403);
    expect((await second.json()).error.code).toBe('channel_limit');
  });

  it('says so when no YouTube key is set, and when the key is rejected', async () => {
    const { cookie } = await newUser();
    delete process.env.YOUTUBE_API_KEY;
    const none = await add(cookie, '@runfaster');
    expect(none.status).toBe(503);
    expect((await none.json()).error.code).toBe('video_data_not_configured');
    expect((await myChannels(cookie)).configured).toBe(false);
    expect(youtube.calls).toHaveLength(0);

    process.env.YOUTUBE_API_KEY = 'yt_test_key';
    youtube.failNext = { status: 400, reason: 'badRequest', message: 'API key not valid. Please pass a valid API key.' };
    const bad = await add(cookie, '@runfaster');
    expect(bad.status).toBe(503);
    expect(JSON.stringify(await bad.json())).not.toContain('yt_test_key');
  });

  it('reports an exhausted quota and records it on the channel', async () => {
    const { cookie } = await newUser();
    youtube.add(sampleChannel());
    youtube.failNext = { status: 403, reason: 'quotaExceeded' };
    const blocked = await add(cookie, '@runfaster');
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe('video_data_quota');

    await add(cookie, '@runfaster');
    const id = (await myChannels(cookie)).items[0].id;
    await ageChecks(1);
    youtube.failNext = { status: 403, reason: 'quotaExceeded' };
    const refresh = await call(refreshRoute, 'POST', `/api/channels/${id}/refresh`, { cookie, params: { id } });
    expect(refresh.status).toBe(429);
    expect((await myChannels(cookie)).items[0].lastError).toMatch(/quota/);
  });
});

describe('scheduled checks', () => {
  it('checks only channels that are due, and clears old errors on success', async () => {
    const { cookie } = await newUser();
    youtube.add(sampleChannel());
    youtube.add(sampleChannel('UCbbbbbbbbbbbbbbbbbbbbbb', '@other', 'b'));
    await add(cookie, '@runfaster');
    await add(cookie, '@other');
    expect(await refreshDue()).toEqual({ checked: 0, stoppedEarly: false });

    const db = await getDb();
    await db.update(channels).set({ lastCheckedAt: sql`now() - interval '7 hours'`, lastError: 'old problem' }).where(eq(channels.handle, '@other'));
    youtube.calls = [];
    expect(await refreshDue()).toEqual({ checked: 1, stoppedEarly: false });
    expect(youtube.calls.map((c) => c.resource)).toEqual(['channels', 'playlistItems', 'videos']);
    const [other] = await db.select().from(channels).where(eq(channels.handle, '@other'));
    expect(other!.lastError).toBeNull();
    expect(Date.now() - other!.lastCheckedAt!.getTime()).toBeLessThan(60_000);
  });

  it('stops early when the quota runs out, and skips channels nobody tracks', async () => {
    const a = await newUser();
    youtube.add(sampleChannel());
    youtube.add(sampleChannel('UCbbbbbbbbbbbbbbbbbbbbbb', '@other', 'b'));
    await add(a.cookie, '@runfaster');
    await add(a.cookie, '@other');
    await ageChecks(7);
    youtube.failNext = { status: 403, reason: 'quotaExceeded' };
    expect(await refreshDue()).toEqual({ checked: 1, stoppedEarly: true });
  });

  it('protects the cron endpoint with a secret', async () => {
    expect((await call(cronRoute, 'POST', '/api/cron/refresh', { headers: { authorization: 'Bearer anything' } })).status).toBe(404);
    process.env.CRON_SECRET = 'a-long-random-secret-value';
    expect((await call(cronRoute, 'POST', '/api/cron/refresh')).status).toBe(401);
    expect((await call(cronRoute, 'POST', '/api/cron/refresh', { headers: { authorization: 'Bearer wrong-secret-value-here!!' } })).status).toBe(401);
    const ok = await call(cronRoute, 'POST', '/api/cron/refresh', { headers: { authorization: 'Bearer a-long-random-secret-value' } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ checked: 0, stoppedEarly: false });
  });
});

describe('tracking data is private to each account', () => {
  it('hides channels and videos from accounts that do not track them', async () => {
    const alice = await newUser('alice@example.com');
    const bob = await newUser('bob@example.com');
    youtube.add(sampleChannel());
    await add(alice.cookie, '@runfaster');
    const channelId = (await myChannels(alice.cookie)).items[0].id;
    const videoId = (await feed(alice.cookie)).items[0].id;

    expect((await myChannels(bob.cookie)).items).toEqual([]);
    expect((await feed(bob.cookie, '?days=all&type=all')).items).toEqual([]);
    expect((await feed(bob.cookie, `?channelId=${channelId}&days=all&type=all`)).items).toEqual([]);
    expect((await call(videoRoute, 'GET', `/api/videos/${videoId}`, { cookie: bob.cookie, params: { id: videoId } })).status).toBe(404);
    expect((await call(refreshRoute, 'POST', `/api/channels/${channelId}/refresh`, { cookie: bob.cookie, params: { id: channelId } })).status).toBe(404);
    expect((await call(removeChannelRoute, 'DELETE', `/api/channels/${channelId}`, { cookie: bob.cookie, params: { id: channelId } })).status).toBe(404);

    // Bob cannot analyse Alice's tracked video, and nothing is sent to Groq.
    const stolen = await call(analyze, 'POST', '/api/ai/analyze', { cookie: bob.cookie, body: { transcript: TRANSCRIPT, videoId } });
    expect(stolen.status).toBe(404);
    expect(groq.calls).toHaveLength(0);
  });

  it('keeps a shared channel until its last tracker removes it', async () => {
    const alice = await newUser('alice@example.com');
    const bob = await newUser('bob@example.com');
    youtube.add(sampleChannel());
    await add(alice.cookie, '@runfaster');
    youtube.calls = [];
    await add(bob.cookie, '@runfaster');
    // Already known: one lookup to resolve the link, no second download of its videos.
    expect(youtube.calls.map((c) => c.resource)).toEqual(['channels']);
    const id = (await myChannels(alice.cookie)).items[0].id;

    expect((await call(removeChannelRoute, 'DELETE', `/api/channels/${id}`, { cookie: alice.cookie, params: { id } })).status).toBe(200);
    expect((await myChannels(alice.cookie)).items).toEqual([]);
    expect((await feed(bob.cookie)).items).toHaveLength(9);

    expect((await call(removeChannelRoute, 'DELETE', `/api/channels/${id}`, { cookie: bob.cookie, params: { id } })).status).toBe(200);
    const db = await getDb();
    expect(await db.select().from(channels)).toHaveLength(0);
    expect(await db.select().from(videos)).toHaveLength(0);
    expect(await db.select().from(videoSnapshots)).toHaveLength(0);
  });
});

describe('analysing a tracked video', () => {
  const ANALYSIS = JSON.stringify({
    summary: 's', hook: { text: 'h', pattern: 'p', whyItWorks: 'w' }, format: 'f',
    structure: [], storytellingTactics: [], topics: [], takeaways: [], remixIdeas: [],
  });

  it('takes the title and numbers from the tracked video, not from the request, and links the result', async () => {
    const { cookie, user } = await newUser();
    youtube.add(sampleChannel());
    await add(cookie, '@runfaster');
    const video = (await feed(cookie)).items[0];
    groq.enqueue({ kind: 'json', content: ANALYSIS });
    const res = await call(analyze, 'POST', '/api/ai/analyze', {
      cookie,
      body: { transcript: TRANSCRIPT, videoId: video.id, views: 999_999_999, channelMedianViews: 1, title: 'Spoofed title' },
    });
    expect(res.status).toBe(201);
    const { generation } = await res.json();
    expect(generation).toMatchObject({ title: 'Why stretching before a run slows you down', videoId: video.id });
    expect(generation.output.outlierMultiple).toBe(15);
    expect(generation.input.sourceUrl).toBe('https://www.youtube.com/shorts/a0000000050');
    expect(groq.calls[0]!.body.messages[1].content).toContain('150000 views, 15x');

    const detail = await (await call(videoRoute, 'GET', `/api/videos/${video.id}`, { cookie, params: { id: video.id } })).json();
    expect(detail.analyses).toEqual([expect.objectContaining({ id: generation.id })]);
    expect(await requestRows(user.id)).toHaveLength(1);

    // Untracking the channel keeps the saved analysis; it just loses its link to the video.
    const channelId = (await myChannels(cookie)).items[0].id;
    await call(removeChannelRoute, 'DELETE', `/api/channels/${channelId}`, { cookie, params: { id: channelId } });
    const db = await getDb();
    const [kept] = await db.select().from(generations).where(eq(generations.id, generation.id));
    expect(kept).toMatchObject({ videoId: null, title: 'Why stretching before a run slows you down' });
  });
});
