/**
 * The parts of POST /api/submit that decide what to tell the caller.
 *
 * Kept out of the route file because Next only lets a route export its HTTP
 * handlers, and because these are the decisions worth testing: which failures
 * are the user's to fix (400), which are ours (5xx), and what the CLI prints
 * after a success.
 */

import { isSubmissionValidationError } from "./ccusage";
import { isRateLimitError } from "./data/supabase/rate-limiter";
import { VERIFIED_PROFILE_ERROR } from "./data/supabase/client";

export interface SubmitErrorResponse {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Map an error thrown while accepting a submission to a response.
 *
 * Typed errors come first. The substring checks that remain recognise
 * messages from the database client, which we don't control.
 */
export function submitErrorResponse(error: unknown): SubmitErrorResponse {
  if (isRateLimitError(error)) {
    return {
      status: 429,
      body: { error: error.message, retryAfter: error.retryAfterSeconds },
      headers: {
        "Retry-After": String(error.retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    };
  }

  if (isSubmissionValidationError(error)) {
    return { status: 400, body: { error: error.message } };
  }

  if (error instanceof Error) {
    if (error.message.includes(VERIFIED_PROFILE_ERROR)) {
      return { status: 403, body: { error: error.message } };
    }

    // Database clients spell this both ways ("timeout" and "timed out");
    // matching only the first let genuine timeouts fall through to the
    // generic 500 that blames the user's file.
    if (/timeout|timed out|deadline/i.test(error.message)) {
      return {
        status: 504,
        body: { error: "Request timed out. Please try again or submit smaller batches of data." },
      };
    }

    // Our own data-layer failures are retryable infrastructure errors. This
    // is checked before the looser "mutation"/"query" substring match below,
    // which would otherwise catch "Failed to query …" and report it as a 500.
    // The raw message is never echoed: it can leak schema and table names.
    if (
      error.message.includes("Failed to query") ||
      error.message.includes("Failed to update") ||
      error.message.includes("Failed to create")
    ) {
      return { status: 503, body: { error: "Database operation failed. Please try again later." } };
    }

    if (error.message.includes("Unauthenticated") || error.message.includes("authentication")) {
      return {
        status: 503,
        body: {
          error: "Server configuration error. The service is temporarily unavailable. Please try again later.",
        },
      };
    }

    if (error.message.includes("Server Error")) {
      return {
        status: 503,
        body: {
          error: "The database service is temporarily unavailable. Please try again in a few moments.",
          details:
            "This is usually a temporary issue with the database service. If it persists for more than 5 minutes, please report it.",
          retryAdvice: "Wait 30 seconds and try submitting again.",
        },
      };
    }

    if (error.message.includes("mutation") || error.message.includes("query")) {
      return { status: 500, body: { error: "Database operation failed. Please try again later." } };
    }
  }

  // Anything left is unexpected and ours. It used to ask the user to check
  // their cc.json, which sent people hunting through a file that every
  // validator had already accepted.
  return {
    status: 500,
    body: {
      error:
        "Failed to submit data because of a problem on our side. Please try again in a few minutes. If it keeps happening, report it at https://github.com/sculptdotfun/viberank/issues.",
    },
  };
}

/**
 * The submitting client from `X-Viberank-Client` ("cli/1.13.0", "mcp/1.2.0",
 * "web"), for analytics. Anything else becomes "other" so a free-text header
 * can't fill the dashboard with junk values; no header at all is "unknown".
 */
export function readClient(header: string | null): string {
  if (!header) return "unknown";
  const value = header.trim().toLowerCase();
  return /^[a-z][a-z0-9-]{0,23}(?:\/[0-9a-z][0-9a-z.+-]{0,31})?$/.test(value) ? value : "other";
}

/** "1.12.0" → [1, 12, 0]; null for anything that isn't a plain version. */
function parseVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** True only when `version` parses and is strictly older than `than`. */
export function isVersionBelow(version: string | null | undefined, than: string): boolean {
  const a = version ? parseVersion(version) : null;
  const b = parseVersion(than);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** The first CLI whose autosubmit schedule can find Node on macOS. */
export const AUTOSUBMIT_FIXED_IN = "1.13.0";

export const AUTOSUBMIT_RERUN_NOTICE =
  "If you turned on autosubmit, run `npx viberank-cli autosubmit` once more. Older versions set up a schedule that couldn't find Node on macOS and some Linux setups, so daily runs never arrived.";

/**
 * The line the CLI prints in grey after a successful submission.
 *
 * Schedules written by viberank-cli 1.12.0 and earlier on macOS can't find
 * node, so every scheduled run fails and the schedule can't repair itself.
 * The only way to reach those people is an interactive run, and a token
 * means they most likely set autosubmit up, so it goes to exactly them.
 *
 * It outranks the house promo, which it replaces. A paid sponsor's line is
 * kept and follows it.
 */
export function submitNotice(input: {
  cliVersion: string | null;
  tokenVerified: boolean;
  paidNotice: string | null;
  houseNotice: string;
}): string {
  const lines: string[] = [];
  if (input.tokenVerified && isVersionBelow(input.cliVersion, AUTOSUBMIT_FIXED_IN)) {
    lines.push(AUTOSUBMIT_RERUN_NOTICE);
  }
  if (input.paidNotice) lines.push(input.paidNotice);
  return lines.length > 0 ? lines.join("\n\n") : input.houseNotice;
}
