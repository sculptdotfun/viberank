import type { DailyBreakdown } from "@/lib/data/types";
import { prettyModelName } from "@/lib/utils";

export const OTHER_KEY = "Other";

/** Series shown per view; the rest of the range's spend folds into Other. */
export const TOP_SERIES = 5;

// Unattributed or folded spend below half a cent is float noise, not a bar.
const OTHER_EPSILON = 0.005;

/** One day as the server ships it: uncollapsed per-model costs. */
export interface ProfileChartDay {
  date: string;
  total: number;
  /** Cost per pretty model name; never contains OTHER_KEY. */
  byModel: Record<string, number>;
}

/** One day as the chart stacks it, after ranking for the visible range. */
export interface StackedDay {
  date: string;
  total: number;
  /** Cost per top-ranked model; everything else sits under OTHER_KEY. */
  byModel: Record<string, number>;
}

export interface RangeChartData {
  /** Top models by cost within the range, highest first (≤ TOP_SERIES). */
  modelKeys: string[];
  stacked: StackedDay[];
}

// Cents-level precision is all the chart shows; trimming the long float
// tails keeps the per-model payload for long histories small.
const roundCost = (cost: number): number => Math.round(cost * 10_000) / 10_000;

function dayModelCosts(day: DailyBreakdown): Record<string, number> {
  const byModel: Record<string, number> = {};
  for (const breakdown of day.modelBreakdowns ?? []) {
    if (
      typeof breakdown.modelName !== "string" ||
      breakdown.modelName.length === 0 ||
      !Number.isFinite(breakdown.cost) ||
      breakdown.cost <= 0
    ) {
      continue;
    }
    const name = prettyModelName(breakdown.modelName);
    byModel[name] = (byModel[name] ?? 0) + breakdown.cost;
  }

  // Splits can over-attribute a day (rounding in the reporting tool); scale
  // them down so the stack never rises above the recorded daily cost.
  const attributed = Object.values(byModel).reduce((sum, cost) => sum + cost, 0);
  const scale = attributed > day.totalCost && attributed > 0 ? day.totalCost / attributed : 1;
  for (const name of Object.keys(byModel)) byModel[name] = roundCost(byModel[name] * scale);
  return byModel;
}

/** Per-model daily costs for the profile chart, uncollapsed so the client can rank per range. */
export function buildProfileChartDays(daily: DailyBreakdown[]): ProfileChartDay[] {
  return daily.map((day) => ({
    date: day.date,
    total: day.totalCost,
    byModel: dayModelCosts(day),
  }));
}

/**
 * Ranks models by cost within the given (already range-sliced) days, keeps
 * the top `topN` as series and folds the rest plus unattributed cost into Other.
 */
export function selectRangeSeries(days: ProfileChartDay[], topN: number = TOP_SERIES): RangeChartData {
  const totals = new Map<string, number>();
  for (const day of days) {
    for (const [name, cost] of Object.entries(day.byModel)) {
      totals.set(name, (totals.get(name) ?? 0) + cost);
    }
  }

  const modelKeys = Array.from(totals.entries())
    .filter(([, cost]) => cost > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([name]) => name);
  const shown = new Set(modelKeys);

  const stacked = days.map((day) => {
    const byModel: Record<string, number> = {};
    let shownCost = 0;
    for (const [name, cost] of Object.entries(day.byModel)) {
      if (!shown.has(name)) continue;
      byModel[name] = cost;
      shownCost += cost;
    }
    const rest = day.total - shownCost;
    if (rest > OTHER_EPSILON) byModel[OTHER_KEY] = rest;
    return { date: day.date, total: day.total, byModel };
  });

  return { modelKeys, stacked };
}
