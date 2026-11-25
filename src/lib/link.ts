/**
 * Device link: sign a terminal in with GitHub in one step (`gh auth login`
 * style). Pure rules only — code format, hashing and the poll/approve state
 * machine — so they can be tested without a database or a request. The flow
 * that ties them to storage is in ./link-flow.ts.
 */

import { createHash, randomBytes, randomInt } from "node:crypto";

/** No 0/O, 1/I/L: a code read off a screen and typed elsewhere must survive it. */
export const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const USER_CODE_LENGTH = 8;
/** How long a code can be approved and polled. */
export const LINK_TTL_MS = 10 * 60 * 1000;
/** Seconds the CLI waits between polls. */
export const POLL_INTERVAL_S = 5;
/** A poll this much early still counts as on time (network jitter). */
const POLL_GRACE_MS = 1000;

export const DEVICE_CODE_PREFIX = "vbd_";
const DEVICE_CODE_BYTES = 32;

export type LinkStatus = "pending" | "approved" | "consumed" | "expired";

export interface LinkRow {
  id: string;
  userCode: string;
  deviceHash: string;
  status: LinkStatus;
  username: string | null;
  githubUsername: string | null;
  createdAt: number;
  expiresAt: number;
  lastPolledAt: number | null;
  tokenId: string | null;
}

/** "HXKT-4Q2M". `pick` is injectable so tests can drive it; randomInt is unbiased. */
export function generateUserCode(pick: (max: number) => number = randomInt): string {
  let raw = "";
  for (let i = 0; i < USER_CODE_LENGTH; i++) raw += USER_CODE_ALPHABET[pick(USER_CODE_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * The canonical XXXX-XXXX form of what someone typed or pasted, or null.
 * Case, spaces, dashes and underscores are forgiven; a character outside the
 * alphabet is not guessed at (an "O" could have been anything), it is refused.
 */
export function normalizeUserCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const raw = input.toUpperCase().replace(/[\s_-]+/g, "");
  if (raw.length !== USER_CODE_LENGTH) return null;
  for (const ch of raw) if (!USER_CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function hashDeviceCode(deviceCode: string): string {
  return createHash("sha256").update(deviceCode, "utf8").digest("hex");
}

export function generateDeviceCode(): { plaintext: string; hash: string } {
  const plaintext = DEVICE_CODE_PREFIX + randomBytes(DEVICE_CODE_BYTES).toString("base64url");
  return { plaintext, hash: hashDeviceCode(plaintext) };
}

/** Shape check so junk never becomes a query. */
export function looksLikeDeviceCode(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith(DEVICE_CODE_PREFIX)) return false;
  const body = value.slice(DEVICE_CODE_PREFIX.length);
  return body.length === 43 && /^[A-Za-z0-9_-]+$/.test(body);
}

export function verifyUrl(site: string, userCode: string): string {
  return `${site}/link?code=${encodeURIComponent(userCode)}`;
}

/** The token's label on /settings/tokens, so a linked machine is recognisable. */
export function linkTokenLabel(now: Date): string {
  return `CLI (linked ${now.toISOString().slice(0, 10)})`;
}

/** First hop of x-forwarded-for (Vercel sets it), else x-real-ip. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export type PollDecision =
  | { kind: "pending" }
  | { kind: "slow_down" }
  | { kind: "expired"; reason: "unknown" | "expired" | "used" }
  | { kind: "issue"; username: string; githubUsername: string };

/**
 * What a poll gets, given the row its device code finds.
 *
 * Final states come first so a dead code always says so. Then slow_down for a
 * poll inside the interval (RFC 8628 §3.5), even when approved: the CLI just
 * waits longer and gets the token on the next one. "issue" means: consume the
 * row and mint the token now — the caller must do that with a conditional
 * update so two racing polls cannot both win.
 */
export function decidePoll(row: LinkRow | null, now: number, intervalS: number = POLL_INTERVAL_S): PollDecision {
  if (!row) return { kind: "expired", reason: "unknown" };
  if (row.status === "consumed") return { kind: "expired", reason: "used" };
  if (row.status === "expired" || now >= row.expiresAt) return { kind: "expired", reason: "expired" };
  if (row.lastPolledAt !== null && now - row.lastPolledAt < intervalS * 1000 - POLL_GRACE_MS) {
    return { kind: "slow_down" };
  }
  if (row.status === "approved" && row.username && row.githubUsername) {
    return { kind: "issue", username: row.username, githubUsername: row.githubUsername };
  }
  return { kind: "pending" };
}

/** What the /link page shows for a code, before anyone presses anything. */
export type LinkPageState = "invalid" | "unknown" | "expired" | "used" | "pending";

export function pageState(normalized: string | null, row: LinkRow | null, now: number): LinkPageState {
  if (!normalized) return "invalid";
  if (!row) return "unknown";
  if (row.status === "approved" || row.status === "consumed") return "used";
  if (row.status === "expired" || now >= row.expiresAt) return "expired";
  return "pending";
}

export type ApproveDecision =
  | { kind: "approve" }
  | { kind: "error"; status: number; code: Exclude<LinkPageState, "pending">; error: string };

export const LINK_ERRORS: Record<Exclude<LinkPageState, "pending">, { status: number; error: string }> = {
  invalid: { status: 400, error: "That is not a viberank code. It looks like HXKT-4Q2M." },
  unknown: { status: 404, error: "No sign-in is waiting for that code. Run npx viberank-cli login again." },
  expired: { status: 410, error: "That code expired. Run npx viberank-cli login again for a new one." },
  used: { status: 409, error: "That code was already used." },
};

export function decideApprove(normalized: string | null, row: LinkRow | null, now: number): ApproveDecision {
  const state = pageState(normalized, row, now);
  if (state === "pending") return { kind: "approve" };
  return { kind: "error", code: state, ...LINK_ERRORS[state] };
}
