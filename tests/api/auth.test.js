import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createGhostChatRuntime } from '../../server/appFactory.js';

function buildEnv() {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_URL: '',
    CORS_ORIGIN: '',
    JWT_SECRET: 'test-secret-abcdefghijklmnopqrstuvwxyz012345',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL_DAYS: 7,
    ROOM_TTL_DEFAULT_MINUTES: 10,
    ROOM_TTL_MAX_MINUTES: 24 * 60,
    HTTP_RATE_LIMIT_PER_MIN: 1000,
    SOCKET_RATE_LIMIT_PER_MIN: 1000,
  };
}

describe('auth api', () => {
  it('issues a guest token', async () => {
    const runtime = createGhostChatRuntime({ env: buildEnv(), dbPool: null });

    const response = await request(runtime.app)
      .post('/auth/guest')
      .send({ username: 'Tester' })
      .expect(200);

    expect(response.body?.tokens?.accessToken).toBeTypeOf('string');
    expect(response.body?.user?.username).toContain('Guest-');
  });

  it('returns 503 for register when DB is disabled', async () => {
    const runtime = createGhostChatRuntime({ env: buildEnv(), dbPool: null });

    const response = await request(runtime.app)
      .post('/auth/register')
      .send({ username: 'tester', password: 'password123' })
      .expect(503);

    expect(response.body?.error?.code).toBe('DB_REQUIRED');
  });
});
