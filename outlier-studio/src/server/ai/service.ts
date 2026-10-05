import 'server-only';
import { z } from 'zod';
import { env } from '../env';
import { AppError } from '../errors';
import type { Feature } from '../settings';
import { getGroq } from './client';
import { mapGroqError } from './errors';
import { reserve } from './limits';
import { modelFor, supportsStrictJson, type ModelTier } from './models';
import { completeRequest, failRequest, readUsage, type TokenUsage } from './usage';

/**
 * The single entry point for AI generation. Every feature calls generateJson
 * or openTextStream; nothing else in the codebase talks to an AI provider.
 * Each call is: check limits and reserve credits -> call Groq -> record usage.
 */

type BaseCall = {
  userId: string;
  feature: Feature;
  tier: ModelTier;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

function baseParams(call: BaseCall, model: string) {
  const effort = env().GROQ_REASONING_EFFORT;
  return {
    model,
    messages: [
      { role: 'system' as const, content: call.system },
      { role: 'user' as const, content: call.prompt },
    ],
    temperature: call.temperature ?? 0.7,
    max_completion_tokens: call.maxOutputTokens ?? 4096,
    ...(effort ? { reasoning_effort: effort } : {}),
  };
}

type Outcome = { model: string; usage: TokenUsage | null; latencyMs: number; groqRequestId?: string | null };

/**
 * Marks the request failed and returns the error to throw. Groq errors become
 * user-safe AppErrors; anything else is recorded as internal and rethrown as-is
 * so the route wrapper logs it.
 */
async function recordFailure(requestId: string, err: unknown, outcome: Outcome, opts: { aborted?: boolean; receivedText?: boolean } = {}): Promise<unknown> {
  let mapped: AppError;
  let toThrow: unknown;
  try {
    mapped = opts.aborted ? new AppError(499, 'client_aborted', 'The request was cancelled.') : mapGroqError(err);
    toThrow = mapped;
  } catch (unknown) {
    mapped = new AppError(500, 'internal_error', 'Internal error');
    toThrow = unknown;
  }
  // A user who cancels after receiving text keeps the charge; every other failure is refunded.
  const keepCredits = mapped.code === 'client_aborted' && opts.receivedText === true;
  await failRequest(requestId, { ...outcome, error: mapped, keepCredits });
  return toThrow;
}

const invalidOutput = () => new AppError(502, 'ai_invalid_output', 'The AI returned an unusable response. Please try again.');

export type JsonResult<T> = { requestId: string; model: string; data: T; usage: TokenUsage | null };

export async function generateJson<T>(call: BaseCall & { schemaName: string; schema: z.ZodType<T> }): Promise<JsonResult<T>> {
  const groq = getGroq();
  const model = modelFor(call.tier);
  const requestId = await reserve(call.userId, call.feature, model);
  const started = Date.now();
  let usage: TokenUsage | null = null;
  let groqRequestId: string | null = null;

  try {
    const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(call.schema) as Record<string, unknown>;
    const strict = supportsStrictJson(model);
    const params = baseParams(call, model);
    if (!strict) {
      // JSON object mode guarantees valid JSON only, so the schema goes in the prompt.
      params.messages[0]!.content += `\n\nRespond with a single JSON object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
    }
    const completion = await groq.chat.completions.create(
      {
        ...params,
        stream: false,
        response_format: strict
          ? { type: 'json_schema', json_schema: { name: call.schemaName, strict: true, schema: jsonSchema } }
          : { type: 'json_object' },
      },
      { signal: call.signal },
    );
    usage = readUsage(completion.usage);
    groqRequestId = completion.x_groq?.id ?? null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content ?? '');
    } catch {
      throw invalidOutput();
    }
    // Validate even in strict mode: never trust model output on shape alone.
    const checked = call.schema.safeParse(parsed);
    if (!checked.success) throw invalidOutput();

    await completeRequest(requestId, { model, usage, latencyMs: Date.now() - started, groqRequestId });
    return { requestId, model, data: checked.data, usage };
  } catch (err) {
    throw await recordFailure(requestId, err, { model, usage, latencyMs: Date.now() - started, groqRequestId }, { aborted: call.signal?.aborted });
  }
}

/** truncated is true when the model stopped at the output-token limit. */
export type StreamResult = { text: string; usage: TokenUsage | null; truncated: boolean };
export type TextStream = { requestId: string; model: string; deltas: AsyncGenerator<string, StreamResult, void> };

/**
 * Opens a streaming completion. Errors that happen before the first byte
 * (rate limit, bad model, outage) are thrown here, so the caller can still
 * return a normal HTTP error. Usage is recorded when the stream finishes,
 * from the token counts Groq sends in its final chunk.
 */
export async function openTextStream(call: BaseCall): Promise<TextStream> {
  const groq = getGroq();
  const model = modelFor(call.tier);
  const requestId = await reserve(call.userId, call.feature, model);
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  let stream: Awaited<ReturnType<typeof open>>;
  function open() {
    return groq.chat.completions.create({ ...baseParams(call, model), stream: true }, { signal: call.signal });
  }
  try {
    stream = await open();
  } catch (err) {
    throw await recordFailure(requestId, err, { model, usage: null, latencyMs: elapsed() }, { aborted: call.signal?.aborted });
  }

  async function* deltas(): AsyncGenerator<string, StreamResult, void> {
    let text = '';
    let usage: TokenUsage | null = null;
    let groqRequestId: string | null = null;
    let finishReason: string | null = null;
    let settled = false;
    try {
      for await (const chunk of stream) {
        if (chunk.x_groq?.id) groqRequestId = chunk.x_groq.id;
        if (chunk.x_groq?.error) {
          throw new AppError(502, 'ai_stream_interrupted', 'The AI service stopped mid-response. Please try again.');
        }
        const reported = chunk.x_groq?.usage ?? (chunk as { usage?: Parameters<typeof readUsage>[0] }).usage;
        if (reported) usage = readUsage(reported) ?? usage;
        finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
        const piece = chunk.choices[0]?.delta?.content;
        if (piece) {
          text += piece;
          yield piece;
        }
      }
      // The SDK ends iteration quietly on abort or a dropped connection, so a
      // stream only counts as complete once Groq has sent a finish reason.
      if (call.signal?.aborted) throw new AppError(499, 'client_aborted', 'The request was cancelled.');
      if (!finishReason) throw new AppError(502, 'ai_stream_interrupted', 'The AI service stopped mid-response. Please try again.');
      if (!text.trim()) throw invalidOutput();
      settled = true;
      await completeRequest(requestId, { model, usage, latencyMs: elapsed(), groqRequestId });
      return { text, usage, truncated: finishReason === 'length' };
    } catch (err) {
      settled = true;
      throw await recordFailure(
        requestId,
        err,
        { model, usage, latencyMs: elapsed(), groqRequestId },
        { aborted: call.signal?.aborted, receivedText: text.length > 0 },
      );
    } finally {
      if (!settled) {
        // The consumer stopped reading (client disconnected).
        stream.controller.abort();
        await failRequest(requestId, {
          model,
          usage,
          latencyMs: elapsed(),
          groqRequestId,
          error: new AppError(499, 'client_aborted', 'The request was cancelled.'),
          keepCredits: text.length > 0,
        });
      }
    }
  }

  return { requestId, model, deltas: deltas() };
}
