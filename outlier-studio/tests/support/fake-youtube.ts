/**
 * A local stand-in for the three YouTube Data API v3 endpoints the app uses
 * (channels, playlistItems, videos). Test tooling only: the app reads
 * YOUTUBE_API_BASE_URL solely when NODE_ENV is "test".
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type FakeVideo = { id: string; title: string; publishedAt: string; duration: string; views?: number; likes?: number; comments?: number; description?: string; thumb?: string };
export type FakeChannel = { id: string; title: string; handle?: string; username?: string; subscribers: number; hiddenSubscribers?: boolean; views: number; videos: FakeVideo[]; thumb?: string };

export class FakeYouTube {
  channels = new Map<string, FakeChannel>();
  calls: { resource: string; params: Record<string, string> }[] = [];
  /** When set, the next request fails with this status and reason. */
  failNext?: { status: number; reason: string; message?: string };
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
    this.channels.clear();
    this.calls = [];
    this.failNext = undefined;
  }
  add(channel: FakeChannel): FakeChannel {
    this.channels.set(channel.id, channel);
    return channel;
  }

  private findVideo(id: string): { video: FakeVideo; channel: FakeChannel } | undefined {
    for (const channel of this.channels.values()) {
      const video = channel.videos.find((v) => v.id === id);
      if (video) return { video, channel };
    }
    return undefined;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://x');
    const resource = url.pathname.replace(/^\//, '');
    const params = Object.fromEntries(url.searchParams);
    this.calls.push({ resource, params });
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const fail = (status: number, reason: string, message = reason) => send(status, { error: { code: status, message, errors: [{ reason, message }] } });

    if (!params.key) return fail(403, 'forbidden', 'The request is missing a valid API key.');
    if (this.failNext) {
      const f = this.failNext;
      this.failNext = undefined;
      return fail(f.status, f.reason, f.message);
    }

    if (resource === 'channels') {
      const all = [...this.channels.values()];
      const found = params.id
        ? all.filter((c) => params.id!.split(',').includes(c.id))
        : params.forHandle
          ? all.filter((c) => c.handle?.toLowerCase() === params.forHandle!.toLowerCase())
          : all.filter((c) => c.username === params.forUsername);
      return send(200, {
        items: found.map((c) => ({
          id: c.id,
          snippet: { title: c.title, customUrl: c.handle, thumbnails: { medium: { url: c.thumb ?? `https://yt3.ggpht.com/${c.id}` } } },
          statistics: { viewCount: String(c.views), subscriberCount: String(c.subscribers), hiddenSubscriberCount: Boolean(c.hiddenSubscribers), videoCount: String(c.videos.length) },
          contentDetails: { relatedPlaylists: { uploads: `UU${c.id.slice(2)}` } },
        })),
      });
    }
    if (resource === 'playlistItems') {
      const channel = [...this.channels.values()].find((c) => `UU${c.id.slice(2)}` === params.playlistId);
      if (!channel || channel.videos.length === 0) return fail(404, 'playlistNotFound');
      const newest = [...channel.videos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, Number(params.maxResults ?? 5));
      return send(200, { items: newest.map((v) => ({ contentDetails: { videoId: v.id, videoPublishedAt: v.publishedAt } })) });
    }
    if (resource === 'videos') {
      const items = (params.id ?? '').split(',').flatMap((id) => {
        const hit = this.findVideo(id);
        if (!hit) return [];
        const { video: v, channel } = hit;
        const stat = (n: number | undefined) => (n === undefined ? undefined : String(n));
        return [{
          id: v.id,
          snippet: { title: v.title, description: v.description ?? '', publishedAt: v.publishedAt, channelId: channel.id, thumbnails: { medium: { url: v.thumb ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` } } },
          statistics: { viewCount: stat(v.views), likeCount: stat(v.likes), commentCount: stat(v.comments) },
          contentDetails: { duration: v.duration },
        }];
      });
      return send(200, { items });
    }
    return fail(404, 'notFound');
  }
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const vid = (n: number, prefix: string) => `${prefix}${String(n).padStart(11 - prefix.length, '0')}`;

/** A channel with eight Shorts around 10,000 views, one Short at 150,000, and two long videos. */
export function sampleChannel(id = 'UCaaaaaaaaaaaaaaaaaaaaaa', handle = '@runfaster', prefix = 'a'): FakeChannel {
  const shorts: FakeVideo[] = [8000, 9000, 9500, 10000, 10000, 10500, 11000, 12000].map((views, i) => ({
    id: vid(i + 1, prefix), title: `Running tip ${i + 1}`, publishedAt: hoursAgo(48 + i * 24), duration: 'PT45S', views, likes: Math.round(views / 20), comments: Math.round(views / 200),
  }));
  return {
    id, title: 'Run Faster', handle, subscribers: 52000, views: 4_000_000,
    videos: [
      ...shorts,
      { id: vid(50, prefix), title: 'Why stretching before a run slows you down', publishedAt: hoursAgo(30), duration: 'PT58S', views: 150000, likes: 9000, comments: 400 },
      { id: vid(60, prefix), title: 'Full marathon training plan', publishedAt: hoursAgo(200), duration: 'PT18M4S', views: 40000, likes: 1500, comments: 120 },
      { id: vid(61, prefix), title: 'Shoe review', publishedAt: hoursAgo(400), duration: 'PT9M', views: 20000, likes: 600, comments: 50 },
    ],
  };
}
