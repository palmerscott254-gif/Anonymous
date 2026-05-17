const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function joinPath(base, path) {
  return `${String(base).replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(joinPath(API_BASE_URL, path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.error?.code || payload?.code || 'REQUEST_FAILED';
    error.payload = payload;
    throw error;
  }

  return payload;
}