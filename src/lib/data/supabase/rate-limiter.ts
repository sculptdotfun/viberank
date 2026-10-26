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
  // One submission per hour per bucket (see submitRateLimitChecks): a
  // machine, a web upload, or an unproven username claim.
  submitData: {
    rate: 1,
    periodMs: 60 * 60 * 1000, // 1 per hour
  },
  // Every bucket of one username together. Per-machine buckets would
  // otherwise let anyone with a token mint a fresh machine id per request,
  // and every distinct id adds its own slice to the day's total.
  submitDataPerUser: {
    rate: 6,
    periodMs: 60 * 60 * 1000, // 6 per hour
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

/** One limit a submission has to pass. */
export interface RateLimitCheck {
  limitType: "submitData" | "submitDataPerUser";
  key: string;
  /** Says in the refusal which limit was hit, so the user knows what to wait out. */
  scope: string;
}

/**
 * The limits a submission is counted against.
 *
 * The limit used to be one per hour per username, so a second machine's daily
 * autosubmit, or a web upload after a CLI run, was refused with a 429 for
 * doing exactly what it should. Each machine now has its own hourly slot, and
 * so do web uploads.
 *
 * A machine id is only trusted from a caller who proved the account is theirs
 * (an API token or a GitHub session). The X-GitHub-User header is a claim
 * anyone can make, and if its machine id also bought a fresh slot, an
 * anonymous flood against one username would be limited by nothing. Those
 * submissions keep the old single slot per username.
 *
 * Usernames are compared case-insensitively everywhere else (profile lookup,
 * the target row), so they are here too.
 */
export function submitRateLimitChecks(data: {
  username: string;
  machineId?: string;
  source: "cli" | "oauth";
  verified: boolean;
}): RateLimitCheck[] {
  const user = data.username.toLowerCase();
  if (!data.verified) {
    return [{ limitType: "submitData", key: user, scope: `@${data.username} already submitted` }];
  }

  const bucket: RateLimitCheck =
    data.source === "oauth"
      ? { limitType: "submitData", key: `${user}#web`, scope: "You already uploaded a file" }
      : data.machineId
        ? { limitType: "submitData", key: `${user}#machine:${data.machineId}`, scope: "This machine already submitted" }
        : { limitType: "submitData", key: `${user}#cli`, scope: `@${data.username} already submitted` };

  return [
    bucket,
    {
      limitType: "submitDataPerUser",
      key: user,
      scope: `@${data.username} already submitted ${RATE_LIMITS.submitDataPerUser.rate} times`,
    },
  ];
}

/**
 * A submission refused by a rate limit. Carries the wait so the route can send
 * a Retry-After header rather than parse a number back out of the message.
 */
export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(scope: string, retryAfterSeconds: number) {
    const wait = Math.max(1, Math.ceil(retryAfterSeconds));
    const minutes = Math.ceil(wait / 60);
    const human = wait < 60 ? `${wait} seconds` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
    super(`Rate limit exceeded. ${scope} in the last hour. Please try again in ${human}.`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = wait;
  }
}

/** True for a RateLimitError, including one from a second copy of this module. */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError || (error instanceof Error && error.name === "RateLimitError");
}

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
