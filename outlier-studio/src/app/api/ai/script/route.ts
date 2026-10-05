import { ScriptInput, openScriptStream, saveScript } from '@/server/ai/features/script';
import { AppError } from '@/server/errors';
import { readJson, route } from '@/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Streams a script as server-sent events:
 *   start {requestId} -> delta {text} ... -> done {generation, usage, truncated} | error {code, message}
 * Failures before the first token (limits, Groq outage) are returned as a
 * normal JSON error with the right HTTP status instead.
 */
export const POST = route('user', async ({ req, user }) => {
  const input = await readJson(req, ScriptInput);
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort(), { once: true });

  const stream = await openScriptStream(user.id, input, abort.signal);
  const encoder = new TextEncoder();
  let open = true;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (open) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send('start', { requestId: stream.requestId });
        let step = await stream.deltas.next();
        while (!step.done) {
          send('delta', { text: step.value });
          step = await stream.deltas.next();
        }
        const generation = await saveScript(user.id, input, step.value.text, stream.requestId);
        send('done', { generation, usage: step.value.usage, truncated: step.value.truncated, requestId: stream.requestId });
      } catch (err) {
        if (err instanceof AppError) {
          send('error', { code: err.code, message: err.message });
        } else {
          console.error('[script stream]', err);
          send('error', { code: 'internal_error', message: 'Something went wrong on our side.' });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          /* already closed by a client disconnect */
        }
      }
    },
    cancel() {
      open = false;
      abort.abort();
    },
  });

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
});
