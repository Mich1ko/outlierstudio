import 'server-only';
import { env } from '../env';
import { AppError } from '../errors';

/**
 * Client for Supadata (https://docs.supadata.ai), used for two things the
 * official platform APIs do not offer: transcripts of other people's videos,
 * and the public numbers of a single TikTok or Instagram video.
 * Free plan: 100 requests a month, 1 request a second.
 */

const SUPADATA_API = 'https://api.supadata.ai/v1';
/** Free-plan pace. Calls are queued so two never go out in the same second. */
const MIN_GAP_MS = 1100;
/** AI-generated transcripts are billed per minute, so they are only allowed for short videos. */
export const GENERATE_MAX_SECONDS = 600;

export function supadataConfigured(): boolean {
  return Boolean(env().SUPADATA_API_KEY);
}

function baseUrl(): string {
  const e = env();
  return e.NODE_ENV === 'test' && e.SUPADATA_BASE_URL ? e.SUPADATA_BASE_URL : SUPADATA_API;
}

const notConfigured = (message: string) => new AppError(503, 'transcripts_not_configured', message);

type Queue = { tail: Promise<unknown>; last: number };
const queue = ((globalThis as Record<string, unknown>).__supadataQueue ??= { tail: Promise.resolve(), last: 0 }) as Queue;

function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.tail.then(async () => {
    const gap = env().NODE_ENV === 'test' ? 0 : MIN_GAP_MS;
    const wait = queue.last + gap - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    queue.last = Date.now();
    return fn();
  });
  queue.tail = run.catch(() => undefined);
  return run;
}

type ErrorBody = { error?: string; message?: string };

async function call(path: string, params?: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const key = env().SUPADATA_API_KEY;
  if (!key) throw notConfigured('Automatic transcripts need a Supadata API key on the server.');
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const res = await paced(async () => {
    try {
      return await fetch(url, { headers: { 'x-api-key': key, accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    } catch {
      throw new AppError(503, 'transcripts_unavailable', 'The transcript service could not be reached. Please try again shortly.');
    }
  });
  const body = (await res.json().catch(() => ({}))) as unknown;
  if (res.status === 200 || res.status === 202) return { status: res.status, body };

  const code = (body as ErrorBody).error ?? '';
  if (res.status === 206 || code === 'transcript-unavailable') {
    throw new AppError(422, 'transcript_unavailable', 'This video has no transcript available. You can paste one in instead.');
  }
  if (res.status === 401) throw notConfigured('The Supadata API key was rejected. Check the key in the server settings.');
  if (res.status === 402) {
    throw new AppError(402, 'transcript_plan_limit', 'The Supadata plan on this server does not cover this request.');
  }
  if (res.status === 429) {
    throw new AppError(429, 'transcript_quota', "This month's transcript allowance is used up, or requests are coming too fast. You can paste a transcript in instead.");
  }
  if (res.status === 404) throw new AppError(404, 'video_not_found', 'No video was found at that link. It may be private or deleted.');
  if (res.status === 400) throw new AppError(400, 'invalid_link', 'That link is not a video the transcript service can read.');
  if (res.status === 403) throw new AppError(422, 'video_not_accessible', 'That video cannot be read. It may be private or restricted.');
  throw new AppError(503, 'transcripts_unavailable', 'The transcript service is having problems. Please try again shortly.');
}

export type Transcript = { text: string; lang: string | null };

function toTranscript(body: unknown): Transcript | null {
  const b = body as { content?: unknown; lang?: unknown };
  const text = typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map((c: { text?: string }) => c.text ?? '').join(' ') : '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean ? { text: clean, lang: typeof b.lang === 'string' ? b.lang : null } : null;
}

const none = () => new AppError(422, 'transcript_unavailable', 'This video has no transcript available. You can paste one in instead.');

/**
 * Fetches the spoken words of a video. Existing captions are used when there
 * are any; short videos without captions are transcribed by the service.
 * Long jobs come back as a job id, which is polled for up to a minute.
 */
export async function fetchTranscript(videoUrl: string, opts: { durationSeconds?: number | null } = {}): Promise<Transcript> {
  const allowGenerate = opts.durationSeconds == null || opts.durationSeconds <= GENERATE_MAX_SECONDS;
  const first = await call('/transcript', { url: videoUrl, text: 'true', mode: allowGenerate ? 'auto' : 'native' });
  if (first.status === 200) {
    const t = toTranscript(first.body);
    if (!t) throw none();
    return t;
  }
  const jobId = (first.body as { jobId?: string }).jobId;
  if (!jobId) throw new AppError(503, 'transcripts_unavailable', 'The transcript service returned an unexpected response.');

  const pollMs = env().NODE_ENV === 'test' ? 10 : 2000;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, pollMs));
    const { body } = await call(`/transcript/${encodeURIComponent(jobId)}`);
    const job = body as { status?: string };
    if (job.status === 'completed') {
      const t = toTranscript(body);
      if (!t) throw none();
      return t;
    }
    if (job.status === 'failed') throw none();
  }
  throw new AppError(504, 'transcript_timeout', 'The transcript is taking too long. Try again in a minute.');
}

export type VideoMetadata = {
  platform: 'youtube' | 'tiktok' | 'instagram';
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

const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/** Only http(s) image links are kept; anything else from a third party is dropped. */
const httpUrl = (v: unknown): string | null => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);

/** Public numbers and author of one video, from its link. */
export async function fetchVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
  const { body } = await call('/metadata', { url: videoUrl });
  const m = body as Record<string, any>;
  const platform = m.platform;
  if (platform !== 'youtube' && platform !== 'tiktok' && platform !== 'instagram') {
    throw new AppError(400, 'invalid_link', 'Only YouTube, TikTok and Instagram videos are supported.');
  }
  if (!str(m.id) || !str(m.author?.username)) throw new AppError(404, 'video_not_found', 'No video was found at that link. It may be private or deleted.');
  const created = str(m.createdAt) ? new Date(m.createdAt) : null;
  const text = str(m.title) || str(m.description);
  return {
    platform,
    id: str(m.id),
    url: httpUrl(m.url) ?? videoUrl,
    title: (text.split('\n')[0] ?? '').slice(0, 200) || 'Untitled video',
    description: str(m.description).slice(0, 2000),
    author: { username: str(m.author.username).replace(/^@/, ''), displayName: str(m.author.displayName) || str(m.author.username), avatarUrl: httpUrl(m.author.avatarUrl) },
    views: int(m.stats?.views),
    likes: int(m.stats?.likes),
    comments: int(m.stats?.comments),
    durationSeconds: int(m.media?.duration),
    thumbnailUrl: httpUrl(m.media?.thumbnailUrl),
    createdAt: created && !Number.isNaN(created.getTime()) ? created : null,
  };
}
