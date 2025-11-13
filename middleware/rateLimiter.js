// Simple in-memory rate limiter
// For production, consider using Redis-backed rate limiting

const rateLimit = new Map();

// Clean up old entries every 1 minute
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
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // Max requests per window
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    // Skip rate limiting in development (optional)
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
      return next();
    }

    // Use IP address as key (you can also use user ID for authenticated routes)
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

    // Reset if window has passed
    if (now > limiterData.resetTime) {
      limiterData.count = 1;
      limiterData.resetTime = now + windowMs;
      return next();
    }

    // Increment count
    limiterData.count++;

    // Check if limit exceeded
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

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - limiterData.count);
    res.setHeader('X-RateLimit-Reset', new Date(limiterData.resetTime).toISOString());

    next();
  };
};

// Preset limiters for different use cases
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later'
});

export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later'
});

export const aiLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 AI requests per hour (expensive operation)
  message: 'AI generation limit reached, please try again later'
});
