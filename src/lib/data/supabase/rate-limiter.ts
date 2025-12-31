/**
 * Supabase Rate Limiter
 *
 * Postgres-backed rate limiting to replace @convex-dev/rate-limiter
 * Uses a simple fixed-window approach stored in the rate_limits table.
 */

import { SupabaseClient } from "@supabase/supabase-js";

interface RateLimitConfig {
  rate: number; // Max requests per window
  periodMs: number; // Window size in milliseconds
  capacity?: number; // For token bucket (optional)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // Unix timestamp when rate limit resets
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  submitData: {
    rate: 1,
    periodMs: 60 * 60 * 1000, // 1 per hour
  },
  apiGeneral: {
    rate: 60,
    periodMs: 60 * 1000, // 60 per minute
    capacity: 10,
  },
  failedSubmissions: {
    rate: 10,
    periodMs: 60 * 60 * 1000, // 10 per hour
  },
  expensiveQuery: {
    rate: 20,
    periodMs: 60 * 1000, // 20 per minute
    capacity: 5,
  },
};

export class SupabaseRateLimiter {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Check if a request is allowed under the rate limit
   */
  async checkLimit(
    limitType: string,
    key: string
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[limitType];
    if (!config) {
      throw new Error(`Unknown rate limit type: ${limitType}`);
    }

    const now = Date.now();
    const windowStart = now - config.periodMs;

    // Get or create rate limit record
    const { data: existing } = await this.client
      .from("rate_limits")
      .select("*")
      .eq("key", key)
      .eq("limit_type", limitType)
      .single();

    if (!existing) {
      // First request - create record
      await this.client.from("rate_limits").insert({
        key,
        limit_type: limitType,
        tokens: 1,
        window_start: new Date(now).toISOString(),
        last_request: new Date(now).toISOString(),
      });

      return {
        allowed: true,
        remaining: config.rate - 1,
      };
    }

    const existingWindowStart = new Date(existing.window_start).getTime();

    // Check if we're in a new window
    if (existingWindowStart < windowStart) {
      // New window - reset counter
      await this.client
        .from("rate_limits")
        .update({
          tokens: 1,
          window_start: new Date(now).toISOString(),
          last_request: new Date(now).toISOString(),
        })
        .eq("id", existing.id);

      return {
        allowed: true,
        remaining: config.rate - 1,
      };
    }

    // Same window - check if under limit
    if (existing.tokens >= config.rate) {
      // Rate limited
      const retryAfter = existingWindowStart + config.periodMs;
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    // Increment counter
    await this.client
      .from("rate_limits")
      .update({
        tokens: existing.tokens + 1,
        last_request: new Date(now).toISOString(),
      })
      .eq("id", existing.id);

    return {
      allowed: true,
      remaining: config.rate - existing.tokens - 1,
    };
  }

  /**
   * Record a failed attempt (for tracking failed submissions)
   */
  async recordFailure(limitType: string, key: string): Promise<void> {
    await this.checkLimit(limitType, key);
  }

  /**
   * Reset rate limit for a key (for admin use)
   */
  async reset(limitType: string, key: string): Promise<void> {
    await this.client
      .from("rate_limits")
      .delete()
      .eq("key", key)
      .eq("limit_type", limitType);
  }
}
