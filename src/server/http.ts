import 'server-only';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { getSessionUser, type SessionUser } from './auth/session';
import { env } from './env';
import { AppError, forbidden, unauthorized } from './errors';

const MAX_BODY_BYTES = 200_000;

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    if (err.extra.retryAfterSeconds) headers['retry-after'] = String(Math.ceil(err.extra.retryAfterSeconds));
    return json(
      { error: { code: err.code, message: err.message, ...(err.extra.details ? { details: err.extra.details } : {}) } },
      { status: err.status, headers },
    );
  }
  // Unknown failure: log the detail server-side, return only a reference id.
  const reference = randomUUID();
  console.error(`[error ${reference}]`, err);
  return json(
    { error: { code: 'internal_error', message: 'Something went wrong on our side.', reference } },
    { status: 500 },
  );
}

/**
 * Blocks cross-site writes. Browsers attach Origin (and Sec-Fetch-Site) to
 * cross-origin POSTs; the session cookie is also SameSite=Lax.
 */
function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  if (origin) {
    if (origin !== new URL(env().APP_URL).origin) throw new AppError(403, 'bad_origin', 'Cross-site request blocked.');
    return;
  }
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    throw new AppError(403, 'bad_origin', 'Cross-site request blocked.');
  }
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AppError(415, 'unsupported_media_type', 'Send the request body as JSON.');
  }
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new AppError(413, 'payload_too_large', 'Request is too large.');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'invalid_json', 'Request body is not valid JSON.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new AppError(400, 'invalid_input', 'Some fields are missing or invalid.', { details });
  }
  return parsed.data;
}

type RouteCtx = { params: Promise<Record<string, string>> };
type Access = 'public' | 'user' | 'admin';
type Handler<A extends Access> = (args: {
  req: Request;
  user: A extends 'public' ? SessionUser | null : SessionUser;
  params: Record<string, string>;
}) => Promise<Response>;

/** Wraps a route handler with origin checks, authentication, role checks and error mapping. */
export function route<A extends Access>(access: A, handler: Handler<A>) {
  return async (req: Request, ctx?: RouteCtx): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const user = await getSessionUser(req);
      if (access !== 'public' && !user) throw unauthorized();
      if (access === 'admin' && user?.role !== 'admin') throw forbidden();
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ req, user: user as never, params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
