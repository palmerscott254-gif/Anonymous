const DEFAULT_BACKEND_PORT = 3001;
const DEFAULT_ANDROID_EMULATOR_URL = `http://10.0.2.2:${DEFAULT_BACKEND_PORT}`;
const DEFAULT_GENYMOTION_URL = `http://10.0.3.2:${DEFAULT_BACKEND_PORT}`;
const DEFAULT_PRODUCTION_API_URL = 'https://anonymous-193w.onrender.com';

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function normalizeCandidateUrl(value) {
  const trimmed = stripTrailingSlash(value);
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

function resolveDevelopmentFallbackUrl(runtime = globalThis) {
  const location = runtime?.location || {};
  const protocol = location.protocol === 'https:' ? 'https' : 'http';
  const hostname = String(location.hostname || '127.0.0.1').trim();
  const port = String(location.port || DEFAULT_BACKEND_PORT).trim();
  return normalizeCandidateUrl(`${protocol}://${hostname}:${port}`);
}

function getCapacitorPlatform(runtime = globalThis) {
  const capacitor = runtime?.Capacitor || runtime?.window?.Capacitor;
  if (typeof capacitor?.getPlatform === 'function') {
    return capacitor.getPlatform();
  }
  return null;
}

function isAndroidRuntime(runtime = globalThis) {
  return getCapacitorPlatform(runtime) === 'android';
}

function resolveAndroidFallback({ env = {}, runtime = globalThis } = {}) {
  if (env?.PROD || env?.MODE === 'production') {
    return DEFAULT_PRODUCTION_API_URL;
  }

  const configuredHost = env.VITE_ANDROID_HOST || runtime?.__GHOSTCHAT_ANDROID_HOST__ || '';
  if (configuredHost) {
    const normalizedHost = String(configuredHost).replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (normalizedHost) {
      return normalizeCandidateUrl(`http://${normalizedHost}`);
    }
  }

  const userAgent = String(runtime?.navigator?.userAgent || '');
  const hostname = String(runtime?.location?.hostname || '');

  if (/genymotion/i.test(userAgent) || hostname === '10.0.3.2') {
    return DEFAULT_GENYMOTION_URL;
  }

  if (hostname === '10.0.2.2') {
    return DEFAULT_ANDROID_EMULATOR_URL;
  }

  return DEFAULT_ANDROID_EMULATOR_URL;
}

export function resolveBackendBaseUrl({ kind = 'api', env = import.meta.env ?? {}, runtime = globalThis } = {}) {
  const explicit = kind === 'socket'
    ? env.VITE_SOCKET_URL || env.VITE_API_URL
    : env.VITE_API_URL || env.VITE_SOCKET_URL;

  if (explicit) {
    return normalizeCandidateUrl(explicit);
  }

  if (isAndroidRuntime(runtime)) {
    return resolveAndroidFallback({ env, runtime });
  }

  if (env?.PROD || env?.MODE === 'production') {
    return DEFAULT_PRODUCTION_API_URL;
  }

  return resolveDevelopmentFallbackUrl(runtime);
}

export function resolveApiBaseUrl(options = {}) {
  return resolveBackendBaseUrl({ ...options, kind: 'api' });
}

export function resolveSocketBaseUrl(options = {}) {
  return resolveBackendBaseUrl({ ...options, kind: 'socket' });
}

export function buildSocketOptions({ identity, token, env, runtime } = {}) {
  const authToken = token || null;
  return {
    url: resolveSocketBaseUrl({ env, runtime }),
    options: {
      auth: authToken ? { token: authToken } : undefined,
      autoConnect: true,
      forceNew: false,
      upgrade: true,
      withCredentials: true,
      tryAllTransports: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 15000,
      transports: ['websocket', 'polling'],
    },
    identity: identity || null,
  };
}