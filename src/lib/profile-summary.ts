// Shared by the data backends' getProfileSummary: one calendar-day series
// for the profile sheet's sparkline.

export const SPARK_DAYS = 30;

/** Cost per UTC calendar day for the `n` days ending today, oldest first; empty days are 0. */
export function sparkSeries(days: { date: string; cost: number }[], n = SPARK_DAYS, now = new Date()): number[] {
  const byDate = new Map<string, number>();
  for (const day of days) byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.cost);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(today - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDate.get(date) ?? 0;
  });
}
