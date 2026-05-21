import { describe, expect, it } from 'vitest';
import { buildSocketOptions, resolveApiBaseUrl, resolveBackendBaseUrl, resolveSocketBaseUrl } from '../../src/services/runtimeUrl.js';

describe('runtime url resolution', () => {
  it('prefers explicit frontend environment values', () => {
    expect(resolveApiBaseUrl({ env: { VITE_API_URL: 'https://api.example.com' } })).toBe('https://api.example.com');
    expect(resolveSocketBaseUrl({ env: { VITE_SOCKET_URL: 'https://socket.example.com' } })).toBe('https://socket.example.com');
  });

  it('falls back to android emulator and genymotion hosts in native android runtimes', () => {
    const androidRuntime = { Capacitor: { getPlatform: () => 'android' } };
    const genymotionRuntime = {
      Capacitor: { getPlatform: () => 'android' },
      navigator: { userAgent: 'Genymotion Android' },
    };

    expect(resolveBackendBaseUrl({ runtime: androidRuntime })).toBe('http://10.0.2.2:3001');
    expect(resolveBackendBaseUrl({ runtime: genymotionRuntime })).toBe('http://10.0.3.2:3001');
  });

  it('falls back to the Render backend in production builds when env values are missing', () => {
    const prodRuntime = { Capacitor: { getPlatform: () => 'android' } };

    expect(resolveBackendBaseUrl({ env: { PROD: true }, runtime: prodRuntime })).toBe('https://anonymous-193w.onrender.com');
    expect(resolveBackendBaseUrl({ env: { PROD: true } })).toBe('https://anonymous-193w.onrender.com');
  });

  it('builds socket options with auth and reconnect tuning', () => {
    const options = buildSocketOptions({
      env: { VITE_SOCKET_URL: 'https://socket.example.com' },
      token: 'abc123',
      identity: { username: 'Ghost' },
    });

    expect(options.url).toBe('https://socket.example.com');
    expect(options.options.auth).toEqual({ token: 'abc123' });
    expect(options.options.reconnection).toBe(true);
    expect(options.options.timeout).toBe(15000);
  });
});