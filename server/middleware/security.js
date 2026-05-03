/**
 * Security Middleware
 * Handles security headers, CORS validation
 */

export function applySecurityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
}

export function getAllowedOrigins(rawValue = '') {
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(origin, allowedOrigins = []) {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

export function getCorsOptions(allowedOrigins) {
  return {
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin denied'));
    },
    methods: ['GET', 'POST'],
  };
}

export function validateProductionConfig() {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
  const DATABASE_URL = process.env.DATABASE_URL || '';

  const allowedOrigins = getAllowedOrigins(CORS_ORIGIN);

  if (NODE_ENV === 'production' && allowedOrigins.length === 0) {
    console.warn('[CONFIG] CORS_ORIGIN is not set in production. All origins will be allowed until it is configured.');
  }

  if (DATABASE_URL && !getSafeDatabaseTarget(DATABASE_URL)) {
    console.error('[CONFIG] DATABASE_URL is set but invalid. Use a URL-encoded value.');
    process.exit(1);
  }

  if (!DATABASE_URL) {
    console.warn('[CONFIG] DATABASE_URL is not set. Backend will run without persistent storage.');
  }

  return { allowedOrigins };
}

export function getSafeDatabaseTarget(value = '') {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return null;
  }
}
