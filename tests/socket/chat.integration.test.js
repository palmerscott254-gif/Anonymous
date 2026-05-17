import { describe, it, expect } from 'vitest';
import { io as ioClient } from 'socket.io-client';
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

function once(socket, eventName) {
  return new Promise((resolve) => {
    socket.once(eventName, resolve);
  });
}

describe('socket integration', () => {
  it('supports legacy room generation flow with ack', async () => {
    const runtime = createGhostChatRuntime({ env: buildEnv(), dbPool: null });
    const listener = await new Promise((resolve) => {
      const server = runtime.httpServer.listen(0, () => resolve(server));
    });

    const port = listener.address().port;
    const client = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
    });

    try {
      await once(client, 'connect');

      const readyPromise = once(client, 'session.ready');
      client.emit('session.hello', {
        deviceId: 'test-device',
        identity: { username: 'Alpha', emoji: 'A' },
      });
      await readyPromise;

      const generateResponse = await new Promise((resolve) => {
        client.emit(
          'room:generate',
          {
            kind: 'direct',
            ttlMinutes: 10,
            name: 'Test Room',
          },
          resolve
        );
      });

      expect(generateResponse?.ok).toBe(true);
      expect(generateResponse?.room?.code).toBeTypeOf('string');
    } finally {
      client.disconnect();
      await new Promise((resolve) => listener.close(resolve));
    }
  });
});
