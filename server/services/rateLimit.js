/**
 * Rate Limiting Service
 * Handles HTTP and socket event rate limiting
 */

const httpRateBuckets = new Map();
const socketRateBuckets = new Map();

export function isRateLimited(map, key, limit, windowMs) {
  const now = Date.now();
  const bucket = map.get(key);
  if (!bucket || now > bucket.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return true;
  }

  return false;
}

export function enforceHttpRateLimit(req, res, next) {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const HTTP_RATE_LIMIT_PER_MIN = NODE_ENV === 'production' ? 180 : 1200;
  
  const ip = req.ip || req.socket?.remoteAddress || 'unknown-ip';
  const limited = isRateLimited(httpRateBuckets, `http:${ip}`, HTTP_RATE_LIMIT_PER_MIN, 60 * 1000);
  if (limited) {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again shortly.',
    });
    return;
  }
  next();
}

export function enforceSocketRateLimit(socketId, eventName, limitPerMinute) {
  return !isRateLimited(socketRateBuckets, `socket:${socketId}:${eventName}`, limitPerMinute, 60 * 1000);
}
