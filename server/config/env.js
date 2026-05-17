import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  CORS_ORIGIN: z.string().default(''),
  JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-immediately'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  ROOM_TTL_DEFAULT_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(10),
  ROOM_TTL_MAX_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(24 * 60),
  HTTP_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(20).default(180),
  SOCKET_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(20).default(180),
});

let cachedEnv = null;

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

  if (cachedEnv.NODE_ENV === 'production' && cachedEnv.JWT_SECRET.includes('dev-only-secret')) {
    throw new Error('JWT_SECRET must be overridden in production');
  }

  return cachedEnv;
}

export function getAllowedOrigins() {
  const env = getEnv();
  return env.CORS_ORIGIN.split(',').map((v) => v.trim()).filter(Boolean);
}
