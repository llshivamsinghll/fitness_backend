const rateLimit = new Map();
// In-memory per-process limiter; simple and fast for single-instance deployments.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimit.entries()) {
    if (now - value.resetTime > 60000) {
      rateLimit.delete(key);
    }
  }
}, 60000);

export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
      return next();
    }
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    let limiterData = rateLimit.get(key);

    if (!limiterData) {
      limiterData = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimit.set(key, limiterData);
      return next();
    }
    if (now > limiterData.resetTime) {
      limiterData.count = 1;
      limiterData.resetTime = now + windowMs;
      return next();
    }
    limiterData.count++;
    if (limiterData.count > max) {
      const retryAfter = Math.ceil((limiterData.resetTime - now) / 1000);
      
      console.warn(`[RATE_LIMIT] Rate limit exceeded for IP: ${key}`);
      
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(limiterData.resetTime).toISOString());
      
      return res.status(429).json({
        error: message,
        retryAfter: retryAfter,
        message: `Too many requests. Please try again in ${retryAfter} seconds.`
      });
    }
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - limiterData.count);
    res.setHeader('X-RateLimit-Reset', new Date(limiterData.resetTime).toISOString());

    next();
  };
};
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later'
});

export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

export const aiLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'AI generation limit reached, please try again later'
});
