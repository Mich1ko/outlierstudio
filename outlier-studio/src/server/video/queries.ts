import 'server-only';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/client';
import { channels, channelSnapshots, generations, trackedChannels, videos, videoSnapshots } from '../db/schema';
import { env } from '../env';
import { notFound } from '../errors';
import { getLimits } from '../settings';
import { apifyBudgetUsd, apifyConfigured, apifySpendThisMonth } from './apify';
import { MONITORED_PLATFORMS, platformConfigured, platformStatus } from './platforms';

/**
 * Every query here joins through tracked_channels on the caller's user id, so
 * an account can only read channels and videos it tracks.
 */

const DAY = 86_400_000;

export async function listChannels(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: channels.id,
      platform: channels.platform,
      monitored: channels.monitored,
      isOwn: trackedChannels.isOwn,
      externalId: channels.externalId,
      title: channels.title,
      handle: channels.handle,
      thumbnailUrl: channels.thumbnailUrl,
      subscriberCount: channels.subscriberCount,
      videoCount: channels.videoCount,
      medianShortViews: channels.medianShortViews,
      medianLongViews: channels.medianLongViews,
      lastCheckedAt: channels.lastCheckedAt,
      lastError: channels.lastError,
      trackedSince: trackedChannels.createdAt,
    })
    .from(trackedChannels)
    .innerJoin(channels, eq(channels.id, trackedChannels.channelId))
    .where(eq(trackedChannels.userId, userId))
    .orderBy(desc(trackedChannels.isOwn), desc(channels.monitored), asc(channels.title));

  const weekAgo = new Date(Date.now() - 7 * DAY);
  const items = [];
  for (const row of rows) {
    // Growth is measured from the oldest check in the last 7 days, so it covers
    // "up to 7 days" and says how long it actually spans.
    const [baseline] = await db
      .select({ subscriberCount: channelSnapshots.subscriberCount, takenAt: channelSnapshots.takenAt })
      .from(channelSnapshots)
      .where(and(eq(channelSnapshots.channelId, row.id), gte(channelSnapshots.takenAt, weekAgo)))
      .orderBy(asc(channelSnapshots.takenAt))
      .limit(1);
    const [uploads] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(videos)
      .where(and(eq(videos.channelId, row.id), gte(videos.publishedAt, weekAgo)));
    const gained = row.subscriberCount !== null && baseline?.subscriberCount != null ? row.subscriberCount - baseline.subscriberCount : null;
    items.push({
      ...row,
      subscribersGained: gained,
      growthSince: baseline?.takenAt ?? null,
      uploadsLast7Days: uploads?.n ?? 0,
    });
  }

  return {
    items,
    configured: MONITORED_PLATFORMS.some(platformConfigured),
    platforms: platformStatus(),
    transcriptsConfigured: apifyConfigured(),
    apifyBudget: { spentUsd: await apifySpendThisMonth(), budgetUsd: apifyBudgetUsd() },
    intervalHours: env().TRACK_INTERVAL_HOURS,
    limit: (await getLimits(db)).trackedChannelsPerUser,
  };
}

export const VideoQuery = z.object({
  channelId: z.string().uuid().optional(),
  /** Whose videos: competitors (default), the user's own channels, or both. */
  scope: z.enum(['competitors', 'mine', 'all']).default('competitors'),
  platform: z.enum(['youtube', 'tiktok', 'instagram']).optional(),
  type: z.enum(['shorts', 'long', 'all']).default('shorts'),
  days: z.enum(['7', '30', '90', 'all']).default('30'),
  sort: z.enum(['outlier', 'momentum', 'recent', 'views', 'engagement']).default('outlier'),
  /** Overrides days when set: only videos posted in the last N days. */
  withinDays: z.coerce.number().int().min(1).max(3650).optional(),
  /** Words to find in the title or caption. */
  q: z.string().trim().max(100).optional(),
  minOutlier: z.coerce.number().min(0).optional(),
  maxOutlier: z.coerce.number().min(0).optional(),
  minViews: z.coerce.number().min(0).optional(),
  maxViews: z.coerce.number().min(0).optional(),
  /** Engagement rate in percent: likes plus comments over views. */
  minEngagement: z.coerce.number().min(0).optional(),
  maxEngagement: z.coerce.number().min(0).optional(),
  status: z.enum(['all', 'analyzed', 'unanalyzed']).default('all'),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

const videoColumns = {
  id: videos.id,
  externalId: videos.externalId,
  title: videos.title,
  publishedAt: videos.publishedAt,
  durationSeconds: videos.durationSeconds,
  isShort: videos.isShort,
  thumbnailUrl: videos.thumbnailUrl,
  viewCount: videos.viewCount,
  likeCount: videos.likeCount,
  commentCount: videos.commentCount,
  outlierMultiple: videos.outlierMultiple,
  viewsPerHour: videos.viewsPerHour,
  lastCheckedAt: videos.lastCheckedAt,
  sourceUrl: videos.sourceUrl,
  hasTranscript: sql<boolean>`${videos.transcript} is not null`,
  channelId: channels.id,
  channelTitle: channels.title,
  channelHandle: channels.handle,
  platform: channels.platform,
  monitored: channels.monitored,
};

const engagement = sql<number | null>`((coalesce(${videos.likeCount}, 0) + coalesce(${videos.commentCount}, 0))::float8 / nullif(${videos.viewCount}, 0) * 100)`;

export async function listVideos(userId: string, q: z.infer<typeof VideoQuery>) {
  const db = await getDb();
  const analyzed = sql<boolean>`exists (select 1 from ${generations} where ${generations.videoId} = ${videos.id} and ${generations.userId} = ${userId} and ${generations.kind} = 'analysis')`;
  const since = q.withinDays ?? (q.days === 'all' ? null : Number(q.days));
  const like = q.q ? `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const order = {
    engagement: sql`${engagement} desc nulls last`,
    outlier: sql`${videos.outlierMultiple} desc nulls last`,
    momentum: sql`${videos.viewsPerHour} desc nulls last`,
    views: sql`${videos.viewCount} desc nulls last`,
    recent: desc(videos.publishedAt),
  }[q.sort];

  const rows = await db
    .select({ ...videoColumns, analyzed })
    .from(videos)
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .innerJoin(trackedChannels, and(eq(trackedChannels.channelId, channels.id), eq(trackedChannels.userId, userId)))
    .where(
      and(
        like ? sql`(${videos.title} ilike ${like} or ${videos.description} ilike ${like})` : undefined,
        q.minOutlier !== undefined ? gte(videos.outlierMultiple, q.minOutlier) : undefined,
        q.maxOutlier !== undefined ? lte(videos.outlierMultiple, q.maxOutlier) : undefined,
        q.minViews !== undefined ? gte(videos.viewCount, q.minViews) : undefined,
        q.maxViews !== undefined ? lte(videos.viewCount, q.maxViews) : undefined,
        q.minEngagement !== undefined ? sql`${engagement} >= ${q.minEngagement}` : undefined,
        q.maxEngagement !== undefined ? sql`${engagement} <= ${q.maxEngagement}` : undefined,
        q.status === 'all' ? undefined : q.status === 'analyzed' ? analyzed : sql`not ${analyzed}`,
        q.channelId ? eq(videos.channelId, q.channelId) : undefined,
        q.scope === 'all' ? undefined : eq(trackedChannels.isOwn, q.scope === 'mine'),
        q.platform ? eq(channels.platform, q.platform) : undefined,
        q.type === 'all' ? undefined : eq(videos.isShort, q.type === 'shorts'),
        since === null ? undefined : gte(videos.publishedAt, new Date(Date.now() - since * DAY)),
      ),
    )
    .orderBy(order, desc(videos.publishedAt))
    .limit(q.limit + 1)
    .offset(q.offset);

  return { items: rows.slice(0, q.limit), nextOffset: rows.length > q.limit ? q.offset + q.limit : null };
}

/** A video the user tracks, or 404. Used wherever a video id comes from the client. */
export async function getTrackedVideo(userId: string, videoId: string) {
  const db = await getDb();
  const [video] = await db
    .select({
      ...videoColumns,
      description: videos.description,
      transcript: videos.transcript,
      channelExternalId: channels.externalId,
      medianShortViews: channels.medianShortViews,
      medianLongViews: channels.medianLongViews,
    })
    .from(videos)
    .innerJoin(channels, eq(channels.id, videos.channelId))
    .innerJoin(trackedChannels, and(eq(trackedChannels.channelId, channels.id), eq(trackedChannels.userId, userId)))
    .where(eq(videos.id, videoId))
    .limit(1);
  if (!video) throw notFound();
  return { ...video, channelMedianViews: video.isShort ? video.medianShortViews : video.medianLongViews };
}

export async function getVideoDetail(userId: string, videoId: string) {
  const video = await getTrackedVideo(userId, videoId);
  const db = await getDb();
  const history = await db
    .select({ takenAt: videoSnapshots.takenAt, viewCount: videoSnapshots.viewCount, likeCount: videoSnapshots.likeCount, commentCount: videoSnapshots.commentCount })
    .from(videoSnapshots)
    .where(eq(videoSnapshots.videoId, videoId))
    .orderBy(asc(videoSnapshots.takenAt))
    .limit(500);
  // The user's own breakdowns of this video, newest first. The newest is returned in full so the page can show it straight away.
  const analyses = await db
    .select()
    .from(generations)
    .where(and(eq(generations.videoId, videoId), eq(generations.userId, userId), eq(generations.kind, 'analysis')))
    .orderBy(desc(generations.createdAt))
    .limit(10);
  return {
    video,
    history,
    latestAnalysis: analyses[0] ?? null,
    analyses: analyses.map((a) => ({ id: a.id, title: a.title, createdAt: a.createdAt })),
    transcriptsConfigured: apifyConfigured(),
  };
}

/** Hooks pulled from the user's own video breakdowns, newest first, with the source video where it is still tracked. */
export async function listHookLibrary(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      generationId: generations.id,
      title: generations.title,
      output: generations.output,
      createdAt: generations.createdAt,
      videoId: videos.id,
      videoTitle: videos.title,
      viewCount: videos.viewCount,
      outlierMultiple: videos.outlierMultiple,
      channelTitle: channels.title,
      platform: channels.platform,
    })
    .from(generations)
    .leftJoin(videos, eq(videos.id, generations.videoId))
    .leftJoin(channels, eq(channels.id, videos.channelId))
    .where(and(eq(generations.userId, userId), eq(generations.kind, 'analysis')))
    .orderBy(desc(generations.createdAt))
    .limit(200);

  return rows.flatMap((r) => {
    const out = r.output as { hook?: { text?: string; pattern?: string; whyItWorks?: string }; format?: string };
    if (!out.hook?.text) return [];
    return [{
      generationId: r.generationId,
      title: r.title,
      createdAt: r.createdAt,
      hook: { text: out.hook.text, pattern: out.hook.pattern ?? '', whyItWorks: out.hook.whyItWorks ?? '' },
      format: out.format ?? '',
      video: r.videoId ? { id: r.videoId, title: r.videoTitle, viewCount: r.viewCount, outlierMultiple: r.outlierMultiple, channelTitle: r.channelTitle, platform: r.platform } : null,
    }];
  });
}
