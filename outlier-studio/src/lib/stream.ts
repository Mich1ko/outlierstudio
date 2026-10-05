import { ApiError, toApiError } from './api';
import type { Generation, TokenUsage } from './types';

type Handlers = {
  onDelta: (text: string) => void;
};
export type ScriptDone = { generation: Generation; usage: TokenUsage | null; truncated: boolean };

/**
 * Calls POST /api/ai/script and feeds each streamed piece of text to onDelta.
 * Resolves with the saved script; rejects with an ApiError on any failure,
 * whether it arrives as an HTTP error or as an "error" event mid-stream.
 */
export async function streamScript(body: unknown, handlers: Handlers, signal: AbortSignal): Promise<ScriptDone> {
  let res: Response;
  try {
    res = await fetch('/api/ai/script', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      credentials: 'same-origin',
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.');
  }
  if (!res.ok || !res.body) throw await toApiError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: ScriptDone | undefined;

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const raw = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || !raw) continue;
      const data = JSON.parse(raw);
      if (event === 'delta') handlers.onDelta(data.text);
      else if (event === 'done') done = data;
      else if (event === 'error') throw new ApiError(502, data.code, data.message);
    }
  }
  if (!done) throw new ApiError(502, 'ai_stream_interrupted', 'The script stopped before it finished. Please try again.');
  return done;
}
