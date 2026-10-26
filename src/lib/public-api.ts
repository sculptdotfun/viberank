/**
 * Shapes for the read-only JSON routes /api/leaderboard and
 * /api/profile/[username].
 *
 * The MCP server codes against these field names, so they are a contract:
 * add fields if needed, but don't rename or retype the ones here.
 */

import type { ProfileWithSubmissions, Submission } from "./data/types";
import { profileHandle } from "./profile-index";
import { profileUrl } from "./site";

export const LEADERBOARD_DEFAULT_LIMIT = 10;
export const LEADERBOARD_MAX_LIMIT = 50;

export interface LeaderboardQuery {
  limit: number;
  tool?: string;
}

/**
 * `?limit=N&tool=slug`. A missing or unreadable limit is the default rather
 * than an error, and anything above the cap is the cap, so a caller asking
 * for "100" gets 50 rows instead of nothing.
 */
export function parseLeaderboardQuery(params: URLSearchParams): LeaderboardQuery | { error: string } {
  const rawLimit = params.get("limit");
  const parsed = rawLimit === null ? NaN : Number.parseInt(rawLimit, 10);
  const limit = Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, LEADERBOARD_MAX_LIMIT)
    : LEADERBOARD_DEFAULT_LIMIT;

  const rawTool = params.get("tool")?.trim().toLowerCase();
  if (!rawTool) return { limit };
  // Tool keys are ccusage agent names ("claude", "codex", "opencode"). Anything
  // else can't match a row, and would only become a cache key.
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(rawTool)) {
    return { error: `Unknown tool "${rawTool.slice(0, 40)}". Use a tool slug like claude, codex or gemini.` };
  }
  return { limit, tool: rawTool };
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  totalCost: number;
  totalTokens: number;
  tools: string[];
  verified: boolean;
  underReview: boolean;
  profileUrl: string;
}

/**
 * Rows from getLeaderboard, ranked by position. That is the same rank the
 * homepage and /tool/[tool] boards print next to each row.
 */
export function shapeLeaderboardEntries(items: Submission[]): LeaderboardEntry[] {
  return items.map((submission, index) => {
    const handle = profileHandle(submission);
    return {
      rank: index + 1,
      username: handle,
      totalCost: submission.totalCost,
      totalTokens: submission.totalTokens,
      tools: submission.tools ?? [],
      verified: submission.verified,
      underReview: (submission.reviewReasons?.length ?? 0) > 0,
      profileUrl: profileUrl(handle),
    };
  });
}

export interface ProfileSummary {
  username: string;
  rank: number | null;
  totalCost: number;
  totalTokens: number;
  daysTracked: number;
  tools: string[];
  verified: boolean;
  profileUrl: string;
}

/**
 * The profile page's headline numbers. Totals sum every submission and days
 * are distinct dates, as on the page; rank comes from the best submission, as
 * on the board, and is computed by the caller.
 */
export function shapeProfileSummary(profile: ProfileWithSubmissions, rank: number | null): ProfileSummary {
  const submissions = profile.submissions ?? [];
  const dates = new Set(submissions.flatMap((s) => (s.dailyBreakdown ?? []).map((d) => d.date)));
  return {
    username: profileHandle(profile),
    rank,
    totalCost: submissions.reduce((sum, s) => sum + s.totalCost, 0),
    totalTokens: submissions.reduce((sum, s) => sum + s.totalTokens, 0),
    daysTracked: dates.size,
    tools: Array.from(new Set(submissions.flatMap((s) => s.tools ?? []))).sort(),
    verified: submissions.some((s) => s.verified),
    profileUrl: profileUrl(profile.username),
  };
}

/** The best submission's cost, which is what the board ranks a profile by. */
export function bestSubmissionCost(profile: ProfileWithSubmissions): number {
  return (profile.submissions ?? []).reduce((best, s) => Math.max(best, s.totalCost), 0);
}
