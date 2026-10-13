import type { DailyBreakdown } from "./data/types";

export interface WorkInsights {
  activeDays: number;
  cacheHitRate: number | null;
  cacheReuse: number | null;
  costPerMillionTokens: number | null;
  outputShare: number | null;
  parallelToolShare: number | null;
  averageTools: number | null;
  averageMachines: number | null;
  maxMachines: number | null;
  parallelMachineShare: number | null;
  averageModels: number | null;
  costVariation: number | null;
  activeDayShare: number | null;
}

export type ComparableMetric = "cacheHitRate" | "cacheReuse" | "costPerMillionTokens" | "outputShare";
export interface WorkInsightBaselines {
  values: Record<ComparableMetric, number[]>;
  byUser: Record<string, Pick<WorkInsights, ComparableMetric>>;
}

export interface WorkInsightTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
}

export interface DeveloperTotals extends WorkInsightTotals {
  username: string;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 && Number.isFinite(numerator) && Number.isFinite(denominator)
    ? numerator / denominator
    : null;
}

export function comparableInsights(totals: WorkInsightTotals): Pick<WorkInsights, ComparableMetric> {
  const { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens, totalCost } = totals;
  return {
    cacheHitRate: ratio(cacheReadTokens, inputTokens + cacheCreationTokens + cacheReadTokens),
    cacheReuse: ratio(cacheReadTokens, cacheCreationTokens),
    costPerMillionTokens: ratio(totalCost * 1_000_000, totalTokens),
    outputShare: ratio(outputTokens, totalTokens),
  };
}

/** Sum submissions before applying the spend floor, so split rows count as one developer. */
export function buildWorkInsightBaselines(rows: DeveloperTotals[], minCost: number): WorkInsightBaselines {
  const byUser = new Map<string, WorkInsightTotals>();
  for (const row of rows) {
    const username = row.username.toLowerCase();
    const prior = byUser.get(username) ?? {
      inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0,
      cacheReadTokens: 0, totalTokens: 0, totalCost: 0,
    };
    for (const key of ["inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens", "totalTokens", "totalCost"] as const) {
      prior[key] += row[key];
    }
    byUser.set(username, prior);
  }
  const values: WorkInsightBaselines["values"] = {
    cacheHitRate: [], cacheReuse: [], costPerMillionTokens: [], outputShare: [],
  };
  const eligible: WorkInsightBaselines["byUser"] = Object.create(null);
  for (const [username, totals] of byUser) {
    if (totals.totalCost < minCost) continue;
    const metrics = comparableInsights(totals);
    eligible[username] = metrics;
    for (const metric of Object.keys(values) as ComparableMetric[]) {
      const value = metrics[metric];
      if (value !== null) values[metric].push(value);
    }
  }
  for (const metricValues of Object.values(values)) metricValues.sort((a, b) => a - b);
  return { values, byUser: eligible };
}

/** Days are already deduplicated by the profile page, newest submission first. */
export function computeWorkInsights(days: DailyBreakdown[]): WorkInsights {
  const count = days.length;
  const totals = days.reduce<WorkInsightTotals>((sum, day) => ({
    inputTokens: sum.inputTokens + day.inputTokens,
    outputTokens: sum.outputTokens + day.outputTokens,
    cacheCreationTokens: sum.cacheCreationTokens + day.cacheCreationTokens,
    cacheReadTokens: sum.cacheReadTokens + day.cacheReadTokens,
    totalTokens: sum.totalTokens + day.totalTokens,
    totalCost: sum.totalCost + day.totalCost,
  }), { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, totalCost: 0 });
  const tools = days.map((day) => new Set(day.agents ?? []).size);
  const models = days.map((day) => new Set(day.modelsUsed ?? []).size);
  // A partial machine series would make the average and share misleading.
  const machines = days.every((day) => day.machineCount !== undefined)
    ? days.map((day) => day.machineCount!)
    : [];
  const dates = days.map((day) => Date.parse(`${day.date}T00:00:00Z`)).filter(Number.isFinite);
  const span = dates.length === count && count > 0
    ? (Math.max(...dates) - Math.min(...dates)) / 86_400_000 + 1
    : 0;
  const meanCost = ratio(totals.totalCost, count);
  const variance = meanCost !== null
    ? days.reduce((sum, day) => sum + (day.totalCost - meanCost) ** 2, 0) / count
    : 0;

  return {
    activeDays: count,
    ...comparableInsights(totals),
    parallelToolShare: ratio(tools.filter((n) => n >= 2).length, count),
    averageTools: ratio(tools.reduce((sum, n) => sum + n, 0), count),
    averageMachines: ratio(machines.reduce((sum, n) => sum + n, 0), machines.length),
    maxMachines: machines.length ? Math.max(...machines) : null,
    parallelMachineShare: ratio(machines.filter((n) => n >= 2).length, machines.length),
    averageModels: ratio(models.reduce((sum, n) => sum + n, 0), count),
    costVariation: meanCost && meanCost > 0 ? Math.sqrt(variance) / meanCost : null,
    activeDayShare: ratio(count, span),
  };
}

/** Percentage of cohort values strictly worse than value; ties never outrank one another. */
export function percentile(value: number | null, sorted: number[], direction: "higher" | "lower", excludedValue: number | null = null): number | null {
  if (value === null || !Number.isFinite(value) || sorted.length === 0) return null;
  const exclude = excludedValue !== null && sorted.includes(excludedValue);
  const cohortSize = sorted.length - Number(exclude);
  if (cohortSize === 0) return null;
  let left = 0;
  let right = sorted.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (sorted[middle] < value) left = middle + 1;
    else right = middle;
  }
  if (direction === "higher") return Math.round((left - Number(exclude && excludedValue! < value)) / cohortSize * 100);
  right = sorted.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (sorted[middle] <= value) left = middle + 1;
    else right = middle;
  }
  return Math.round((sorted.length - left - Number(exclude && excludedValue! > value)) / cohortSize * 100);
}
