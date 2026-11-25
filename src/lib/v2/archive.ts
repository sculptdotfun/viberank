// The weekly archive (/weeks, /week/{id}): which weeks have a permanent page,
// and the small summaries shown on them. Pure: the clock is an argument.
import type { BoardRow } from "./contract";
import { isClosed, isFrozen, isWeekId, previousWeekId, shiftWeek, weekIdOf } from "./week";

/** The first week the archive offers: weekly data before it is too thin to rank. */
export const ARCHIVE_FIRST_WEEK = "2025-W36"; // first week with tracked data (Sep 2025)

/** Weeks listed on /weeks, and closed weeks in the sitemap. */
export const ARCHIVE_INDEX_WEEKS = 52;
export const ARCHIVE_SITEMAP_WEEKS = 12;

export type ArchiveWeekState = "invalid" | "future" | "current" | "settling" | "final";

/**
 * What a /week/{id} request names. "current" redirects to the live board;
 * "settling" is closed but inside the grace hours (late days still count);
 * "final" is frozen for good.
 */
export function archiveWeekState(id: string, now: Date): ArchiveWeekState {
  if (!isWeekId(id) || id < ARCHIVE_FIRST_WEEK) return "invalid";
  const current = weekIdOf(now);
  if (id === current) return "current";
  if (!isClosed(id, now)) return "future";
  return isFrozen(id, now) ? "final" : "settling";
}

/** The last `count` closed weeks, newest first, never before ARCHIVE_FIRST_WEEK. */
export function closedWeekIds(now: Date, count: number): string[] {
  const ids: string[] = [];
  let id = previousWeekId(weekIdOf(now));
  while (ids.length < count && id >= ARCHIVE_FIRST_WEEK) {
    ids.push(id);
    id = previousWeekId(id);
  }
  return ids;
}

/** Previous and next archive weeks; next is null for the latest closed week. */
export function neighbourWeeks(id: string, now: Date): { prev: string | null; next: string | null } {
  const prev = previousWeekId(id);
  const next = shiftWeek(id, 1);
  return {
    prev: prev >= ARCHIVE_FIRST_WEEK ? prev : null,
    next: isClosed(next, now) ? next : next === weekIdOf(now) ? "current" : null,
  };
}

/** Biggest climbers of the week: rows that moved up, most places first, ties by rank. */
export function topMovers(rows: BoardRow[], count = 3): BoardRow[] {
  return rows
    .filter((r) => r.movement !== null && r.movement > 0)
    .sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0) || a.rank - b.rank)
    .slice(0, count);
}

/** Rows that are new on the board this week (no rank last week), best first. */
export function newEntries(rows: BoardRow[], count = 3): BoardRow[] {
  return rows.filter((r) => r.movement === null).slice(0, count);
}
