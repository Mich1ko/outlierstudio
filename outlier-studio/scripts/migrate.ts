/** Apply SQL migrations to the Postgres database in DATABASE_URL. */
import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. (The embedded dev database migrates itself on startup.)');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
