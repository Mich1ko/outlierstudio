import 'server-only';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { env } from '../env';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

type Holder = { db?: Promise<Db>; close?: () => Promise<void> };
const holder = ((globalThis as Record<string, unknown>).__appDb ??= {}) as Holder;

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

async function connect(): Promise<Db> {
  const { DATABASE_URL, PGLITE_DIR, NODE_ENV } = env();

  if (DATABASE_URL) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    holder.close = () => pool.end();
    // Schema is applied with `npm run db:migrate`, not at request time.
    return drizzle(pool, { schema }) as unknown as Db;
  }

  // Embedded Postgres for local development and tests.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  let dataDir: string | undefined;
  if (NODE_ENV !== 'test') {
    const fs = await import('node:fs/promises');
    dataDir = path.resolve(PGLITE_DIR);
    await fs.mkdir(path.dirname(dataDir), { recursive: true });
  }
  const client = new PGlite(dataDir);
  holder.close = () => client.close();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  holder.db ??= connect().catch((err) => {
    holder.db = undefined;
    throw err;
  });
  return holder.db;
}

/** Tests only: drop the connection so the next getDb() starts from an empty database. */
export async function resetDbForTests(): Promise<void> {
  if (env().NODE_ENV !== 'test') throw new Error('resetDbForTests is test-only');
  const close = holder.close;
  holder.db = undefined;
  holder.close = undefined;
  if (close) await close();
}
