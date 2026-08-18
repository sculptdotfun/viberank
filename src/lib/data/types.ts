/**
 * Shared types for data layer abstraction
 * These types describe the Supabase-backed data layer
 */

// ============================================================================
// CORE DATA TYPES
// ============================================================================

export interface ModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

export interface DailyBreakdown {
  date: string; // YYYY-MM-DD format
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  agents?: string[]; // tools that contributed to this day
  /** Per-model token/cost split for this day. Null/absent on rows ingested before migration 004. */
  modelBreakdowns?: ModelBreakdown[];
}

export interface Submission {
  id: string;
  username: string;
  githubUsername?: string;
  githubName?: string;
  githubAvatar?: string;
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  dateRange: {
    start: string;
    end: string;
  };
  modelsUsed: string[];
  tools?: string[]; // tools/agents used across the submission (e.g. ["claude", "codex"])
  dailyBreakdown: DailyBreakdown[];
  submittedAt: number; // Unix timestamp in ms
  verified: boolean;
  source?: "cli" | "oauth";
  claimedBy?: string;
  flaggedForReview?: boolean;
  flagReasons?: string[];
}

export interface Profile {
  id: string;
  username: string;
  githubUsername?: string;
  githubName?: string;
  bio?: string;
  avatar?: string;
  totalSubmissions: number;
  bestSubmission?: string;
  /** Explicit opt-in flag shown on the profile and the /hire page. */
  openToWork?: boolean;
  /** Optional contact email shown only when the profile is open to work. */
  openToWorkEmail?: string;
  createdAt: number; // Unix timestamp in ms
}

/** Row on the /hire page: an opted-in profile with its board stats. */
export interface HireListing {
  username: string;
  githubUsername: string;
  githubName?: string;
  avatar?: string;
  bestCost: number;
  totalTokens: number;
  tools: string[];
  rank: number | null;
  verified: boolean;
  workEmail?: string;
}

export interface ProfileWithSubmissions extends Profile {
  submissions: Submission[];
}

// ============================================================================
// QUERY/MUTATION PARAMETERS
// ============================================================================

export interface LeaderboardParams {
  sortBy?: "cost" | "tokens" | "efficiency";
  page?: number;
  pageSize?: number;
  includeFlagged?: boolean;
  /** Filter to submissions that used this tool/agent (e.g. "codex"). */
  tool?: string;
  /** Only show GitHub-OAuth-verified submissions (CLI rows are unverified). */
  verifiedOnly?: boolean;
}

export interface DateRangeLeaderboardParams {
  dateFrom: string;
  dateTo: string;
  sortBy?: "cost" | "tokens";
  limit?: number;
  cursor?: string;
  includeFlagged?: boolean;
  /** Filter to submissions that used this tool/agent (e.g. "codex"). */
  tool?: string;
  /** Only show GitHub-OAuth-verified submissions (CLI rows are unverified). */
  verifiedOnly?: boolean;
}

export interface SubmitData {
  username: string;
  githubUsername?: string;
  githubName?: string;
  githubAvatar?: string;
  source: "cli" | "oauth";
  verified: boolean;
  // Stable per-machine id (CLI `X-Machine-Id` header). Absent for web uploads /
  // older CLIs; the data layer falls back to a shared "default" bucket. Used to
  // sum overlapping dates across machines without double-counting re-submits (#43).
  machineId?: string;
  /**
   * Per-month corpus size from the client (#112), used to tell a deliberate
   * deletion from a transcript the runtime rewrote. Absent for older CLIs.
   */
  corpus?: Record<string, { files: number; bytes: number }>;
  ccData: {
    totals: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
      totalCost: number;
      totalTokens: number;
    };
    daily: Array<{
      date: string;
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
      totalTokens: number;
      totalCost: number;
      modelsUsed: string[];
      // Tools/agents that contributed to this day (e.g. ["claude", "codex"]).
      // Populated by normalizeCcData from ccusage's metadata.agents.
      agents?: string[];
      modelBreakdowns?: Array<{
        modelName: string;
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        cost: number;
      }>;
    }>;
    // Union of all tools/agents across the submission.
    tools?: string[];
  };
}

export interface PatternSearchOptions {
  searchField?: "githubUsername" | "username" | "both";
  caseSensitive?: boolean;
}

// ============================================================================
// QUERY/MUTATION RESULTS
// ============================================================================

export interface LeaderboardResult {
  items: Submission[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalPages?: number;
}

export interface DateRangeLeaderboardResult {
  items: Submission[];
  nextCursor?: string;
  hasMore: boolean;
  needsMoreData?: boolean;
}

export interface GlobalStats {
  totalUsers: number;
  totalSubmissions: number;
  totalCost: number;
  totalTokens: number;
  avgCostPerUser: number;
  topCost: number;
  topUser: string;
  modelUsage: Record<string, number>;
  totalDays: number;
  avgTokensPerUser: number;
  isApproximate: boolean;
  basedOnTop?: number;
}

/**
 * Exact site-wide aggregates from the get_site_stats() SQL function
 * (migration 007) — unlike GlobalStats, these are not approximated from the
 * top-N submissions.
 */
export interface SiteStats {
  totalUsers: number;
  totalSubmissions: number;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  firstDate: string | null;
  lastDate: string | null;
  activeDays: number;
  /** 12-month site-wide rollup (migration 008); absent before it's applied. */
  monthly?: { month: string; cost: number; users: number }[];
  /** Developers per spend tier, bucketed on best submission (migration 008). */
  tiers?: { tier: string; users: number }[];
  tools: { tool: string; users: number }[];
  models: { model: string; users: number }[];
  modelSpend: { model: string; cost: number }[];
}

/**
 * One month's exact aggregates from get_month_stats() (migration 013), for
 * the /stats/monthly report pages. Note: perTool costs attribute a day's
 * whole spend to every agent active that day, so they can sum past `cost`.
 */
export interface MonthStats {
  month: string;
  cost: number;
  tokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  users: number;
  activeDays: number;
  medianUserCost: number;
  p90UserCost: number;
  topSpenders: { username: string; cost: number; tokens: number; activeDays: number }[];
  perTool: { tool: string; cost: number; users: number }[];
  perModel: { model: string; cost: number }[];
}

/** One user's month from get_user_month_stats() (migration 015) — Wrapped data. */
export interface UserMonthStats {
  month: string;
  username: string;
  cost: number;
  tokens: number;
  activeDays: number;
  bestDayCost: number;
  longestStreak: number;
  /** 1-based rank among that month's active users, by cost. */
  rank: number;
  totalActives: number;
  topModels: { model: string; cost: number }[];
  tools: string[];
}

export interface League {
  id: string;
  slug: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

/** One row on a league board: a member plus their best submission's totals. */
export interface LeagueBoardRow {
  username: string;
  joinedAt: string;
  totalCost: number;
  totalTokens: number;
  verified: boolean;
}

export interface ClaimStatus {
  actionNeeded: "claim" | "merge" | null;
  actionText: string;
  cliCount: number;
  oauthCount: number;
  totalSubmissions: number;
  unverifiedCount: number;
}

export interface ClaimResult {
  success: boolean;
  action: "already_verified" | "claimed" | "merged";
  submissionId: string;
  mergedCount: number;
}

export interface DeleteResult {
  message: string;
  matchedCount: number;
  deletedCount: number;
  dryRun: boolean;
  patterns: string[];
  searchField: string;
  profiles: Array<{
    id: string;
    githubUsername?: string;
    username?: string;
    createdAt: number;
  }>;
  /**
   * Rows removed per table. A profile is only the account record — the
   * leaderboard itself reads `submissions`, and `raw_submissions` holds the
   * archived payload with no FK to either. Reporting the breakdown makes a
   * partial delete visible instead of silently leaving the entry on the board.
   */
  deletedRows: {
    profiles: number;
    submissions: number;
    dailyBreakdowns: number;
    rawSubmissions: number;
  };
}

export interface FindProfilesResult {
  count: number;
  patterns: string[];
  searchField: string;
  profiles: Array<{
    id: string;
    githubUsername?: string;
    username?: string;
    createdAt: number;
    avatar?: string;
    totalSubmissions: number;
  }>;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface SubmissionsService {
  /**
   * Delete one of the caller's own submissions (#127): the row must belong to
   * `username` directly or be claimed by them. Returns false when no such row.
   */
  deleteOwn(username: string, submissionId: string): Promise<boolean>;
  submit(data: SubmitData): Promise<string>;
  getLeaderboard(params: LeaderboardParams): Promise<LeaderboardResult>;
  getLeaderboardByDateRange(
    params: DateRangeLeaderboardParams
  ): Promise<DateRangeLeaderboardResult>;
  getSubmission(id: string): Promise<Submission | null>;
  getFlaggedSubmissions(limit?: number): Promise<Submission[]>;
  updateFlagStatus(
    id: string,
    flagged: boolean,
    reason?: string
  ): Promise<{ success: boolean }>;
  claimAndMergeSubmissions(githubUsername: string): Promise<ClaimResult>;
  checkClaimableSubmissions(githubUsername: string): Promise<ClaimStatus>;
  /** 1-based leaderboard position for a given total cost (by-cost ranking). */
  getGlobalRank(totalCost: number): Promise<number>;
}

export interface ProfilesService {
  getProfile(
    username: string,
    submissionLimit?: number
  ): Promise<ProfileWithSubmissions | null>;
  /** Set the open-to-work flag for a GitHub-verified profile. */
  setOpenToWork(
    githubUsername: string,
    open: boolean,
    workEmail?: string | null
  ): Promise<{ success: boolean; error?: string }>;
  /** All opted-in profiles with board stats, sorted by best cost. */
  getHireListings(): Promise<HireListing[]>;
  deleteByPattern(
    patterns: string[],
    options: PatternSearchOptions & { dryRun?: boolean }
  ): Promise<DeleteResult>;
  findByPattern(
    patterns: string[],
    options: PatternSearchOptions
  ): Promise<FindProfilesResult>;
}

export interface StatsService {
  getGlobalStats(): Promise<GlobalStats>;
  /** Exact aggregates via get_site_stats() (migration 007); null if the function isn't deployed. */
  getSiteStats(): Promise<SiteStats | null>;
  /** One month's aggregates via get_month_stats() (migration 013); null if unavailable. */
  getMonthStats(month: string): Promise<MonthStats | null>;
  /** One user's month via get_user_month_stats() (migration 015); null if unavailable or empty. */
  getUserMonthStats(month: string, username: string): Promise<UserMonthStats | null>;
  /** Raw rows for the /calculator spend curve. */
  getSpendRows(): Promise<import("@/lib/spend-curve").BurnRow[]>;
}

export interface LeaguesService {
  /** Create a league owned by `creator` (also its first member). Throws on cap/name problems. */
  create(name: string, creator: string): Promise<{ league: League; inviteCode: string }>;
  /** Join via invite code; idempotent for existing members. Throws on unknown code or full league. */
  joinByCode(code: string, username: string): Promise<League>;
  /** League + member board rows (best submission per member), or null. */
  getBySlug(slug: string): Promise<{ league: League; members: LeagueBoardRow[] } | null>;
  /** The invite code — only revealed to current members. */
  getInviteCode(slug: string, requester: string): Promise<string | null>;
  /** Leagues `username` belongs to. */
  listForUser(username: string): Promise<League[]>;
}

export interface DataLayer {
  tokens: TokensService;
  submissions: SubmissionsService;
  profiles: ProfilesService;
  stats: StatsService;
  leagues: LeaguesService;
}

// ============================================================================
// DATABASE BACKEND TYPE
// ============================================================================

export type DatabaseBackend = "supabase" | "demo";

// ============================================================================
// API TOKENS
// ============================================================================

export interface ApiTokenSummary {
  id: string;
  label: string;
  /** Display fragment only — never a working credential. */
  hint: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface TokenOwner {
  username: string;
  githubUsername: string;
}

export interface TokensService {
  /** Mints a token and returns the plaintext exactly once. */
  issue(username: string, githubUsername: string, label: string): Promise<{ plaintext: string; token: ApiTokenSummary }>;
  list(username: string): Promise<ApiTokenSummary[]>;
  revoke(username: string, id: string): Promise<boolean>;
  /**
   * Resolves a plaintext token to its owner, or null. Returns null rather
   * than throwing when the table is absent, so a deploy that precedes the
   * migration degrades to "no token auth" instead of breaking submissions.
   */
  resolve(plaintext: string): Promise<TokenOwner | null>;
}
