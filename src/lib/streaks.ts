/**
 * Daily-usage streaks from a set of YYYY-MM-DD active dates.
 *
 * "Current" tolerates a one-day lag: usage data is submitted after the fact,
 * so a streak whose last active day is yesterday (UTC) still counts as alive.
 */

export interface Streaks {
  current: number;
  longest: number;
}

/** Days since epoch for a YYYY-MM-DD string (UTC, no DST wobble). */
function epochDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function computeStreaks(dates: Iterable<string>, today?: string): Streaks {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const days = Array.from(new Set(dates), epochDay)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current streak: the run ending on the most recent active day, but only if
  // that day is today or yesterday.
  let current = 0;
  const last = days[days.length - 1];
  if (epochDay(todayStr) - last <= 1) {
    current = 1;
    for (let i = days.length - 1; i > 0 && days[i - 1] === days[i] - 1; i--) current++;
  }

  return { current, longest };
}
