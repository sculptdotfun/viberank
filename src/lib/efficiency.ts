/**
 * How the efficiency board ranks: tokens per dollar, weighted by volume.
 *
 * The raw ratio rewards having spent little. A developer with 1B tokens for
 * $120 scores 8.3M tokens/$ and topped the board over people with hundreds of
 * billions of tokens at 3–4M/$, because a short history on cheap models or a
 * warm cache is easy to keep efficient and says little about how someone
 * works. The $100 floor only removed the rounding-error cases.
 *
 * So each ratio is shrunk toward the site median by a prior worth $1,000 of
 * spend: score = (tokens + MEDIAN × PRIOR_COST) / (cost + PRIOR_COST). Below
 * about $1K a submission mostly reports the median; by $10K it is ~90% its
 * own ratio, and heavy users are ranked on what they actually did. The board
 * still displays the raw ratio — the weighting decides order, not the number.
 *
 * The same constants are baked into the `efficiency_score` generated column
 * (migration 020); test/efficiency.test.mts keeps the two in step.
 */

/** Median tokens per dollar across the ranked board (measured 2026-09). */
export const EFFICIENCY_PRIOR_RATE = 1_200_000;

/** How much spend the prior is worth, in dollars. */
export const EFFICIENCY_PRIOR_COST = 1_000;

export function efficiencyScore(totalTokens: number, totalCost: number): number | null {
  if (!(totalCost > 0)) return null;
  return (totalTokens + EFFICIENCY_PRIOR_RATE * EFFICIENCY_PRIOR_COST) / (totalCost + EFFICIENCY_PRIOR_COST);
}
