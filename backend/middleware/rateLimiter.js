function createRateLimiter({ windowMs = 5 * 60 * 1000, max = 15, message = 'Too many requests. Please try again later.' } = {}) {
  const requests = new Map();

  // Periodic cleanup
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now > record.resetTime) {
        requests.delete(key);
      }
    }
  }, windowMs);
  if (cleanupInterval.unref) cleanupInterval.unref();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = requests.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requests.set(ip, record);
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retryAfterSeconds: retryAfter });
    }

    next();
  };
}

module.exports = { createRateLimiter };
