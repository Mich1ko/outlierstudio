/**
 * Grant the admin role to an existing account:
 *   npm run admin:promote -- you@example.com
 * Admin is granted only from the server's command line, never from a signup field.
 */
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { users } from '../src/server/db/schema';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run admin:promote -- <email>');
  process.exit(1);
}

type AnyDb = PgDatabase<PgQueryResultHKT>;

async function open(): Promise<{ db: AnyDb; close: () => Promise<void> }> {
  if (process.env.DATABASE_URL) {
    const pg = (await import('pg')).default;
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    return { db: drizzle(pool) as unknown as AnyDb, close: () => pool.end() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const client = new PGlite(path.resolve(process.env.PGLITE_DIR || './.data/pglite'));
  return { db: drizzle(client) as unknown as AnyDb, close: () => client.close() };
}

const { db, close } = await open();
try {
  const updated = await db.update(users).set({ role: 'admin' }).where(eq(users.email, email)).returning({ id: users.id });
  if (updated.length === 0) {
    console.error(`No account found for ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
  } else {
    console.log(`${email} is now an admin.`);
  }
} finally {
  await close();
}
