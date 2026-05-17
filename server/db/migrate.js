import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDbPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const pool = getDbPool();
  if (!pool) {
    console.warn('[DB] DATABASE_URL missing, skipping migrations');
    return { applied: 0, skipped: true };
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationDir = path.join(__dirname, 'migrations');
  const allFiles = (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  let applied = 0;

  for (const fileName of allFiles) {
    const version = fileName;
    const already = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (already.rowCount > 0) {
      continue;
    }

    const fullPath = path.join(migrationDir, fileName);
    const sql = await readFile(fullPath, 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
      await client.query('COMMIT');
      applied += 1;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, skipped: false };
}
