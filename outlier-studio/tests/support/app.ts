import { afterAll, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, resetDbForTests } from '@/server/db/client';
import { aiRequests, users } from '@/server/db/schema';
import { POST as signupRoute } from '@/app/api/auth/signup/route';
import { FakeGroq } from './fake-groq';

export const ORIGIN = 'http://localhost:3000';

type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Starts the stand-in Groq server and gives every test an empty database. */
export function useTestApp(): FakeGroq {
  const groq = new FakeGroq();
  beforeAll(async () => {
    process.env.GROQ_BASE_URL = await groq.start();
    process.env.GROQ_API_KEY = 'gsk_test_key';
    process.env.GROQ_MAX_RETRIES = '0';
    process.env.APP_URL = ORIGIN;
    delete process.env.DATABASE_URL;
  });
  beforeEach(async () => {
    groq.reset();
    process.env.GROQ_API_KEY = 'gsk_test_key';
    process.env.GROQ_MAX_RETRIES = '0';
    delete process.env.GROQ_MODEL_QUALITY;
    await resetDbForTests();
  });
  afterAll(async () => {
    await groq.stop();
  });
  return groq;
}

export async function call(
  handler: Handler,
  method: string,
  path: string,
  opts: { body?: unknown; cookie?: string; headers?: Record<string, string>; params?: Record<string, string>; rawBody?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.cookie) headers.cookie = opts.cookie;
  let body: string | undefined;
  if (opts.rawBody !== undefined) body = opts.rawBody;
  else if (opts.body !== undefined) body = JSON.stringify(opts.body);
  if (body !== undefined && !('content-type' in headers)) headers['content-type'] = 'application/json';
  if (method !== 'GET' && !('origin' in headers)) headers.origin = ORIGIN;
  const req = new Request(`${ORIGIN}${path}`, { method, headers, body });
  return handler(req, opts.params ? { params: Promise.resolve(opts.params) } : undefined);
}

let counter = 0;
export async function newUser(email = `user${++counter}@example.com`) {
  const res = await call(signupRoute, 'POST', '/api/auth/signup', {
    body: { email, password: 'correct horse battery', name: 'Test User' },
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  const { user } = (await res.json()) as { user: { id: string; email: string; role: string; plan: string } };
  return { cookie, user };
}

export async function makeAdmin(userId: string): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, userId));
}

export async function requestRows(userId: string) {
  const db = await getDb();
  return db.select().from(aiRequests).where(eq(aiRequests.userId, userId)).orderBy(aiRequests.createdAt);
}

export async function readSse(res: Response): Promise<{ event: string; data: any }[]> {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? '';
      const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null');
      return { event, data };
    });
}

export const TRANSCRIPT =
  'Most people stretch before they run and it is making them slower. Here is what the research actually says, and the two minute warm up I use instead before every single run.';
