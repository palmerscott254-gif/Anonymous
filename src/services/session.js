import { apiRequest } from './api.js';
import { getAccessToken, getRefreshToken, refreshSession, clearAuthTokens } from './auth.js';

export async function fetchCurrentSession() {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  return apiRequest('/session/me', { token });
}

export async function refreshCurrentSession() {
  return refreshSession();
}

export async function logoutCurrentSession() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await apiRequest('/session/logout', { method: 'POST', body: { refreshToken } });
  }
  clearAuthTokens();
  return { ok: true };
}

export async function exchangeGuestSession(identity) {
  return apiRequest('/auth/guest', {
    method: 'POST',
    body: {
      username: identity?.username || 'Ghost',
      publicKey: identity?.keys?.encryptionPublicKey,
    },
  });
}