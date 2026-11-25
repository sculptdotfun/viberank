import type { WeekRef } from "@/lib/v2/contract";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The current ISO week in UTC, Monday 00:00 to the next Monday 00:00. Used
 * where no board is loaded (the nav's "Join week NN") and for empty boards;
 * pages with a board use the week the service returned.
 */
export function currentWeek(now: Date = new Date()): WeekRef {
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const sunday = new Date(monday.getTime() + 6 * 864e5);
  const closes = new Date(monday.getTime() + 7 * 864e5);
  // ISO week number: the week holding this week's Thursday.
  const thursday = new Date(monday.getTime() + 3 * 864e5);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / (7 * 864e5)) + 1;
  return {
    id: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`,
    start: isoDate(monday),
    end: isoDate(sunday),
    day,
    closesAt: closes.toISOString(),
    closed: false,
  };
}
