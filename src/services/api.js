import { resolveApiBaseUrl } from './runtimeUrl.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

function joinPath(base, path) {
  return `${String(base).replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
}

export function getApiBaseUrl(options = {}) {
  return resolveApiBaseUrl(options);
}

export function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function logRequestFailure({ method, requestUrl, error, timeoutMs }) {
  const details = {
    method,
    requestUrl,
    code: error?.code || 'REQUEST_FAILED',
    status: error?.status ?? 0,
  };

  if (error?.code === 'REQUEST_TIMEOUT') {
    console.error(`[API] ${method} ${requestUrl} timed out after ${timeoutMs}ms`, details);
    return;
  }

  console.error(`[API] ${method} ${requestUrl} failed`, details);
}

export async function apiRequest(path, { method = 'GET', body, token, headers = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, baseUrl } = {}) {
  const resolvedBaseUrl = baseUrl || getApiBaseUrl();
  const requestUrl = joinPath(resolvedBaseUrl, path);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(requestUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(token),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    const timedOut = error?.name === 'AbortError';
    const networkError = new Error(
      timedOut
        ? `Backend request timed out after ${timeoutMs}ms: ${resolvedBaseUrl}`
        : `Unable to reach backend at ${resolvedBaseUrl}`
    );
    networkError.status = 0;
    networkError.code = timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_UNREACHABLE';
    networkError.baseUrl = resolvedBaseUrl;
    networkError.requestUrl = requestUrl;
    networkError.path = path;
    networkError.method = method;
    networkError.cause = error;
    logRequestFailure({ method, requestUrl, error: networkError, timeoutMs });
    throw networkError;
  }

  if (timeoutId) clearTimeout(timeoutId);

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.error?.code || payload?.code || 'REQUEST_FAILED';
    error.payload = payload;
    error.baseUrl = resolvedBaseUrl;
    error.requestUrl = requestUrl;
    error.path = path;
    error.method = method;
    logRequestFailure({ method, requestUrl, error, timeoutMs });
    throw error;
  }

  return payload;
}