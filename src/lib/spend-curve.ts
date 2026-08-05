/**
 * The distribution of monthly API-equivalent burn across everyone on the board.
 *
 * Kept as pure functions over plain rows so it can be unit-tested without a
 * database, and so the page that uses it can fetch rows however it likes.
 */

export interface BurnRow {
  username: string;
  totalCost: number;
  /** Inclusive ISO dates, as stored on a submission. */
  start: string;
  end: string;
}

export interface SpendCurve {
  cohortSize: number;
  /** Ascending monthly burns — the cohort a user is placed against. */
  sorted: number[];
  percentiles: { p: number; burn: number }[];
}

/**
 * Submissions shorter than this extrapolate to a meaningless monthly figure —
 * a two-day sample says nothing about a month.
 */
const MIN_SPAN_DAYS = 7;

const QUANTILES = [10, 25, 50, 75, 90, 95, 99];

function spanDays(start: string, end: string): number {
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.floor((to - from) / 86_400_000) + 1;
}

/**
 * Collapse to one row per user (their highest-cost submission), normalise each
 * to a 30-day burn, and sort.
 *
 * One row per user matters: without it a prolific resubmitter is counted many
 * times and drags the curve toward their own usage.
 */
export function buildSpendCurve(rows: BurnRow[]): SpendCurve {
  const best = new Map<string, BurnRow>();
  for (const row of rows) {
    const key = row.username.toLowerCase();
    const current = best.get(key);
    if (!current || row.totalCost > current.totalCost) best.set(key, row);
  }

  const sorted: number[] = [];
  for (const row of best.values()) {
    const days = spanDays(row.start, row.end);
    if (days < MIN_SPAN_DAYS || !(row.totalCost > 0)) continue;
    sorted.push((row.totalCost / days) * 30);
  }
  sorted.sort((a, b) => a - b);

  return {
    cohortSize: sorted.length,
    sorted,
    percentiles: QUANTILES.map((p) => ({ p, burn: quantile(sorted, p / 100) })),
  };
}

/** Linear-interpolated quantile. Returns 0 for an empty cohort. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
