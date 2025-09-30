import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Submission rate limits - very strict to prevent abuse
  submitData: {
    kind: "fixed window",
    rate: 1, // Only 1 submission per minute per user
    period: MINUTE,
  },
  
  // API endpoint rate limits
  apiGeneral: { 
    kind: "token bucket", 
    rate: 60, // 60 requests per minute
    period: MINUTE,
    capacity: 10, // Allow bursts of up to 10
  },
  
  // Failed submission attempts (even stricter)
  failedSubmissions: { 
    kind: "fixed window", 
    rate: 10, // Only 10 failed attempts per hour
    period: HOUR,
  },
  
  // Query rate limits for expensive operations
  expensiveQuery: {
    kind: "token bucket",
    rate: 20, // 20 per minute
    period: MINUTE,
    capacity: 5,
    shards: 5, // Use sharding for better performance
  },
});