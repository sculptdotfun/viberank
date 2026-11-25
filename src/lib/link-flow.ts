/**
 * The device-link flow over a storage interface, so the routes stay thin and
 * the whole start → approve → poll path can be tested with the in-memory
 * store below.
 */

import {
  LINK_TTL_MS,
  POLL_INTERVAL_S,
  decideApprove,
  decidePoll,
  generateDeviceCode,
  generateUserCode,
  hashDeviceCode,
  linkTokenLabel,
  looksLikeDeviceCode,
  normalizeUserCode,
  pageState,
  verifyUrl,
  type LinkPageState,
  type LinkRow,
} from "./link";

export interface LinkStore {
  /** "collision" when the user code is taken; the caller draws another. */
  create(input: { userCode: string; deviceHash: string; expiresAt: number }): Promise<"ok" | "collision">;
  byDeviceHash(hash: string): Promise<LinkRow | null>;
  byUserCode(userCode: string): Promise<LinkRow | null>;
  touchPoll(id: string, at: number): Promise<void>;
  /** pending → approved; false if the row was no longer pending. */
  markApproved(id: string, who: { username: string; githubUsername: string }, at: number): Promise<boolean>;
  /** approved → consumed; false if another poll got there first. */
  markConsumed(id: string, at: number): Promise<boolean>;
  /** consumed → approved, when minting the token failed after consuming. */
  revertConsumed(id: string): Promise<void>;
  setTokenId(id: string, tokenId: string): Promise<void>;
}

export interface LinkStart {
  userCode: string;
  deviceCode: string;
  verifyUrl: string;
  interval: number;
  expiresIn: number;
}

export async function startLink(store: LinkStore, opts: { now: number; site: string }): Promise<LinkStart> {
  const device = generateDeviceCode();
  // 31^8 codes; a collision is a near-impossibility, but retry rather than 500.
  for (let attempt = 0; attempt < 5; attempt++) {
    const userCode = generateUserCode();
    const result = await store.create({ userCode, deviceHash: device.hash, expiresAt: opts.now + LINK_TTL_MS });
    if (result === "ok") {
      return {
        userCode,
        deviceCode: device.plaintext,
        verifyUrl: verifyUrl(opts.site, userCode),
        interval: POLL_INTERVAL_S,
        expiresIn: LINK_TTL_MS / 1000,
      };
    }
  }
  throw new Error("Failed to create a link code");
}

export type PollResult =
  | { status: "pending" | "slow_down" }
  | { status: "expired"; reason: "unknown" | "expired" | "used" }
  | { status: "approved"; token: string; username: string };

export interface IssueToken {
  (username: string, githubUsername: string, label: string): Promise<{ plaintext: string; id: string }>;
}

/**
 * One poll. The token is minted here, in the single request that wins the
 * approved → consumed update, and returned once; it is never stored.
 */
export async function pollLink(
  store: LinkStore,
  deviceCode: unknown,
  opts: { now: number; issueToken: IssueToken }
): Promise<PollResult> {
  if (!looksLikeDeviceCode(deviceCode)) return { status: "expired", reason: "unknown" };
  const row = await store.byDeviceHash(hashDeviceCode(deviceCode));
  const decision = decidePoll(row, opts.now);
  if (row && decision.kind !== "expired") await store.touchPoll(row.id, opts.now);

  if (decision.kind === "expired") return { status: "expired", reason: decision.reason };
  if (decision.kind === "pending" || decision.kind === "slow_down") return { status: decision.kind };
  if (!row) return { status: "expired", reason: "unknown" };

  if (!(await store.markConsumed(row.id, opts.now))) return { status: "expired", reason: "used" };
  try {
    const token = await opts.issueToken(decision.username, decision.githubUsername, linkTokenLabel(new Date(opts.now)));
    await store.setTokenId(row.id, token.id).catch(() => undefined);
    return { status: "approved", token: token.plaintext, username: decision.githubUsername };
  } catch (error) {
    // Put it back so the CLI's next poll can try again, rather than leave an
    // approved sign-in that can never deliver its token.
    await store.revertConsumed(row.id).catch(() => undefined);
    throw error;
  }
}

export type ApproveResult =
  | { ok: true; username: string; claimed: number }
  | { ok: false; status: number; code: string; error: string };

/**
 * Approve a code for the signed-in GitHub user, then claim their earlier
 * unverified CLI rows the way the site's claim banner does. A claim failure
 * never undoes the approval: the token is what they came for.
 */
export async function approveLink(
  store: LinkStore,
  rawCode: unknown,
  githubUsername: string,
  opts: { now: number; claim: (githubUsername: string) => Promise<number> }
): Promise<ApproveResult> {
  const code = normalizeUserCode(typeof rawCode === "string" ? rawCode : null);
  const row = code ? await store.byUserCode(code) : null;
  const decision = decideApprove(code, row, opts.now);
  if (decision.kind === "error") return { ok: false, status: decision.status, code: decision.code, error: decision.error };
  if (!row) throw new Error("unreachable");

  const won = await store.markApproved(row.id, { username: githubUsername, githubUsername }, opts.now);
  if (!won) return { ok: false, status: 409, code: "used", error: "That code was already used." };

  let claimed = 0;
  try {
    claimed = await opts.claim(githubUsername);
  } catch (error) {
    console.error("[link] claim after approve failed", error instanceof Error ? error.message : error);
  }
  return { ok: true, username: githubUsername, claimed };
}

export async function lookupLink(store: LinkStore, rawCode: string | null | undefined, now: number) {
  const code = normalizeUserCode(rawCode);
  const row = code ? await store.byUserCode(code) : null;
  return { code, state: pageState(code, row, now) as LinkPageState };
}

/** For the demo backend and tests. One instance per server process. */
export function createMemoryLinkStore(): LinkStore & { rows: Map<string, LinkRow> } {
  const rows = new Map<string, LinkRow>();
  let seq = 0;
  const find = (pred: (r: LinkRow) => boolean) => [...rows.values()].find(pred) ?? null;
  const copy = (r: LinkRow | null) => (r ? { ...r } : null);
  return {
    rows,
    async create({ userCode, deviceHash, expiresAt }) {
      if (find((r) => r.userCode === userCode)) return "collision";
      const id = `link-${++seq}`;
      rows.set(id, {
        id, userCode, deviceHash, status: "pending", username: null, githubUsername: null,
        createdAt: expiresAt - LINK_TTL_MS, expiresAt, lastPolledAt: null, tokenId: null,
      });
      return "ok";
    },
    async byDeviceHash(hash) { return copy(find((r) => r.deviceHash === hash)); },
    async byUserCode(code) { return copy(find((r) => r.userCode === code)); },
    async touchPoll(id, at) { const r = rows.get(id); if (r) r.lastPolledAt = at; },
    async markApproved(id, who) {
      const r = rows.get(id);
      if (!r || r.status !== "pending") return false;
      Object.assign(r, { status: "approved", ...who });
      return true;
    },
    async markConsumed(id) {
      const r = rows.get(id);
      if (!r || r.status !== "approved") return false;
      r.status = "consumed";
      return true;
    },
    async revertConsumed(id) { const r = rows.get(id); if (r?.status === "consumed") r.status = "approved"; },
    async setTokenId(id, tokenId) { const r = rows.get(id); if (r) r.tokenId = tokenId; },
  };
}
