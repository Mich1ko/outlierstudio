import { describe, expect, it } from 'vitest';
import { POST as hooks } from '@/app/api/ai/hooks/route';
import { POST as analyze } from '@/app/api/ai/analyze/route';
import { POST as script } from '@/app/api/ai/script/route';
import { GET as usage } from '@/app/api/usage/route';
import { GET as getGeneration } from '@/app/api/generations/[id]/route';
import { getDb } from '@/server/db/client';
import { DEFAULT_LIMITS, setLimits } from '@/server/settings';
import { USAGE } from './support/fake-groq';
import { TRANSCRIPT, call, newUser, readSse, requestRows, useTestApp } from './support/app';

const groq = useTestApp();

const HOOKS_JSON = JSON.stringify({
  hooks: [
    { text: 'Stretching before you run is slowing you down.', pattern: 'contrarian', why: 'Challenges a habit.' },
    { text: 'Do this for two minutes before every run.', pattern: 'how_to', why: 'Concrete and small.' },
    { text: 'Why do fast runners skip stretching?', pattern: 'question', why: 'Opens a loop.' },
  ],
});
const ANALYSIS_JSON = JSON.stringify({
  summary: 'A runner argues against static stretching.',
  hook: { text: 'Most people stretch before they run', pattern: 'contrarian', whyItWorks: 'Challenges a habit.' },
  format: 'myth buster',
  structure: [{ section: 'Hook', purpose: 'Stop the scroll', summary: 'Contrarian claim' }],
  storytellingTactics: ['open loop'],
  topics: ['running'],
  takeaways: ['Lead with the counter-intuitive claim'],
  remixIdeas: [{ title: 'Stop meal prepping on Sunday', angle: 'Same myth-buster arc for cooking' }],
});
const analysisBody = { transcript: TRANSCRIPT, title: 'Stretching myth', views: 900_000, channelMedianViews: 60_000 };

async function setRate(requestsPerMinute: number) {
  const { user } = await newUser('limits-admin@example.com');
  await setLimits(await getDb(), { ...DEFAULT_LIMITS, requestsPerMinute }, user.id);
}

describe('AI endpoints require a session', () => {
  it('returns 401 and never calls Groq', async () => {
    for (const [handler, path] of [[hooks, '/api/ai/hooks'], [analyze, '/api/ai/analyze'], [script, '/api/ai/script']] as const) {
      const res = await call(handler, 'POST', path, { body: { topic: 'running', transcript: TRANSCRIPT, idea: 'running tips' } });
      expect(res.status).toBe(401);
    }
    expect(groq.calls).toHaveLength(0);
  });
});

describe('hooks (structured JSON)', () => {
  it('calls Groq with the server key and configured model, saves the result and records usage', async () => {
    const { cookie, user } = await newUser();
    groq.enqueue({ kind: 'json', content: HOOKS_JSON });
    const res = await call(hooks, 'POST', '/api/ai/hooks', { cookie, body: { topic: 'Warm ups for runners', count: 3 } });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.generation.output.hooks).toHaveLength(3);
    expect(JSON.stringify(body)).not.toContain('gsk_test_key');

    expect(groq.calls).toHaveLength(1);
    const sent = groq.calls[0]!;
    expect(sent.authorization).toBe('Bearer gsk_test_key');
    expect(sent.body.model).toBe('openai/gpt-oss-120b');
    expect(sent.body.response_format.type).toBe('json_schema');
    expect(sent.body.response_format.json_schema.strict).toBe(true);
    expect(sent.body.response_format.json_schema.schema.additionalProperties).toBe(false);

    const [row] = await requestRows(user.id);
    expect(row).toMatchObject({
      feature: 'hooks',
      model: 'openai/gpt-oss-120b',
      status: 'succeeded',
      inputTokens: USAGE.prompt_tokens,
      outputTokens: USAGE.completion_tokens,
      totalTokens: USAGE.total_tokens,
      generationId: body.generation.id,
      groqRequestId: 'req_test_json',
      errorCode: null,
    });
    // 120 input tokens at $0.15/M + 80 output tokens at $0.60/M
    expect(Number(row!.estimatedCostUsd)).toBeCloseTo((120 * 0.15 + 80 * 0.6) / 1e6, 10);
    expect(row!.latencyMs).toBeGreaterThanOrEqual(0);

    const saved = await call(getGeneration, 'GET', `/api/generations/${body.generation.id}`, { cookie, params: { id: body.generation.id } });
    expect((await saved.json()).generation.output.hooks[0].pattern).toBe('contrarian');
  });

  it('switches model from configuration and falls back to JSON-object mode for non-strict models', async () => {
    process.env.GROQ_MODEL_QUALITY = 'llama-3.3-70b-versatile';
    const { cookie, user } = await newUser();
    groq.enqueue({ kind: 'json', content: HOOKS_JSON });
    const res = await call(hooks, 'POST', '/api/ai/hooks', { cookie, body: { topic: 'Warm ups for runners' } });
    expect(res.status).toBe(201);
    expect(groq.calls[0]!.body.model).toBe('llama-3.3-70b-versatile');
    expect(groq.calls[0]!.body.response_format).toEqual({ type: 'json_object' });
    expect(groq.calls[0]!.body.messages[0].content).toContain('JSON Schema');
    const [row] = await requestRows(user.id);
    // No list price for this model: tokens are recorded, cost is left empty rather than guessed.
    expect(row!.totalTokens).toBe(200);
    expect(row!.estimatedCostUsd).toBeNull();
  });

  it('rejects malformed model output and records the tokens spent', async () => {
    const { cookie, user } = await newUser();
    groq.enqueue({ kind: 'json', content: '{"hooks":[{"text":"x","pattern":"not_a_pattern"}]}' });
    const res = await call(hooks, 'POST', '/api/ai/hooks', { cookie, body: { topic: 'Warm ups for runners' } });
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('ai_invalid_output');
    const [row] = await requestRows(user.id);
    expect(row).toMatchObject({ status: 'failed', errorCode: 'ai_invalid_output', totalTokens: 200, generationId: null });
  });

  it('validates input before spending anything', async () => {
    const { cookie, user } = await newUser();
    const bad = await call(hooks, 'POST', '/api/ai/hooks', { cookie, body: { topic: 'x', count: 500 } });
    expect(bad.status).toBe(400);
    const huge = await call(hooks, 'POST', '/api/ai/hooks', { cookie, body: { topic: 'a'.repeat(250_000) } });
    expect(huge.status).toBe(413);
    expect(groq.calls).toHaveLength(0);
    expect(await requestRows(user.id)).toHaveLength(0);
  });
});

describe('Groq failures are reported, not hidden', () => {
  it('recovers one malformed analysis response with a JSON-object retry', async () => {
    const { cookie } = await newUser();
    groq.enqueue({ kind: 'json', content: '{bad json' }, { kind: 'json', content: ANALYSIS_JSON });
    const res = await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody });
    expect(res.status).toBe(201);
    expect(groq.calls).toHaveLength(2);
    expect(groq.calls[1]!.body.response_format).toEqual({ type: 'json_object' });
  });

  const cases = [
    ['rate limit', { status: 429, body: { error: { message: 'Rate limit reached', type: 'tokens', code: 'rate_limit_exceeded' } }, headers: { 'retry-after': '7' } }, 429, 'ai_rate_limited'],
    ['deprecated model', { status: 404, body: { error: { message: 'The model does not exist', type: 'invalid_request_error', code: 'model_not_found' } } }, 503, 'ai_model_unavailable'],
    ['decommissioned model', { status: 400, body: { error: { message: 'The model has been decommissioned', code: 'model_decommissioned' } } }, 503, 'ai_model_unavailable'],
    ['outage', { status: 503, body: { error: { message: 'Service unavailable' } } }, 503, 'ai_unavailable'],
    ['bad key', { status: 401, body: { error: { message: 'Invalid API Key', code: 'invalid_api_key' } } }, 503, 'ai_not_configured'],
    ['restricted model', { status: 403, body: { error: { message: 'Model blocked by organization', code: 'model_permission_blocked_org' } } }, 503, 'ai_access_denied'],
  ] as const;

  for (const [name, behavior, status, code] of cases) {
    it(`maps a Groq ${name} to ${status} ${code}`, async () => {
      const { cookie, user } = await newUser();
      groq.enqueue({ kind: 'error', ...behavior });
      const res = await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody });
      expect(res.status).toBe(status);
      const body = await res.json();
      expect(body.error.code).toBe(code);
      // Internal detail (Groq's own message, keys, stack traces) is not leaked.
      expect(JSON.stringify(body)).not.toMatch(/Invalid API Key|gsk_|at .*\.ts/);
      if (name === 'rate limit') expect(res.headers.get('retry-after')).toBe('7');
      const [row] = await requestRows(user.id);
      expect(row).toMatchObject({ status: 'failed', errorCode: code, inputTokens: null, creditsCharged: 0 });
      expect(groq.calls).toHaveLength(1);
    });
  }

  it('retries a transient 5xx when retries are enabled', async () => {
    process.env.GROQ_MAX_RETRIES = '1';
    const { cookie } = await newUser();
    groq.enqueue({ kind: 'error', status: 500, body: { error: { message: 'boom' } } }, { kind: 'json', content: ANALYSIS_JSON });
    const res = await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody });
    expect(res.status).toBe(201);
    expect(groq.calls).toHaveLength(2);
  });

  it('says so when no Groq key is configured, without calling anything', async () => {
    delete process.env.GROQ_API_KEY;
    const { cookie, user } = await newUser();
    const res = await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('ai_not_configured');
    expect(groq.calls).toHaveLength(0);
    expect(await requestRows(user.id)).toHaveLength(0);
  });

  it('trims copied whitespace from the server key before authenticating', async () => {
    process.env.GROQ_API_KEY = '  gsk_test_key\n';
    const { cookie } = await newUser();
    groq.enqueue({ kind: 'json', content: HOOKS_JSON });
    const res = await call(hooks, 'POST', '/api/ai/hooks', { cookie, body: { topic: 'Warm ups for runners' } });
    expect(res.status).toBe(201);
    expect(groq.calls[0]!.authorization).toBe('Bearer gsk_test_key');
  });

  it('treats a whitespace-only key as missing without sending a request or charging', async () => {
    process.env.GROQ_API_KEY = '  \n';
    const { cookie, user } = await newUser();
    const res = await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('ai_not_configured');
    expect(groq.calls).toHaveLength(0);
    expect(await requestRows(user.id)).toHaveLength(0);
  });
});

describe('video analysis', () => {
  it('computes the outlier multiple on the server and stores the analysis', async () => {
    const { cookie } = await newUser();
    groq.enqueue({ kind: 'json', content: ANALYSIS_JSON });
    const res = await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody });
    expect(res.status).toBe(201);
    const { generation } = await res.json();
    expect(generation.output.outlierMultiple).toBe(15);
    expect(generation.output.basis).toBe('transcript');
    expect(groq.calls[0]!.body.messages[1].content).toContain('<transcript>');
  });
});

describe('script streaming', () => {
  const pieces = ['HOOK\n', 'Stretching is slowing you down.\n\n', 'BODY\n', 'Here is why.\n\n', 'CALL TO ACTION\n', 'Follow for more.'];

  it('streams deltas, then records Groq-reported usage and saves the script', async () => {
    const { cookie, user } = await newUser();
    groq.enqueue({ kind: 'stream', pieces });
    const res = await call(script, 'POST', '/api/ai/script', { cookie, body: { idea: 'Why stretching before running is a mistake' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const events = await readSse(res);
    expect(events[0]!.event).toBe('start');
    expect(events.filter((e) => e.event === 'delta').map((e) => e.data.text)).toEqual(pieces);
    const done = events.at(-1)!;
    expect(done.event).toBe('done');
    expect(done.data.generation.output.text).toBe(pieces.join(''));
    expect(done.data.usage).toEqual({ inputTokens: 120, outputTokens: 80, totalTokens: 200 });

    expect(groq.calls[0]!.body.stream).toBe(true);
    const [row] = await requestRows(user.id);
    expect(row).toMatchObject({ feature: 'script', status: 'succeeded', totalTokens: 200, generationId: done.data.generation.id, groqRequestId: 'req_test_stream' });
  });

  it('leaves token counts empty when Groq reports none, instead of estimating', async () => {
    const { cookie, user } = await newUser();
    groq.enqueue({ kind: 'stream', pieces, usage: null });
    const events = await readSse(await call(script, 'POST', '/api/ai/script', { cookie, body: { idea: 'Why stretching before running is a mistake' } }));
    expect(events.at(-1)!.data.usage).toBeNull();
    const [row] = await requestRows(user.id);
    expect(row).toMatchObject({ status: 'succeeded', inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null });
  });

  it('reports a mid-stream Groq failure as an error event and refunds the credit', async () => {
    const { cookie, user } = await newUser();
    groq.enqueue({ kind: 'stream', pieces, errorAfter: 2 });
    const events = await readSse(await call(script, 'POST', '/api/ai/script', { cookie, body: { idea: 'Why stretching before running is a mistake' } }));
    expect(events.at(-1)).toEqual({ event: 'error', data: { code: 'ai_stream_interrupted', message: expect.any(String) } });
    const [row] = await requestRows(user.id);
    expect(row).toMatchObject({ status: 'failed', errorCode: 'ai_stream_interrupted', generationId: null });
  });

  it('returns a normal HTTP error when Groq fails before the first token', async () => {
    const { cookie } = await newUser();
    groq.enqueue({ kind: 'error', status: 429, body: { error: { message: 'slow down' } }, headers: { 'retry-after': '3' } });
    const res = await call(script, 'POST', '/api/ai/script', { cookie, body: { idea: 'Why stretching before running is a mistake' } });
    expect(res.status).toBe(429);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('stops the Groq stream and keeps the charge when the client disconnects mid-script', async () => {
    const { cookie, user } = await newUser();
    groq.enqueue({ kind: 'stream', pieces: ['one ', 'two ', 'three ', 'four ', 'five ', 'six '], delayMs: 150 });
    const res = await call(script, 'POST', '/api/ai/script', { cookie, body: { idea: 'Why stretching before running is a mistake' } });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let seen = '';
    while (!seen.includes('event: delta')) seen += decoder.decode((await reader.read()).value);
    await reader.cancel();

    let row = (await requestRows(user.id))[0]!;
    for (let i = 0; i < 40 && row.status === 'pending'; i++) {
      await new Promise((r) => setTimeout(r, 50));
      row = (await requestRows(user.id))[0]!;
    }
    expect(row).toMatchObject({ status: 'failed', errorCode: 'client_aborted', totalTokens: null, generationId: null });
  });
});

describe('quotas and rate limits are enforced on the server', () => {
  it('has no monthly cap and records usage, including failures', async () => {
    const { cookie } = await newUser();

    groq.enqueue({ kind: 'error', status: 503, body: { error: { message: 'down' } } });
    expect((await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody })).status).toBe(503);

    groq.enqueue({ kind: 'json', content: ANALYSIS_JSON }, { kind: 'json', content: ANALYSIS_JSON }, { kind: 'json', content: HOOKS_JSON });
    expect((await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody })).status).toBe(201);
    expect((await call(analyze, 'POST', '/api/ai/analyze', { cookie, body: analysisBody })).status).toBe(201);
    expect((await call(hooks, 'POST', '/api/ai/hooks', { cookie, body: { topic: 'Warm ups for runners' } })).status).toBe(201);

    const summary = await (await call(usage, 'GET', '/api/usage', { cookie })).json();
    expect(summary).not.toHaveProperty('credits');
    expect(summary.month).toMatchObject({ requests: 4, failed: 1, totalTokens: 600 });
    expect(summary.byFeature.find((f: any) => f.feature === 'analysis').requests).toBe(3);
    expect(summary.recent).toHaveLength(4);
    expect(summary.costNote).toMatch(/estimates/);
  });

  it('enforces the per-minute request limit', async () => {
    await setRate(2);
    const { cookie } = await newUser();
    groq.enqueue({ kind: 'json', content: HOOKS_JSON }, { kind: 'json', content: HOOKS_JSON });
    const body = { topic: 'Warm ups for runners' };
    expect((await call(hooks, 'POST', '/api/ai/hooks', { cookie, body })).status).toBe(201);
    expect((await call(hooks, 'POST', '/api/ai/hooks', { cookie, body })).status).toBe(201);
    const third = await call(hooks, 'POST', '/api/ai/hooks', { cookie, body });
    expect(third.status).toBe(429);
    expect((await third.json()).error.code).toBe('rate_limited');
    expect(third.headers.get('retry-after')).toBe('60');
    expect(groq.calls).toHaveLength(2);
  });
});
