const httpRateBuckets = new Map();
const socketRateBuckets = new Map();

function isRateLimited(map, key, limit, windowMs) {
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
  const HTTP_RATE_LIMIT_PER_MIN = Number(process.env.HTTP_RATE_LIMIT_PER_MIN || (NODE_ENV === 'production' ? 180 : 1200));

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

export function enforceSocketRateLimit({ socketId, eventName, limitPerMinute, ip = 'unknown', userId = 'anonymous' }) {
  const bySocket = !isRateLimited(socketRateBuckets, `socket:${socketId}:${eventName}`, limitPerMinute, 60 * 1000);
  const byIp = !isRateLimited(socketRateBuckets, `ip:${ip}:${eventName}`, limitPerMinute * 3, 60 * 1000);
  const byUser = !isRateLimited(socketRateBuckets, `user:${userId}:${eventName}`, limitPerMinute * 2, 60 * 1000);
  return bySocket && byIp && byUser;
}
