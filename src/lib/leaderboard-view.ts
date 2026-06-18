export type LeaderboardSort = "cost" | "tokens";

export interface ServerSeededLeaderboardInput {
  hasInitialItems: boolean;
  hasUserInteracted: boolean;
  page: number;
  sortBy: LeaderboardSort;
  hasToolFilter: boolean;
  verifiedOnly: boolean;
  isDateFiltered: boolean;
}

export interface LeaderboardRequestParams {
  sortBy?: LeaderboardSort;
  page?: number;
  pageSize?: number;
  tool?: string;
  verifiedOnly?: boolean;
}

export interface KeyedLeaderboardResult {
  requestKey?: string;
  page: number;
}

export function shouldUseServerSeededLeaderboard({
  hasInitialItems,
  hasUserInteracted,
  page,
  sortBy,
  hasToolFilter,
  verifiedOnly,
  isDateFiltered,
}: ServerSeededLeaderboardInput): boolean {
  return (
    hasInitialItems &&
    !hasUserInteracted &&
    page === 0 &&
    sortBy === "cost" &&
    !hasToolFilter &&
    !verifiedOnly &&
    !isDateFiltered
  );
}

export function getLeaderboardRequestKey(params: LeaderboardRequestParams): string {
  return JSON.stringify({
    sortBy: params.sortBy ?? "cost",
    page: params.page ?? 0,
    pageSize: params.pageSize ?? 25,
    tool: params.tool ?? null,
    verifiedOnly: Boolean(params.verifiedOnly),
  });
}

export function isLeaderboardResultForRequest(
  result: KeyedLeaderboardResult | undefined,
  params: LeaderboardRequestParams
): boolean {
  return !!result?.requestKey && result.requestKey === getLeaderboardRequestKey(params);
}
