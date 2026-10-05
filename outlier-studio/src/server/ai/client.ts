import 'server-only';
import Groq from 'groq-sdk';
import { env } from '../env';
import { AppError } from '../errors';

const GROQ_API = 'https://api.groq.com';

let cached: { key: string; client: Groq } | undefined;

/**
 * The only place in the application that constructs an AI client.
 * The base URL is pinned to Groq. GROQ_BASE_URL is read solely under
 * NODE_ENV=test, where the test suite points it at a local stand-in server.
 */
export function getGroq(): Groq {
  const e = env();
  if (!e.GROQ_API_KEY) {
    throw new AppError(503, 'ai_not_configured', 'AI features are not set up on this server yet.');
  }
  const baseURL = e.NODE_ENV === 'test' && e.GROQ_BASE_URL ? e.GROQ_BASE_URL : GROQ_API;
  const key = `${e.GROQ_API_KEY}|${baseURL}|${e.GROQ_TIMEOUT_MS}|${e.GROQ_MAX_RETRIES}`;
  if (cached?.key !== key) {
    cached = {
      key,
      client: new Groq({
        apiKey: e.GROQ_API_KEY,
        baseURL,
        timeout: e.GROQ_TIMEOUT_MS,
        // The SDK retries connection errors, 408, 409, 429 and 5xx with backoff.
        maxRetries: e.GROQ_MAX_RETRIES,
      }),
    };
  }
  return cached.client;
}
