/**
 * API token minting and verification.
 *
 * Pure functions over crypto primitives so the format and hashing rules can be
 * unit-tested without a database or a request.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Recognisable in logs and pastes, and greppable if one leaks. */
export const TOKEN_PREFIX = "vbr_";

/** 32 bytes = 256 bits of entropy. */
const TOKEN_BYTES = 32;

export interface IssuedToken {
  /** Shown to the user exactly once. Never stored. */
  plaintext: string;
  /** What goes in the database. */
  hash: string;
  /** Safe-to-display fragment, e.g. "vbr_a1b2c3d4…". */
  hint: string;
}

export function generateToken(): IssuedToken {
  // base64url keeps it copy-pasteable and shell-safe — no +, / or = to quote.
  const plaintext = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
  return { plaintext, hash: hashToken(plaintext), hint: hintFor(plaintext) };
}

/**
 * SHA-256, not bcrypt/argon2.
 *
 * Those exist to make *low-entropy* secrets expensive to brute-force. A 256-bit
 * random token has nothing to guess, so a slow KDF would only add latency to
 * every submission. What matters here is that the stored value is one-way.
 */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function hintFor(plaintext: string): string {
  return `${plaintext.slice(0, TOKEN_PREFIX.length + 8)}…`;
}

/** Shape check before touching the database, so junk never becomes a query. */
export function looksLikeToken(value: string | null | undefined): value is string {
  if (!value || !value.startsWith(TOKEN_PREFIX)) return false;
  const body = value.slice(TOKEN_PREFIX.length);
  // 32 bytes base64url encodes to 43 chars, unpadded.
  return body.length === 43 && /^[A-Za-z0-9_-]+$/.test(body);
}

/**
 * Extract a bearer token from an Authorization header.
 * Returns null for anything that isn't a well-formed viberank token.
 */
export function bearerFrom(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  return looksLikeToken(match[1]) ? match[1] : null;
}

/**
 * Constant-time hash comparison.
 *
 * Lookups are by hash so this is belt-and-braces, but any code path that ends
 * up comparing two hashes directly should not leak position through timing.
 */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
