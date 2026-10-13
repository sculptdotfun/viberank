/**
 * Automatic "under review" marks (#183).
 *
 * Validation rejects what can't be real. This marks what is merely unusual, so
 * readers can tell a checked entry from an unchecked one. A mark never hides a
 * row or changes its rank: honest heavy users have very large days too, and
 * hiding them would punish exactly the people the board is about. A maintainer
 * clears the mark after looking.
 *
 * Only what a submission brings in can add a reason. A cleared profile isn't
 * re-marked for days a maintainer already saw, only for new evidence.
 */

/** A day is unusual only when it is large in absolute terms… */
export const OUTLIER_DAY_MIN_COST = 25_000;
/** …and far above the profile's own typical day. */
export const OUTLIER_DAY_MEDIAN_MULTIPLE = 20;
/** One submission adding this much at once is worth a look, even if spread out. */
export const LARGE_ADDITION_COST = 100_000;

export interface ReviewInput {
  /** Days this submission carried (date + that day's cost after the merge). */
  incomingDays: { date: string; totalCost: number }[];
  /** Every day's cost on the profile after the merge, used for the median. */
  allDayCosts: number[];
  /** The row's total before this submission (0 for a new row). */
  previousTotal: number;
  /** The row's total after this submission. */
  newTotal: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function reviewReasonsFor(input: ReviewInput): string[] {
  const reasons: string[] = [];
  const typicalDay = median(input.allDayCosts);
  for (const day of input.incomingDays) {
    if (
      day.totalCost > OUTLIER_DAY_MIN_COST &&
      day.totalCost > typicalDay * OUTLIER_DAY_MEDIAN_MULTIPLE
    ) {
      reasons.push(
        `${day.date}: ${usd(day.totalCost)} in one day, over ${OUTLIER_DAY_MEDIAN_MULTIPLE}× this profile's median day (${usd(typicalDay)})`
      );
    }
  }
  const added = input.newTotal - input.previousTotal;
  if (added > LARGE_ADDITION_COST) {
    reasons.push(`One submission added ${usd(added)}`);
  }
  return reasons;
}

/** Union that keeps order and drops repeats, so re-submits don't pile up. */
export function mergeReviewReasons(existing: string[] | null | undefined, next: string[]): string[] {
  return Array.from(new Set([...(existing ?? []), ...next]));
}
