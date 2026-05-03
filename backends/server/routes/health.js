/**
 * Health Check Routes
 * Provides diagnostic endpoints
 */

export function setupHealthRoutes(app, options = {}) {
  const { dbPool, rooms, userSessions } = options;

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      env: process.env.NODE_ENV || 'development',
      uptimeSec: Math.floor(process.uptime()),
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      roomCount: rooms?.size || 0,
      sessionCount: userSessions?.size || 0,
      now: Date.now(),
    });
  });

  app.get('/health/ready', (_req, res) => {
    const ready = Boolean(process.env.DATABASE_URL);
    res.status(ready ? 200 : 503).json({
      ready,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      reason: ready ? 'ready' : 'DATABASE_URL missing',
    });
  });

  app.get('/health/db', async (_req, res) => {
    if (!dbPool) {
      res.status(503).json({
        status: 'error',
        database: 'unconfigured',
        reason: 'DATABASE_URL missing',
      });
      return;
    }

    const startedAt = Date.now();

    try {
      const result = await dbPool.query('SELECT 1 AS ok');
      const probeOk = result.rows?.[0]?.ok === 1;

      res.status(probeOk ? 200 : 503).json({
        status: probeOk ? 'ok' : 'error',
        database: probeOk ? 'reachable' : 'unexpected_result',
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        database: 'unreachable',
        latencyMs: Date.now() - startedAt,
        reason: error?.message || 'Database probe failed',
      });
    }
  });
}
