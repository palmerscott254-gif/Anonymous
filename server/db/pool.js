import { Pool } from 'pg';
import { getEnv } from '../config/env.js';

let pool = null;

export function getDbPool() {
  if (pool) return pool;

  const env = getEnv();
  if (!env.DATABASE_URL) return null;

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === 'production' ? 10 : 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (error) => {
    console.error('[DB] Pool error:', error.message);
  });

  return pool;
}

export async function closeDbPool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
