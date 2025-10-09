interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
  blockDurationMs?: number; // How long to block after exceeding limit (optional)
}

export class RateLimitService {
  private requests: Map<string, RateLimitEntry>;
  private blockedIPs: Map<string, number>; // IP -> unblock timestamp

  constructor() {
    this.requests = new Map();
    this.blockedIPs = new Map();

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request should be allowed
   * @param identifier Unique identifier (usually IP address or user ID)
   * @param config Rate limit configuration
   * @returns Object with allowed status and remaining requests
   */
  checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    blocked: boolean;
  } {
    const now = Date.now();

    // Check if IP is blocked
    const blockUntil = this.blockedIPs.get(identifier);
    if (blockUntil && now < blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
        blocked: true,
      };
    } else if (blockUntil && now >= blockUntil) {
      // Unblock the IP
      this.blockedIPs.delete(identifier);
    }

    const entry = this.requests.get(identifier);

    // No previous requests or window expired
    if (!entry || now >= entry.resetTime) {
      const resetTime = now + config.windowMs;
      this.requests.set(identifier, {
        count: 1,
        resetTime,
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
        blocked: false,
      };
    }

    // Within the time window
    if (entry.count < config.maxRequests) {
      entry.count++;
      this.requests.set(identifier, entry);

      return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime,
        blocked: false,
      };
    }

    // Limit exceeded
    if (config.blockDurationMs) {
      const blockUntil = now + config.blockDurationMs;
      this.blockedIPs.set(identifier, blockUntil);
      console.warn(`[RateLimit] IP ${identifier} blocked until ${new Date(blockUntil).toISOString()}`);
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      blocked: false,
    };
  }

  /**
   * Manually block an IP address
   * @param identifier IP or user ID to block
   * @param durationMs Duration in milliseconds
   */
  blockIdentifier(identifier: string, durationMs: number): void {
    const blockUntil = Date.now() + durationMs;
    this.blockedIPs.set(identifier, blockUntil);
    console.warn(`[RateLimit] Manually blocked ${identifier} until ${new Date(blockUntil).toISOString()}`);
  }

  /**
   * Manually unblock an IP address
   * @param identifier IP or user ID to unblock
   */
  unblockIdentifier(identifier: string): void {
    this.blockedIPs.delete(identifier);
    this.requests.delete(identifier);
    console.log(`[RateLimit] Unblocked ${identifier}`);
  }

  /**
   * Check if an identifier is currently blocked
   * @param identifier IP or user ID
   */
  isBlocked(identifier: string): boolean {
    const blockUntil = this.blockedIPs.get(identifier);
    if (!blockUntil) return false;

    const now = Date.now();
    if (now >= blockUntil) {
      this.blockedIPs.delete(identifier);
      return false;
    }

    return true;
  }

  /**
   * Get statistics about rate limiting
   */
  getStats(): {
    activeRequests: number;
    blockedIPs: number;
    blockedList: Array<{ identifier: string; unblockTime: Date }>;
  } {
    return {
      activeRequests: this.requests.size,
      blockedIPs: this.blockedIPs.size,
      blockedList: Array.from(this.blockedIPs.entries()).map(([identifier, unblockTime]) => ({
        identifier,
        unblockTime: new Date(unblockTime),
      })),
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean expired request entries
    for (const [identifier, entry] of this.requests.entries()) {
      if (now >= entry.resetTime) {
        this.requests.delete(identifier);
      }
    }

    // Clean expired blocks
    for (const [identifier, blockUntil] of this.blockedIPs.entries()) {
      if (now >= blockUntil) {
        this.blockedIPs.delete(identifier);
      }
    }
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.requests.clear();
    this.blockedIPs.clear();
  }
}
