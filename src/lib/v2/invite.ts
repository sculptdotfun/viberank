// The invite loop's pure parts: reading a handle someone typed, the /vs
// links and post text, and the head-to-head arithmetic. No React, no data
// access, so the page, the OG image, the dialog and the tests share them.

export const SITE = "https://www.viberank.app";

/**
 * A handle as people paste it: "@octocat", "octocat", "github.com/octocat",
 * "https://www.viberank.app/profile/octocat/". Returns the bare handle, or
 * null when what is left cannot be one. GitHub logins are 1–39 letters,
 * digits and single hyphens; older viberank rows also carry dots and
 * underscores, so those pass too.
 */
export function parseHandle(input: string): string | null {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^(github\.com|viberank\.app)\/(profile\/)?/i, "");
  s = s.replace(/[/?#].*$/, "").replace(/^@/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,38}$/.test(s)) return null;
  if (/--|\.\./.test(s) || /[-.]$/.test(s)) return null;
  return s;
}

export function sameHandle(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function vsPath(a: string, b: string): string {
  return `/vs/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;
}

export function vsUrl(a: string, b: string): string {
  return `${SITE}${vsPath(a, b)}`;
}

/** The post a challenger sends, without the link (X adds it from the url param). */
export function challengeText(opponent: string, rank: number | null): string {
  const me = rank === null ? "I'm on viberank this week." : `I'm #${rank} on viberank this week.`;
  return `${me} @${opponent}, beat me:`;
}

/** What to send someone who isn't on viberank yet. */
export function inviteText(challenger: string, opponent: string): string {
  return `@${opponent}, @${challenger} wants a head-to-head on viberank this week. One command to join: npx viberank-cli`;
}

// ============================================================================
// HEAD-TO-HEAD MATH
// ============================================================================

export interface VsSide {
  cost: number;
  tokens: number;
  /** Cost per day, Monday first. */
  days: number[];
}

export type Leader = "a" | "b" | "tie" | "none";

export interface WeekComparison {
  leader: Leader;
  /** Absolute cost difference, cents. */
  gap: number;
  /** Leader's cost over the trailer's; null when the trailer has none. */
  ratio: number | null;
  /** Days each side spent more on, counting only days someone used. */
  dayWins: { a: number; b: number; tie: number };
  /** Times the running total changed hands Monday to Sunday. */
  leadChanges: number;
  tokenLeader: Leader;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function leaderOf(a: number, b: number): Leader {
  if (a <= 0 && b <= 0) return "none";
  if (Math.abs(a - b) < 0.005) return "tie";
  return a > b ? "a" : "b";
}

export function compareWeek(a: VsSide, b: VsSide): WeekComparison {
  const leader = leaderOf(a.cost, b.cost);
  const hi = Math.max(a.cost, b.cost);
  const lo = Math.min(a.cost, b.cost);
  const dayWins = { a: 0, b: 0, tie: 0 };
  let running = 0;
  let side: "a" | "b" | null = null;
  let leadChanges = 0;
  for (let i = 0; i < 7; i++) {
    const da = a.days[i] ?? 0;
    const db = b.days[i] ?? 0;
    const day = leaderOf(da, db);
    if (day === "a" || day === "b") dayWins[day]++;
    else if (day === "tie") dayWins.tie++;
    running += da - db;
    const now: "a" | "b" | null = running > 0.005 ? "a" : running < -0.005 ? "b" : side;
    if (side !== null && now !== side) leadChanges++;
    side = now;
  }
  return {
    leader,
    gap: round2(hi - lo),
    ratio: leader === "a" || leader === "b" ? (lo > 0 ? round2(hi / lo) : null) : null,
    dayWins,
    leadChanges,
    tokenLeader: leaderOf(a.tokens, b.tokens),
  };
}

export interface VsWeek {
  weekId: string;
  a: number;
  b: number;
}

export interface Tally {
  a: number;
  b: number;
  tie: number;
  /** Weeks where at least one side had usage. */
  played: number;
  /** Current run of consecutive wins, newest week last in the input. */
  streak: { side: "a" | "b"; weeks: number } | null;
}

/** Wins per side over weeks given oldest first; a week neither used is not played. */
export function tallyWeeks(weeks: VsWeek[]): Tally {
  const tally: Tally = { a: 0, b: 0, tie: 0, played: 0, streak: null };
  for (const week of weeks) {
    const result = leaderOf(week.a, week.b);
    if (result === "none") continue;
    tally.played++;
    if (result === "tie") {
      tally.tie++;
      tally.streak = null;
      continue;
    }
    tally[result]++;
    tally.streak = tally.streak?.side === result ? { side: result, weeks: tally.streak.weeks + 1 } : { side: result, weeks: 1 };
  }
  return tally;
}

/** Bar heights (0–100) for two Mon–Sun series on one shared scale. */
export function pairedHeights(a: number[], b: number[]): { a: number[]; b: number[] } {
  const max = Math.max(0, ...a.slice(0, 7), ...b.slice(0, 7));
  const scale = (v: number) => (v > 0 && max > 0 ? Math.max(6, Math.round((v / max) * 100)) : 0);
  return {
    a: Array.from({ length: 7 }, (_, i) => scale(a[i] ?? 0)),
    b: Array.from({ length: 7 }, (_, i) => scale(b[i] ?? 0)),
  };
}

/**
 * A league's own board from site-wide rows: ordered by cost (ties to tokens,
 * then handle), re-ranked 1..n, with the gap to the member above.
 */
export function leagueRanks<T extends { username: string; cost: number; tokens: number; rank: number; gap: number | null }>(rows: T[]): T[] {
  return rows
    .slice()
    .sort((x, y) => y.cost - x.cost || y.tokens - x.tokens || x.username.localeCompare(y.username))
    .map((row, i, sorted) => ({
      ...row,
      rank: i + 1,
      gap: i === 0 ? null : Math.max(0, round2(sorted[i - 1].cost - row.cost + 0.01)),
    }));
}
