import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, getApiBaseUrl } from '../../src/services/api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('resolves the configured api base url', () => {
    expect(getApiBaseUrl({ env: { VITE_API_URL: 'https://api.example.com' } })).toBe('https://api.example.com');
  });

  it('requests the health endpoint from the provided base url', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    vi.stubGlobal('fetch', fetchSpy);

    const payload = await apiRequest('/health', { baseUrl: 'http://localhost:3001' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/health',
      expect.objectContaining({ method: 'GET' })
    );
    expect(payload).toEqual({ status: 'ok' });
  });

  it('turns network failures into a friendly backend error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiRequest('/health', { baseUrl: 'http://localhost:3001' })).rejects.toMatchObject({
      code: 'NETWORK_UNREACHABLE',
      status: 0,
    });
  });
});