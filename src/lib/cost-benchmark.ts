/**
 * The publishable cost benchmark — one source of truth for every surface that
 * quotes viberank's numbers.
 *
 * Why this exists: search for "how much does Claude Code cost per month" and
 * every result on page one republishes Anthropic's own $150–250/developer
 * figure. None of them have measured anything. Viberank has, and the number is
 * materially different — but only if it's stated the same way everywhere it
 * appears. The blog post, /api/stats, /data and llms.txt all render from here
 * so they can never drift apart or go stale against each other.
 *
 * Methodology is deliberately conservative and stated in `CAVEATS` below,
 * because the whole value of the number is that it survives being checked.
 */

import { buildSpendCurve, quantile, type BurnRow } from "@/lib/spend-curve";

/** The figure every competing page quotes, for the comparison that matters. */
export const ANTHROPIC_PUBLISHED_RANGE = { low: 150, high: 250 } as const;

/**
 * Thresholds we report a "share above" figure for. $150/$250 bracket
 * Anthropic's published range; $400 and $1,000 mark where a Max 20x
 * subscription stops being the obvious call.
 */
const THRESHOLDS = [150, 250, 400, 1000] as const;

const REPORTED_QUANTILES = [10, 25, 50, 75, 90, 99] as const;

export interface CostBenchmark {
  /** Developers in the cohort after filtering. */
  cohortSize: number;
  /** Monthly API-equivalent burn at each reported percentile, USD. */
  percentiles: { p: number; monthlyUsd: number }[];
  /** Share of the cohort burning more than each threshold, 0–1. */
  sharesAbove: { thresholdUsd: number; share: number }[];
  /** Mean monthly burn, USD. Reported alongside the median because the
   *  distribution is heavily right-skewed and the two tell different stories. */
  meanMonthlyUsd: number;
  medianMonthlyUsd: number;
  /** Share of total cohort spend held by the top decile, 0–1. */
  topDecileShareOfSpend: number;
}

export const CAVEATS = [
  "Figures are API-equivalent cost computed by ccusage from local session logs, not amounts actually billed. Most developers on the board pay a flat subscription, so this measures what their usage would cost at API list prices.",
  "The population self-selects: these are developers who chose to measure their own usage and publish it, which skews heavier than the average Claude Code user.",
  "One row per developer (their highest-cost submission), normalised to a 30-day month. Submissions covering fewer than 7 days are excluded because they extrapolate to meaningless monthly figures.",
] as const;

export function buildCostBenchmark(rows: BurnRow[]): CostBenchmark {
  const curve = buildSpendCurve(rows);
  const sorted = curve.sorted;
  const n = sorted.length;

  if (n === 0) {
    return {
      cohortSize: 0,
      percentiles: REPORTED_QUANTILES.map((p) => ({ p, monthlyUsd: 0 })),
      sharesAbove: THRESHOLDS.map((thresholdUsd) => ({ thresholdUsd, share: 0 })),
      meanMonthlyUsd: 0,
      medianMonthlyUsd: 0,
      topDecileShareOfSpend: 0,
    };
  }

  const total = sorted.reduce((sum, burn) => sum + burn, 0);
  const topDecileStart = Math.floor(n * 0.9);
  const topDecileTotal = sorted.slice(topDecileStart).reduce((sum, burn) => sum + burn, 0);

  return {
    cohortSize: n,
    percentiles: REPORTED_QUANTILES.map((p) => ({ p, monthlyUsd: quantile(sorted, p / 100) })),
    sharesAbove: THRESHOLDS.map((thresholdUsd) => ({
      thresholdUsd,
      share: sorted.filter((burn) => burn > thresholdUsd).length / n,
    })),
    meanMonthlyUsd: total / n,
    medianMonthlyUsd: quantile(sorted, 0.5),
    topDecileShareOfSpend: total > 0 ? topDecileTotal / total : 0,
  };
}

/** `$1,218` — the house format for every dollar figure we publish. */
export function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/**
 * `84%` — whole percents, because false precision reads as fake.
 *
 * Below 1% it keeps one decimal: a real but small share rendering as "0%" is
 * worse than slightly more precision, especially in a meta description.
 */
export function pct(share: number): string {
  const value = share * 100;
  if (value > 0 && value < 1) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

export function shareAbove(benchmark: CostBenchmark, thresholdUsd: number): number {
  return benchmark.sharesAbove.find((s) => s.thresholdUsd === thresholdUsd)?.share ?? 0;
}

export function percentile(benchmark: CostBenchmark, p: number): number {
  return benchmark.percentiles.find((entry) => entry.p === p)?.monthlyUsd ?? 0;
}

/**
 * The one-sentence version, for meta descriptions, llms.txt and anywhere an
 * answer engine might lift a single line.
 */
export function headlineClaim(benchmark: CostBenchmark): string {
  return (
    `Anthropic reports $${ANTHROPIC_PUBLISHED_RANGE.low}–$${ANTHROPIC_PUBLISHED_RANGE.high} per developer per month. ` +
    `Across ${benchmark.cohortSize.toLocaleString("en-US")} developers who measure their own usage, ` +
    `the median is ${usd(benchmark.medianMonthlyUsd)}/month and ` +
    `${pct(shareAbove(benchmark, ANTHROPIC_PUBLISHED_RANGE.high))} exceed $${ANTHROPIC_PUBLISHED_RANGE.high}.`
  );
}
