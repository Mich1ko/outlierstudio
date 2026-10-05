/**
 * A local stand-in for the Supadata endpoints the app uses (/transcript,
 * /transcript/{jobId}, /metadata). Test tooling only: the app reads
 * SUPADATA_BASE_URL solely when NODE_ENV is "test".
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type FakePost = {
  platform: 'tiktok' | 'instagram' | 'youtube';
  id: string;
  username: string;
  displayName: string;
  title: string;
  views: number | null;
  likes?: number;
  comments?: number;
  duration?: number;
  createdAt?: string;
};

export class FakeSupadata {
  calls: { path: string; params: Record<string, string>; key: string | undefined }[] = [];
  /** Transcript text by video URL. A null value means "no transcript available". */
  transcripts = new Map<string, string | null>();
  /** Used for any URL not listed in transcripts. */
  defaultTranscript: string | null = null;
  posts = new Map<string, FakePost>();
  /** URLs whose transcript is delivered through a job that completes on the second poll. */
  asyncUrls = new Set<string>();
  failNext?: { status: number; error: string };
  private jobs = new Map<string, { url: string; polls: number }>();
  private server = http.createServer((req, res) => this.handle(req, res));

  async start(port = 0): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(port, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }
  stop(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
  reset(): void {
    this.calls = [];
    this.transcripts.clear();
    this.posts.clear();
    this.asyncUrls.clear();
    this.jobs.clear();
    this.defaultTranscript = null;
    this.failNext = undefined;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://x');
    const params = Object.fromEntries(url.searchParams);
    const key = req.headers['x-api-key'] as string | undefined;
    this.calls.push({ path: url.pathname, params, key });
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const fail = (status: number, error: string) => send(status, { error, message: error, details: error, documentationUrl: `https://docs.supadata.ai/errors/${error}` });

    if (!key) return fail(401, 'unauthorized');
    if (this.failNext) {
      const f = this.failNext;
      this.failNext = undefined;
      return fail(f.status, f.error);
    }
    const transcriptFor = (videoUrl: string) => (this.transcripts.has(videoUrl) ? this.transcripts.get(videoUrl)! : this.defaultTranscript);

    if (url.pathname === '/transcript') {
      const videoUrl = params.url ?? '';
      const text = transcriptFor(videoUrl);
      if (text === null) return fail(206, 'transcript-unavailable');
      if (this.asyncUrls.has(videoUrl)) {
        const jobId = `job-${this.jobs.size + 1}`;
        this.jobs.set(jobId, { url: videoUrl, polls: 0 });
        return send(202, { jobId });
      }
      return send(200, params.text === 'true' ? { content: text, lang: 'en', availableLangs: ['en'] } : { content: [{ text, offset: 0, duration: 1000, lang: 'en' }], lang: 'en', availableLangs: ['en'] });
    }
    if (url.pathname.startsWith('/transcript/')) {
      const job = this.jobs.get(url.pathname.slice('/transcript/'.length));
      if (!job) return fail(404, 'not-found');
      job.polls++;
      if (job.polls < 2) return send(200, { status: 'active' });
      return send(200, { status: 'completed', content: transcriptFor(job.url), lang: 'en', availableLangs: ['en'] });
    }
    if (url.pathname === '/metadata') {
      const post = this.posts.get(params.url ?? '');
      if (!post) return fail(404, 'not-found');
      return send(200, {
        platform: post.platform,
        type: 'video',
        id: post.id,
        url: params.url,
        title: post.title,
        description: post.title,
        author: { username: post.username, displayName: post.displayName, avatarUrl: `https://cdn.example/${post.username}.jpg`, verified: false },
        stats: { views: post.views, likes: post.likes ?? null, comments: post.comments ?? null, shares: null },
        media: { type: 'video', duration: post.duration ?? 31, thumbnailUrl: `https://cdn.example/${post.id}.jpg` },
        tags: [],
        createdAt: post.createdAt ?? new Date(Date.now() - 3 * 86_400_000).toISOString(),
        additionalData: {},
      });
    }
    return fail(404, 'not-found');
  }
}
