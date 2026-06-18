export interface DailyUsagePoint {
  date: string;
  cost: number;
  tokens: number;
}

export interface CalendarSeriesOptions {
  range: number | "all";
  today: string;
  startDate?: string;
  endDate?: string;
}

export interface RecentSpendSpark {
  values: number[];
  startDate: string | null;
  endDate: string | null;
}

export interface DailyFreshness {
  lastRecordedDate: string | null;
  isStale: boolean;
  missingDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return toIsoDay(new Date(parseIsoDay(date).getTime() + days * DAY_MS));
}

function diffDays(from: string, to: string): number {
  return Math.max(0, Math.round((parseIsoDay(to).getTime() - parseIsoDay(from).getTime()) / DAY_MS));
}

export function todayIso(): string {
  return toIsoDay(new Date());
}

export function formatCompactDate(date: string | null): string {
  if (!date) return "N/A";
  return parseIsoDay(date).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function aggregateDaily(daily: DailyUsagePoint[]): Map<string, DailyUsagePoint> {
  const byDate = new Map<string, DailyUsagePoint>();
  for (const point of daily) {
    const current = byDate.get(point.date) ?? { date: point.date, cost: 0, tokens: 0 };
    current.cost += point.cost;
    current.tokens += point.tokens;
    byDate.set(point.date, current);
  }
  return byDate;
}

export function getDailyFreshness(daily: DailyUsagePoint[], today: string = todayIso()): DailyFreshness {
  if (daily.length === 0) {
    return { lastRecordedDate: null, isStale: false, missingDays: 0 };
  }

  const lastRecordedDate = daily.reduce((latest, point) => point.date > latest ? point.date : latest, daily[0]!.date);
  const missingDays = diffDays(lastRecordedDate, today);
  return {
    lastRecordedDate,
    isStale: missingDays > 0,
    missingDays,
  };
}

export function buildCalendarDailySeries(
  daily: DailyUsagePoint[],
  options: CalendarSeriesOptions
): DailyUsagePoint[] {
  if (daily.length === 0) return [];

  const byDate = aggregateDaily(daily);
  const sortedDates = [...byDate.keys()].sort();
  const firstRecorded = sortedDates[0]!;
  const lastRecorded = sortedDates[sortedDates.length - 1]!;
  const endDate = options.endDate ?? (lastRecorded > options.today ? lastRecorded : options.today);
  const startDate = options.range === "all"
    ? options.startDate ?? firstRecorded
    : addDays(endDate, -(options.range - 1));

  const result: DailyUsagePoint[] = [];
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    result.push(byDate.get(cursor) ?? { date: cursor, cost: 0, tokens: 0 });
  }
  return result;
}

export function buildRecentSpendSpark(
  daily: DailyUsagePoint[],
  options: { days: number; today: string }
): RecentSpendSpark {
  const series = buildCalendarDailySeries(daily, {
    range: options.days,
    today: options.today,
    endDate: options.today,
  });

  return {
    values: series.map((point) => point.cost),
    startDate: series[0]?.date ?? null,
    endDate: series[series.length - 1]?.date ?? null,
  };
}
