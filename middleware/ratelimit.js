// middleware/rateLimit.js
/**
 * Simple rate limiting middleware for Next.js API routes
 */
const rateLimit = {
    // Store request counts with IP as key
    visitors: new Map(),
    
    // Configuration
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // Max requests per minute
    
    /**
     * Reset rate limit counters periodically
     */
    init() {
      // Clear the map every windowMs
      setInterval(() => {
        this.visitors.clear();
      }, this.windowMs);
    },
    
    /**
     * Middleware function to apply rate limiting
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @param {Function} next - Next middleware function
     */
    middleware(req, res, next) {
      // Get visitor identifier (IP address)
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      
      // Get current count for this visitor
      const currentCount = this.visitors.get(ip) || 0;
      
      // Check if rate limit is exceeded
      if (currentCount >= this.maxRequests) {
        return res.status(429).json({
          error: 'Rate limit exceeded. Please try again later.'
        });
      }
      
      // Increment count
      this.visitors.set(ip, currentCount + 1);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', this.maxRequests - currentCount - 1);
      
      // Continue to next middleware/handler
      if (typeof next === 'function') {
        next();
      }
    }
  };
  
  // Initialize rate limiter
  rateLimit.init();
  
  /**
   * Apply rate limiting to a Next.js API handler
   * @param {Function} handler - Next.js API handler
   * @returns {Function} Rate-limited handler
   */
  export function withRateLimit(handler) {
    return (req, res) => {
      // Apply rate limiting
      rateLimit.middleware(req, res, () => {
        return handler(req, res);
      });
    };
  }