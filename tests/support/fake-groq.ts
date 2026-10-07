/**
 * A local stand-in for Groq's chat completions endpoint, used ONLY by the
 * test suite. It speaks the same wire format (JSON and SSE streaming with the
 * final x_groq.usage chunk) so the real groq-sdk client runs unmodified.
 * Application code never references this file.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

export type Behavior =
  | { kind: 'json'; content: string; usage?: Usage | null }
  | { kind: 'stream'; pieces: string[]; usage?: Usage | null; errorAfter?: number; delayMs?: number }
  | { kind: 'error'; status: number; body: unknown; headers?: Record<string, string> };

export type RecordedCall = { path: string; authorization: string | undefined; body: Record<string, any> };

export const USAGE: Usage = { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 };

export class FakeGroq {
  calls: RecordedCall[] = [];
  private queue: Behavior[] = [];
  /** When set, requests with nothing queued get this instead of an error (used by the browser check). */
  fallback?: (body: Record<string, any>) => Behavior;
  private server = http.createServer((req, res) => void this.handle(req, res));

  async start(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }
  stop(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
  reset(): void {
    this.calls = [];
    this.queue = [];
  }
  enqueue(...behaviors: Behavior[]): void {
    this.queue.push(...behaviors);
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    this.calls.push({ path: req.url ?? '', authorization: req.headers.authorization, body });

    const next = this.queue.shift() ?? this.fallback?.(body);
    if (req.url !== '/openai/v1/chat/completions' || !next) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'fake-groq: unexpected call', type: 'test' } }));
      return;
    }

    if (next.kind === 'error') {
      res.writeHead(next.status, { 'content-type': 'application/json', ...next.headers });
      res.end(JSON.stringify(next.body));
      return;
    }

    const base = { id: 'chatcmpl-test', created: 1, model: body.model };
    if (next.kind === 'json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ...base,
          object: 'chat.completion',
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: next.content } }],
          usage: next.usage === null ? undefined : (next.usage ?? USAGE),
          x_groq: { id: 'req_test_json' },
        }),
      );
      return;
    }

    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const write = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const chunk = (delta: object, extra: object = {}) => ({
      ...base,
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta, finish_reason: null }],
      ...extra,
    });
    write(chunk({ role: 'assistant', content: '' }, { x_groq: { id: 'req_test_stream' } }));
    for (const [i, piece] of next.pieces.entries()) {
      if (next.errorAfter === i) {
        write({ ...chunk({}), x_groq: { id: 'req_test_stream', error: 'over_capacity' } });
        res.end();
        return;
      }
      if (next.delayMs) await new Promise((r) => setTimeout(r, next.delayMs));
      if (res.destroyed) return;
      write(chunk({ content: piece }));
    }
    write({
      ...base,
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      x_groq: { id: 'req_test_stream', ...(next.usage === null ? {} : { usage: next.usage ?? USAGE }) },
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
