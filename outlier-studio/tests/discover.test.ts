import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GET as discoverRoute } from '@/app/api/discover/route';
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
  process.env.YOUTUBE_API_KEY = '';
});

afterAll(() => apify.stop());

describe('Instagram discovery', () => {
  it('searches profiles through Apify and returns platform-aware, tiered accounts', async () => {
    apify.instagramSearches.set('running coaches Manila', [
      {
        username: 'Run.Coach.PH',
        fullName: 'Run Coach PH',
        followersCount: 42_500,
        postsCount: 318,
        profilePicUrlHD: 'https://cdn.example/run-coach.jpg',
      },
    ]);
    const { cookie } = await newUser();
    const res = await call(discoverRoute, 'GET', '/api/discover?q=running%20coaches%20Manila&platform=instagram&tier=micro', { cookie });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      platform: 'instagram',
      query: 'running coaches Manila',
      items: [{
        platform: 'instagram',
        externalId: 'run.coach.ph',
        title: 'Run Coach PH',
        handle: '@run.coach.ph',
        subscriberCount: 42_500,
        videoCount: 318,
        tier: 'micro',
      }],
    });
    expect(apify.calls.at(-1)).toMatchObject({
      actor: 'apify~instagram-search-scraper',
      input: { search: 'running coaches Manila', searchType: 'user', searchLimit: 25, enhanceUserSearchWithFacebookPage: false },
      key: APIFY_TOKEN,
    });
  });

  it('reports a missing Apify token without running a search', async () => {
    delete process.env.APIFY_TOKEN;
    const { cookie } = await newUser();
    const res = await call(discoverRoute, 'GET', '/api/discover?q=fitness&platform=instagram', { cookie });

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('video_data_not_configured');
    expect(apify.calls).toHaveLength(0);
  });
});
