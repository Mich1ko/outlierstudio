import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'groq-sdk';
import { AppError } from '../errors';

type GroqErrorBody = { message?: string; type?: string; code?: string };

function body(err: APIError): GroqErrorBody {
  const raw = err.error as { error?: GroqErrorBody } & GroqErrorBody | undefined;
  return raw?.error ?? raw ?? {};
}

/**
 * Turns anything thrown by the Groq SDK into a message that is safe and useful
 * to show. There is no fallback to another provider: a Groq failure is reported
 * as a Groq failure.
 */
export function mapGroqError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof APIUserAbortError) {
    return new AppError(499, 'client_aborted', 'The request was cancelled.');
  }
  if (err instanceof APIConnectionTimeoutError) {
    return new AppError(504, 'ai_timeout', 'The AI service took too long to respond. Please try again.');
  }
  if (err instanceof APIConnectionError) {
    return new AppError(503, 'ai_unavailable', 'The AI service (Groq) could not be reached. Please try again shortly.');
  }
  if (err instanceof APIError) {
    const { code, message } = body(err);
    const status = err.status as number | undefined;

    if (status === 429) {
      const retry = Number(err.headers?.get('retry-after'));
      return new AppError(429, 'ai_rate_limited', 'The AI service is at its rate limit. Please retry in a moment.', {
        retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : undefined,
      });
    }
    if (code === 'model_not_found' || code === 'model_decommissioned' || status === 404) {
      return new AppError(
        503,
        'ai_model_unavailable',
        'The configured AI model is no longer available. An administrator needs to update the model setting.',
      );
    }
    if (status === 401 || status === 403) {
      return new AppError(503, 'ai_not_configured', 'AI features are not set up correctly on this server.');
    }
    if (status === 413) {
      return new AppError(413, 'ai_input_too_large', 'That input is too long for the AI model. Shorten it and try again.');
    }
    if (status === 400 && (code === 'json_validate_failed' || /does not match the expected schema/i.test(message ?? ''))) {
      return new AppError(502, 'ai_invalid_output', 'The AI returned an unusable response. Please try again.');
    }
    if (status !== undefined && status >= 500) {
      return new AppError(503, 'ai_unavailable', 'The AI service (Groq) is having problems. Please try again shortly.');
    }
    return new AppError(502, 'ai_request_rejected', 'The AI service rejected the request.');
  }

  // Not a Groq error: let the route wrapper log it and return a generic 500.
  throw err;
}
