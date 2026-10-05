import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { channels, generations, trackedChannels, videos } from '../../db/schema';
import { AppError, notFound } from '../../errors';
import { saveGeneration } from '../../generations';
import { generateJson } from '../service';
import { DATA_RULE, quote } from './shared';

export const ReportInput = z.object({ channelId: z.string().uuid() });

const Output = z.object({
  summary: z.string(),
  whatIsWorking: z.array(z.object({ pattern: z.string(), evidence: z.string() })),
  whatIsNot: z.array(z.string()),
  topics: z.array(z.object({ topic: z.string(), note: z.string() })),
  titlePatterns: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const SYSTEM = `You write a content strategy report about one video channel for a creator who competes with it (or owns it).
You are given the channel's numbers and a list of its recent videos with their title, length, age, views and how each compares with the channel's normal ("multiple").

Produce:
- summary: three sentences on what this channel is doing and how it is going.
- whatIsWorking: 3 to 5 patterns shared by the videos with the highest multiples. For each, name the pattern and cite the videos that show it, by title and multiple.
- whatIsNot: 1 to 3 patterns shared by the weakest videos.
- topics: the 3 to 6 subjects the channel returns to, each with a note on how they perform.
- titlePatterns: 2 to 5 title structures the best videos use, written as reusable templates.
- recommendations: 3 to 5 specific things the reader should try on their own channel, each tied to evidence above.

Only use the data given. Do not invent view counts, dates or videos. If there is too little data for a section, say so in that section instead of guessing.
${DATA_RULE}`;

const DAY = 86_400_000;

export async function writeChannelReport(userId: string, channelId: string) {
  const db = await getDb();
  const [channel] = await db
    .select({ id: channels.id, title: channels.title, platform: channels.platform, subscriberCount: channels.subscriberCount, medianShortViews: channels.medianShortViews, medianLongViews: channels.medianLongViews, isOwn: trackedChannels.isOwn })
    .from(channels)
    .innerJoin(trackedChannels, and(eq(trackedChannels.channelId, channels.id), eq(trackedChannels.userId, userId)))
    .where(eq(channels.id, channelId))
    .limit(1);
  if (!channel) throw notFound();

  const recent = await db
    .select({ title: videos.title, publishedAt: videos.publishedAt, durationSeconds: videos.durationSeconds, isShort: videos.isShort, viewCount: videos.viewCount, likeCount: videos.likeCount, commentCount: videos.commentCount, outlierMultiple: videos.outlierMultiple })
    .from(videos)
    .where(eq(videos.channelId, channelId))
    .orderBy(desc(videos.publishedAt))
    .limit(50);
  if (recent.length < 5) throw new AppError(422, 'not_enough_videos', 'A report needs at least five videos from this channel.');

  // Hooks from the user's own breakdowns of this channel's videos add evidence beyond titles.
  const analysed = await db
    .select({ title: generations.title, output: generations.output })
    .from(generations)
    .innerJoin(videos, eq(videos.id, generations.videoId))
    .where(and(eq(generations.userId, userId), eq(generations.kind, 'analysis'), eq(videos.channelId, channelId)))
    .orderBy(desc(generations.createdAt))
    .limit(10);

  // Facts are computed here; the model only interprets them.
  const now = Date.now();
  const last30 = recent.filter((v) => now - v.publishedAt.getTime() <= 30 * DAY).length;
  const lines = recent.map((v) => {
    const age = Math.max(0, Math.round((now - v.publishedAt.getTime()) / DAY));
    return `- "${v.title.replaceAll('"', "'")}" | ${v.isShort ? 'short' : 'long'}${v.durationSeconds ? ` ${v.durationSeconds}s` : ''} | ${age}d ago | ${v.viewCount ?? 'hidden'} views | ${v.outlierMultiple ?? 'n/a'}x`;
  });
  const hooks = analysed.flatMap((a) => {
    const hook = (a.output as { hook?: { text?: string } }).hook?.text;
    return hook ? [`- "${a.title.replaceAll('"', "'")}": ${hook}`] : [];
  });

  const facts = {
    subscribers: channel.subscriberCount,
    uploadsInLast30Days: last30,
    typicalShortViews: channel.medianShortViews,
    typicalLongViews: channel.medianLongViews,
    videosConsidered: recent.length,
  };
  const prompt = [
    `Channel: ${channel.title} (${channel.platform}). ${channel.isOwn ? 'This is the reader\'s own channel.' : 'This is a competitor of the reader.'}`,
    `Subscribers: ${facts.subscribers ?? 'hidden'}. Uploads in the last 30 days: ${last30}. Typical views: ${facts.typicalShortViews ?? 'n/a'} for shorts, ${facts.typicalLongViews ?? 'n/a'} for long videos.`,
    quote('videos', lines.join('\n')),
    hooks.length ? quote('opening_lines', hooks.join('\n')) : '',
  ];

  const result = await generateJson({
    userId,
    feature: 'report',
    tier: 'quality',
    system: SYSTEM,
    prompt: prompt.filter(Boolean).join('\n\n'),
    schemaName: 'channel_report',
    schema: Output,
    temperature: 0.3,
  });

  const generation = await saveGeneration({
    userId,
    kind: 'report',
    title: `Report: ${channel.title}`,
    input: { channelId, channelTitle: channel.title },
    output: { ...result.data, facts, isOwn: channel.isOwn },
    requestId: result.requestId,
    channelId,
  });
  return { generation, usage: result.usage, requestId: result.requestId };
}
