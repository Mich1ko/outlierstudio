/** Browser-side helper for calling this app's own API. */

export type FieldIssue = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
  /** Per-field problems from server-side validation, keyed by field name. */
  get fields(): Record<string, string> {
    if (this.code !== 'invalid_input' || !Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as FieldIssue[]).map((d) => [d.field, d.message]));
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  let code = 'unknown';
  let message = 'Something went wrong. Please try again.';
  let details: unknown;
  try {
    const body = await res.json();
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
    details = body.error?.details;
  } catch {
    /* non-JSON error body */
  }
  const retry = Number(res.headers.get('retry-after'));
  return new ApiError(res.status, code, message, details, Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      credentials: 'same-origin',
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    const error = await toApiError(res);
    // An expired session anywhere inside the app sends the user to sign in.
    if (error.status === 401 && error.code === 'unauthorized' && location.pathname.startsWith('/app')) {
      location.assign('/login');
    }
    throw error;
  }
  return (await res.json()) as T;
}

/** Tell the shell to re-read the credit balance after something was generated. */
export function refreshCredits(): void {
  window.dispatchEvent(new Event('credits:refresh'));
}

/** Drops empty strings so optional fields are omitted rather than sent as "". */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as Partial<T>;
}
