import type { LeaderboardParams, DateRangeLeaderboardParams } from "./data/types";

/**
 * The query the home leaderboard runs for a given filter state.
 *
 * The board copies each response into its own list, empties that list when
 * the filters change, and waits for a hook to refill it. That only works if
 * "the filters changed" means the same thing to the reset as to the hooks.
 * The reset used to fire on the raw inputs, so picking one end of a custom
 * range, clearing one end, or pressing All with only one end set emptied the
 * board, while the hooks (correctly) saw no complete range, no new query and
 * nothing to fetch. The board then sat on "No submissions yet" until the sort
 * or another filter changed.
 *
 * Both sides now read this one function: the hook params come from it, and the
 * reset is keyed on `boardQueryKey`, so the board is only cleared when a new
 * fetch is actually on its way.
 */

export type SortBy = "cost" | "tokens" | "efficiency";

export interface BoardFilters {
  sortBy: SortBy;
  tool: string | null;
  verifiedOnly: boolean;
  dateFrom: string;
  dateTo: string;
}

export const ITEMS_PER_PAGE = 25;
export const DATE_RANGE_LIMIT = 100;

export type BoardQuery =
  | { kind: "all-time"; params: LeaderboardParams }
  | { kind: "date-range"; params: DateRangeLeaderboardParams };

/** A range needs both ends. One date on its own filters nothing. */
export function hasDateRange(filters: Pick<BoardFilters, "dateFrom" | "dateTo">): boolean {
  return Boolean(filters.dateFrom && filters.dateTo);
}

export function leaderboardQuery(filters: BoardFilters, page: number): BoardQuery {
  const tool = filters.tool ?? undefined;
  const verifiedOnly = filters.verifiedOnly || undefined;

  if (hasDateRange(filters)) {
    return {
      kind: "date-range",
      params: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        // The date-range board aggregates daily rows and has no stored ratio
        // to order by, so efficiency falls back to cost there.
        sortBy: filters.sortBy === "efficiency" ? "cost" : filters.sortBy,
        limit: DATE_RANGE_LIMIT,
        tool,
        verifiedOnly,
      },
    };
  }

  return {
    kind: "all-time",
    params: { sortBy: filters.sortBy, page, pageSize: ITEMS_PER_PAGE, tool, verifiedOnly },
  };
}

/** Identity of the board's query with the page left out: what a reset keys on. */
export function boardQueryKey(filters: BoardFilters): string {
  return JSON.stringify(leaderboardQuery(filters, 0));
}
