const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const API_BASE_URL = import.meta.env.VITE_API_URL || SOCKET_SERVER_URL;
const ACCESS_TOKEN_KEY = 'gc.auth.accessToken';

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

export async function fetchGuestSession(identity) {
  const response = await fetch(`${API_BASE_URL}/auth/guest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: identity?.username || 'Ghost',
      publicKey: identity?.keys?.encryptionPublicKey,
    }),
  });

  if (!response.ok) {
    throw new Error('Unable to initialize guest session');
  }

  const payload = await response.json();
  if (payload?.tokens?.accessToken) {
    setAccessToken(payload.tokens.accessToken);
  }
  return payload;
}
