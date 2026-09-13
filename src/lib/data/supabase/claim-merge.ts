interface UsageObservation {
  total_cost: number | string;
  total_tokens: number;
}

type SubmissionSource = "cli" | "oauth";

function finiteMetric(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/**
 * Claim merges must never replace a stronger observed day with a weaker one.
 * Keep each row internally coherent rather than taking independent field maxima.
 */
export function shouldReplaceClaimDay(
  current: UsageObservation,
  candidate: UsageObservation
): boolean {
  const currentCost = finiteMetric(current.total_cost);
  const candidateCost = finiteMetric(candidate.total_cost);
  if (candidateCost !== currentCost) return candidateCost > currentCost;

  return finiteMetric(candidate.total_tokens) > finiteMetric(current.total_tokens);
}

/**
 * A verified GitHub session or API token proves ownership of the username, so
 * it may update the owner's existing row regardless of how that row was first
 * submitted. Unverified CLI claims must remain source-scoped.
 */
export function existingSubmissionSourceFilter(
  verified: boolean,
  source: SubmissionSource
): SubmissionSource | undefined {
  return verified ? undefined : source;
}
