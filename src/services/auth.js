import { apiRequest } from './api.js';

const ACCESS_TOKEN_KEY = 'gc.auth.accessToken';
const REFRESH_TOKEN_KEY = 'gc.auth.refreshToken';

export function getAccessToken() {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setAccessToken(token) {
  try {
    if (!token) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      return;
    }
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // Ignore storage failures
  }
}

export function getRefreshToken() {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setRefreshToken(token) {
  try {
    if (!token) {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // Ignore storage failures
  }
}

export function clearAuthTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}

function cacheTokens(tokens = {}) {
  if (tokens?.accessToken) setAccessToken(tokens.accessToken);
  if (tokens?.refreshToken) setRefreshToken(tokens.refreshToken);
}

export async function fetchGuestSession(identity) {
  const payload = await apiRequest('/auth/guest', {
    method: 'POST',
    body: {
      username: identity?.username || 'Ghost',
      publicKey: identity?.keys?.encryptionPublicKey,
    },
  });
  cacheTokens(payload?.tokens);
  return payload;
}

export async function register(credentials) {
  const payload = await apiRequest('/auth/register', { method: 'POST', body: credentials });
  cacheTokens(payload?.tokens);
  return payload;
}

export async function login(credentials) {
  const payload = await apiRequest('/auth/login', { method: 'POST', body: credentials });
  cacheTokens(payload?.tokens);
  return payload;
}

export async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }
  const payload = await apiRequest('/auth/refresh', { method: 'POST', body: { refreshToken } });
  cacheTokens(payload?.tokens);
  return payload;
}

export async function logoutSession() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } });
  }
  clearAuthTokens();
  return { ok: true };
}
