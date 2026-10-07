import { and, desc, eq, lt } from 'drizzle-orm';
import { attachGeneration } from './ai/usage';
import { getDb } from './db/client';
import { generations, type Generation } from './db/schema';
import { notFound } from './errors';

type Kind = Generation['kind'];

/** Saves an AI output for its owner and links it to the request that produced it. */
export async function saveGeneration(input: {
  userId: string;
  kind: Kind;
  title: string;
  input: unknown;
  output: unknown;
  requestId: string;
  videoId?: string;
  channelId?: string;
}): Promise<Generation> {
  const db = await getDb();
  const [row] = await db
    .insert(generations)
    .values({ userId: input.userId, kind: input.kind, title: input.title.slice(0, 120), input: input.input, output: input.output, videoId: input.videoId, channelId: input.channelId })
    .returning();
  if (!row) throw new Error('Failed to save generation');
  await attachGeneration(input.requestId, row.id);
  return row;
}

/** Every query below filters by userId: ownership is enforced in the database query, not in the UI. */
export async function listGenerations(userId: string, opts: { kind?: Kind; before?: Date; limit: number }) {
  const db = await getDb();
  const where = and(
    eq(generations.userId, userId),
    opts.kind ? eq(generations.kind, opts.kind) : undefined,
    opts.before ? lt(generations.createdAt, opts.before) : undefined,
  );
  return db
    .select({ id: generations.id, kind: generations.kind, title: generations.title, createdAt: generations.createdAt })
    .from(generations)
    .where(where)
    .orderBy(desc(generations.createdAt))
    .limit(opts.limit);
}

export async function getGeneration(userId: string, id: string): Promise<Generation> {
  const db = await getDb();
  const [row] = await db.select().from(generations).where(and(eq(generations.id, id), eq(generations.userId, userId))).limit(1);
  if (!row) throw notFound();
  return row;
}

export async function deleteGeneration(userId: string, id: string): Promise<void> {
  const db = await getDb();
  const deleted = await db
    .delete(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .returning({ id: generations.id });
  if (deleted.length === 0) throw notFound();
}
