import 'dotenv/config';
import { runMigrations } from '../db/migrate.js';

runMigrations()
  .then((result) => {
    if (result.skipped) {
      console.log('Migrations skipped: DATABASE_URL is not configured');
      process.exit(0);
      return;
    }
    console.log(`Migrations applied: ${result.applied}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exit(1);
  });
