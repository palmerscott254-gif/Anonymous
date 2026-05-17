import 'dotenv/config';
import { getEnv } from './server/config/env.js';
import { getDbPool } from './server/db/pool.js';
import { runMigrations } from './server/db/migrate.js';
import { createGhostChatRuntime } from './server/appFactory.js';

const env = getEnv();
const dbPool = getDbPool();
const { httpServer } = createGhostChatRuntime({ env, dbPool });

runMigrations()
  .then((result) => {
    if (!result.skipped) {
      console.log(`[DB] Applied migrations: ${result.applied}`);
    }
  })
  .catch((error) => {
    console.error('[DB] Migration error:', error.message);
    process.exit(1);
  })
  .then(() => {
    httpServer.listen(env.PORT, () => {
      console.log(`GhostChat server ready on http://localhost:${env.PORT}`);
      console.log(`[CONFIG] NODE_ENV=${env.NODE_ENV}`);
      console.log(`[CONFIG] DATABASE=${env.DATABASE_URL ? 'configured' : 'disabled'}`);
    });
  });
