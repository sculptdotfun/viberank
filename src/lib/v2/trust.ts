// Who is Ranked, who is on Open and who is a Fleet. Pure, so the Supabase
// and demo backends classify identically and the rules are unit-tested.
//
// Order matters: the plan ceiling comes first, because a team under one handle
// is a fleet whether or not it is verified. Below the ceiling, an entry is
// Ranked only when it is GitHub-verified and not under review.

import {
  FLEET_PLAN_EQ,
  PLAN_EQ_USD_PER_WEEK,
  type BoardClass,
  type TrustMark,
} from "./contract";

export const HELD_NOT_VERIFIED = "Not verified with GitHub";
export const HELD_ABOVE_CEILING = `Above ${FLEET_PLAN_EQ} plans a week`;
export const HELD_UNDER_REVIEW = "Under review";

/**
 * Plan-equivalents for `cost` spent over `windowDays` days: how many fully
 * used top-tier plans that spend is, at the weekly rate (#195). A week is 7
 * days; a month to date or a lifetime scales the yardstick to its length.
 * Windows shorter than a week count as a week, the same as the live week
 * itself, so day 2 of a month doesn't make a heavy user look like a fleet.
 */
export function planEqFor(cost: number, windowDays = 7): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const weeks = Math.max(7, windowDays) / 7;
  return cost / (PLAN_EQ_USD_PER_WEEK * weeks);
}

/** Rounded for display and storage: two decimals is finer than the yardstick. */
export function roundPlanEq(planEq: number): number {
  return Math.round(planEq * 100) / 100;
}

/**
 * verified:   signed in on the site with GitHub (OAuth upload).
 * claimed:    signed CLI submission (a GitHub-linked token), or a CLI row a
 *             GitHub user claimed.
 * unverified: anonymous CLI submission; anyone could have typed the handle.
 */
export function trustMarkFor(row: { verified: boolean; source?: string | null }): TrustMark {
  if (!row.verified) return "unverified";
  return row.source === "oauth" ? "verified" : "claimed";
}

export function isGithubBacked(trust: TrustMark): boolean {
  return trust !== "unverified";
}

export interface ClassifyInput {
  trust: TrustMark;
  /** Automatic review marks (#183); any mark holds the entry. */
  reviewReasons?: string[] | null;
  planEq: number;
}

export interface Classification {
  cls: BoardClass;
  underReview: boolean;
  heldReason?: string;
}

/** Shorter form of a review mark for a one-line held reason. */
export function reviewReasonLabel(reasons: string[]): string {
  const first = reasons[0]?.trim() ?? "";
  if (!first) return HELD_UNDER_REVIEW;
  const short = first.length > 90 ? `${first.slice(0, 87)}…` : first;
  return `${HELD_UNDER_REVIEW}: ${short}`;
}

export function classify(input: ClassifyInput): Classification {
  const reasons = (input.reviewReasons ?? []).filter((reason) => reason.trim().length > 0);
  const underReview = reasons.length > 0;

  if (input.planEq > FLEET_PLAN_EQ) {
    return { cls: "fleets", underReview, heldReason: HELD_ABOVE_CEILING };
  }
  if (underReview) {
    return { cls: "open", underReview, heldReason: reviewReasonLabel(reasons) };
  }
  if (!isGithubBacked(input.trust)) {
    return { cls: "open", underReview, heldReason: HELD_NOT_VERIFIED };
  }
  return { cls: "ranked", underReview };
}

/** Positive = moved up. null when the entry was not in this class last week. */
export function movementFor(previousRank: number | undefined | null, rank: number): number | null {
  if (previousRank === undefined || previousRank === null) return null;
  return previousRank - rank;
}

/**
 * Consecutive closed weeks with usage ending the week before `weekStart`,
 * plus `weekStart` itself when it has usage. `activeWeekStarts` holds Monday
 * dates (YYYY-MM-DD) of weeks with usage.
 */
export function streakWeeks(activeWeekStarts: Iterable<string>, weekStart: string): number {
  const active = new Set(activeWeekStarts);
  let streak = active.has(weekStart) ? 1 : 0;
  let cursor = Date.parse(`${weekStart}T00:00:00Z`);
  for (;;) {
    cursor -= 7 * 86_400_000;
    if (!active.has(new Date(cursor).toISOString().slice(0, 10))) break;
    streak++;
  }
  return streak;
}
