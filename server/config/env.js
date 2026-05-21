import { createHash } from 'node:crypto';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-secret-change-me-immediately';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  CORS_ORIGIN: z.string().default(''),
  JWT_SECRET: z
    .preprocess((value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed || undefined;
    }, z.string().default(DEV_JWT_SECRET)),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  ROOM_TTL_DEFAULT_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(10),
  ROOM_TTL_MAX_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(24 * 60),
  HTTP_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(20).default(180),
  SOCKET_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(20).default(180),
});

let cachedEnv = null;

function deriveProductionJwtSecret(env) {
  const seed = [
    env?.JWT_SECRET,
    env?.DATABASE_URL,
    env?.CORS_ORIGIN,
    env?.RENDER_SERVICE_ID,
    env?.RENDER_EXTERNAL_URL,
    env?.PORT,
  ]
    .filter(Boolean)
    .join('|');

  return createHash('sha256').update(seed || 'ghostchat-production-secret').digest('hex');
}

function needsProductionJwtFallback(secret) {
  if (!secret) {
    return true;
  }

  if (secret.length < 32) {
    return true;
  }

  return secret === DEV_JWT_SECRET || secret.toLowerCase().includes('replace-this');
}

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnv = {
    ...parsed.data,
    DATABASE_URL: parsed.data.DATABASE_URL || '',
    CORS_ORIGIN: parsed.data.CORS_ORIGIN || '',
  };

  if (cachedEnv.NODE_ENV === 'production' && needsProductionJwtFallback(cachedEnv.JWT_SECRET)) {
    cachedEnv.JWT_SECRET = deriveProductionJwtSecret(process.env);
    console.warn('[CONFIG] JWT_SECRET missing in production; derived a fallback secret from the Render environment. Set a real secret to preserve token continuity across deploys.');
  }

  return cachedEnv;
}

export function getAllowedOrigins() {
  const env = getEnv();
  return env.CORS_ORIGIN.split(',').map((v) => v.trim()).filter(Boolean);
}
