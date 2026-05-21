import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map();
const mockSocket = {
  id: 'socket-id',
  connected: true,
  auth: undefined,
  on: vi.fn((eventName, callback) => {
    handlers.set(eventName, callback);
    return mockSocket;
  }),
  onAny: vi.fn(),
  offAny: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

const { initSocket } = await import('../../src/services/socket.js');

beforeEach(() => {
  handlers.clear();
  mockSocket.emit.mockClear();
  mockSocket.on.mockClear();
  mockSocket.onAny.mockClear();
  mockSocket.offAny.mockClear();
  mockSocket.connect.mockClear();
  mockSocket.disconnect.mockClear();
  mockSocket.removeAllListeners.mockClear();
});

describe('socket service', () => {
  it('boots with auth and emits session hello on connect', () => {
    initSocket({
      identity: { username: 'Ghost', emoji: '👤' },
      token: 'token-123',
    });

    expect(mockSocket.on).toHaveBeenCalled();
    expect(typeof handlers.get('connect')).toBe('function');

    handlers.get('connect')();

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'session.hello',
      expect.objectContaining({
        token: 'token-123',
        identity: expect.objectContaining({ username: 'Ghost', emoji: '👤' }),
      })
    );
  });
});