import 'server-only';
import { eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { apifyRuns } from '../db/schema';
import { env } from '../env';
import { AppError } from '../errors';

/**
 * Client for Apify (https://docs.apify.com), which runs the scrapers that read
 * public video pages: YouTube captions, and the numbers of one TikTok or
 * Instagram video. Each call runs one Actor and returns its dataset items.
 * Apify bills each run against the account's monthly platform credit.
 *
 * The Actor ids and input fields below are the defaults this client was
 * written against. Each Actor's input page on apify.com is the reference;
 * override the Actor with APIFY_ACTOR_* if it has changed.
 */

const APIFY_API = 'https://api.apify.com';
/** Apify stops a synchronous run after this many seconds. */
const RUN_TIMEOUT_SECONDS = 120;

export const DEFAULT_ACTORS = {
  youtubeTranscript: 'devsef~youtube-transcript-scraper',
  tiktok: 'clockworks~tiktok-scraper',
  instagram: 'apify~instagram-reel-scraper',
} as const;
type ActorKind = keyof typeof DEFAULT_ACTORS;

export function apifyConfigured(): boolean {
  return Boolean(env().APIFY_TOKEN);
}

function baseUrl(): string {
  const e = env();
  return e.NODE_ENV === 'test' && e.APIFY_BASE_URL ? e.APIFY_BASE_URL : APIFY_API;
}

function actorId(kind: ActorKind): string {
  const e = env();
  const override = {
    youtubeTranscript: e.APIFY_ACTOR_YOUTUBE_TRANSCRIPT,
    tiktok: e.APIFY_ACTOR_TIKTOK,
    instagram: e.APIFY_ACTOR_INSTAGRAM,
  }[kind];
  return override || DEFAULT_ACTORS[kind];
}

const notConfigured = (message: string) => new AppError(503, 'transcripts_not_configured', message);

export type Item = Record<string, unknown>;

/**
 * Upper ends of the per-result prices on each Actor's Apify page at the time of
 * writing. The budget reserves at these prices, so an estimate never runs low.
 */
const PRICE_PER_RESULT_USD: Record<ActorKind, number> = {
  youtubeTranscript: 2 / 1000,
  tiktok: 1.7 / 1000,
  instagram: 1.5 / 1000,
};

/** Whatever APIFY_MONTHLY_BUDGET_USD says, this server never spends more than $5 in a month. */
const HARD_CAP_USD = 5;

export function apifyBudgetUsd(): number {
  return Math.min(env().APIFY_MONTHLY_BUDGET_USD, HARD_CAP_USD);
}

const monthStartUtc = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

/** Spend this calendar month (UTC). Runs with no known cost count at their reservation. */
export async function apifySpendThisMonth(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ spent: sql<number>`coalesce(sum(coalesce(${apifyRuns.costUsd}, ${apifyRuns.reservedUsd})), 0)::float8` })
    .from(apifyRuns)
    .where(gte(apifyRuns.createdAt, monthStartUtc()));
  return Number(row?.spent ?? 0);
}

/**
 * Reserves the most a run can cost, and refuses it if this month's spend plus
 * the reservation would pass the budget. The check runs under a lock so two
 * runs at once cannot both fit in the last dollar.
 */
async function reserve(kind: ActorKind, results: number): Promise<{ id: number; capUsd: number }> {
  const db = await getDb();
  const capUsd = Math.ceil(PRICE_PER_RESULT_USD[kind] * results * 1e6) / 1e6;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    const [row] = await tx
      .select({ spent: sql<number>`coalesce(sum(coalesce(${apifyRuns.costUsd}, ${apifyRuns.reservedUsd})), 0)::float8` })
      .from(apifyRuns)
      .where(gte(apifyRuns.createdAt, monthStartUtc()));
    const spent = Number(row?.spent ?? 0);
    const budget = apifyBudgetUsd();
    if (spent + capUsd > budget + 1e-9) {
      throw new AppError(402, 'apify_budget', `This server's Apify budget of $${budget} for the month is used up. Scraping resumes next month.`);
    }
    const [inserted] = await tx.insert(apifyRuns).values({ actor: actorId(kind), reservedUsd: capUsd }).returning({ id: apifyRuns.id });
    return { id: Number(inserted!.id), capUsd };
  });
}

async function finish(id: number, status: 'succeeded' | 'failed', costUsd: number | null): Promise<void> {
  const db = await getDb();
  await db.update(apifyRuns).set({ status, costUsd }).where(eq(apifyRuns.id, id));
}

/** Runs one Actor and returns the items it saved. An empty dataset is an empty list, not an error. */
export async function runActor(kind: ActorKind, input: Record<string, unknown>, results: number): Promise<Item[]> {
  if (!env().APIFY_TOKEN) throw notConfigured('Automatic transcripts and video numbers need an Apify token on the server.');
  const reservation = await reserve(kind, results);
  let items: Item[];
  try {
    items = await callActor(kind, input, reservation.capUsd);
  } catch (err) {
    await finish(reservation.id, 'failed', null);
    throw err;
  }
  await finish(reservation.id, 'succeeded', Math.min(reservation.capUsd, PRICE_PER_RESULT_USD[kind] * items.length));
  return items;
}

async function callActor(kind: ActorKind, input: Record<string, unknown>, capUsd: number): Promise<Item[]> {
  const token = env().APIFY_TOKEN!;

  // Apify uses "~" in place of "/" between the owner and the Actor name.
  const url = new URL(`${baseUrl()}/v2/acts/${actorId(kind).replace('/', '~')}/run-sync-get-dataset-items`);
  url.searchParams.set('timeout', String(RUN_TIMEOUT_SECONDS));
  // Apify stops the run once it has spent this much, so a run can never exceed its reservation.
  url.searchParams.set('maxTotalChargeUsd', capUsd.toFixed(6));

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((RUN_TIMEOUT_SECONDS + 15) * 1000),
    });
  } catch {
    // The URL is not logged: it names the Actor, and the token is in a header, but errors can echo URLs.
    throw new AppError(503, 'transcripts_unavailable', 'The scraping service could not be reached. Please try again shortly.');
  }

  const body = (await res.json().catch(() => null)) as unknown;
  if (res.ok) return Array.isArray(body) ? (body as Item[]) : [];

  if (res.status === 401 || res.status === 403) {
    throw notConfigured('The Apify token was rejected. Check APIFY_TOKEN in the server settings.');
  }
  if (res.status === 402) {
    throw new AppError(402, 'transcript_plan_limit', 'The Apify plan on this server does not cover this request.');
  }
  if (res.status === 404) {
    throw notConfigured(`The Apify Actor ${actorId(kind)} was not found. Check the Actor name in the server settings.`);
  }
  if (res.status === 429) {
    throw new AppError(429, 'transcript_quota', "Apify is limiting requests right now. You can paste a transcript in instead.");
  }
  if (res.status === 408 || res.status === 504) {
    throw new AppError(504, 'transcript_timeout', 'The scrape is taking too long. Try again in a minute.');
  }
  if (res.status >= 500) throw new AppError(503, 'transcripts_unavailable', 'The scraping service is having problems. Please try again shortly.');
  throw new AppError(422, 'video_not_accessible', 'The scraper could not read that video. It may be private or deleted.');
}

export type Transcript = { text: string; lang: string | null };

export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
/** Only http(s) links are kept; anything else from a third party is dropped. */
export const httpUrl = (v: unknown): string | null => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);
export const date = (v: unknown): Date | null => {
  const d = typeof v === 'string' || typeof v === 'number' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const YOUTUBE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i;
const TIKTOK = /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\//i;
const INSTAGRAM = /^https?:\/\/(?:www\.)?instagram\.com\//i;

/** Caption text from the transcript Actor's item. It may be a string or a list of segments. */
function transcriptText(item: Item): string {
  const raw = item.text ?? item.transcript ?? item.captions ?? item.content;
  if (typeof raw === 'string') return raw.replace(/\s+/g, ' ').trim();
  if (Array.isArray(raw)) {
    return raw
      .map((seg) => (seg && typeof seg === 'object' ? str((seg as { text?: unknown }).text) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

const none = () => new AppError(422, 'transcript_unavailable', 'This video has no transcript available. You can paste one in instead.');

/**
 * The spoken words of a YouTube video, from its captions. Only YouTube is
 * supported: the transcript Actor reads YouTube captions, and no configured
 * Actor reads TikTok or Instagram audio.
 */
export async function fetchTranscript(videoUrl: string): Promise<Transcript> {
  if (!YOUTUBE.test(videoUrl)) {
    throw new AppError(422, 'transcript_unavailable', 'Automatic transcripts work for YouTube videos. You can paste one in instead.');
  }
  const [item] = await runActor('youtubeTranscript', { videoUrls: [videoUrl], language: 'en', includeSegments: false }, 1);
  if (!item) throw none();
  const text = transcriptText(item);
  if (!text) throw none();
  return { text, lang: str(item.language) || str(item.lang) || null };
}

export type VideoMetadata = {
  platform: 'tiktok' | 'instagram';
  id: string;
  url: string;
  title: string;
  description: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  views: number | null;
  likes: number | null;
  comments: number | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  createdAt: Date | null;
};

function tiktokMetadata(item: Item, videoUrl: string): VideoMetadata | null {
  const author = (item.authorMeta ?? {}) as Record<string, unknown>;
  const video = (item.videoMeta ?? {}) as Record<string, unknown>;
  const id = str(item.id);
  const username = str(author.name);
  if (!id || !username) return null;
  return {
    platform: 'tiktok',
    id,
    url: httpUrl(item.webVideoUrl) ?? videoUrl,
    title: (str(item.text).split('\n')[0] ?? '').slice(0, 200) || 'Untitled video',
    description: str(item.text).slice(0, 2000),
    author: { username, displayName: str(author.nickName) || username, avatarUrl: httpUrl(author.avatar) },
    views: int(item.playCount),
    likes: int(item.diggCount),
    comments: int(item.commentCount),
    durationSeconds: int(video.duration),
    thumbnailUrl: httpUrl(video.coverUrl),
    createdAt: date(item.createTimeISO) ?? date(item.createTime),
  };
}

function instagramMetadata(item: Item, videoUrl: string): VideoMetadata | null {
  const id = str(item.id) || str(item.shortCode);
  const username = str(item.ownerUsername);
  if (!id || !username) return null;
  const caption = str(item.caption);
  return {
    platform: 'instagram',
    id,
    url: httpUrl(item.url) ?? videoUrl,
    title: (caption.split('\n')[0] ?? '').slice(0, 200) || 'Untitled reel',
    description: caption.slice(0, 2000),
    author: { username, displayName: str(item.ownerFullName) || username, avatarUrl: null },
    views: int(item.videoPlayCount ?? item.videoViewCount),
    likes: int(item.likesCount),
    comments: int(item.commentsCount),
    durationSeconds: int(item.videoDuration),
    thumbnailUrl: httpUrl(item.displayUrl),
    createdAt: date(item.timestamp),
  };
}

/** Public numbers and author of one TikTok or Instagram video, from its link. */
export async function fetchVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
  let meta: VideoMetadata | null = null;
  if (TIKTOK.test(videoUrl)) {
    const [item] = await runActor('tiktok', { postURLs: [videoUrl], resultsPerPage: 1 }, 1);
    meta = item ? tiktokMetadata(item, videoUrl) : null;
  } else if (INSTAGRAM.test(videoUrl)) {
    const [item] = await runActor('instagram', { directUrls: [videoUrl], resultsLimit: 1 }, 1);
    meta = item ? instagramMetadata(item, videoUrl) : null;
  } else {
    throw new AppError(400, 'invalid_link', 'Only TikTok and Instagram videos are read this way.');
  }
  if (!meta) throw new AppError(404, 'video_not_found', 'No video was found at that link. It may be private or deleted.');
  return meta;
}
