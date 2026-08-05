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
}

export interface ProfileWithSubmissions extends Profile {
  submissions: Submission[];
}

// ============================================================================
// QUERY/MUTATION PARAMETERS
// ============================================================================

export interface LeaderboardParams {
  sortBy?: "cost" | "tokens";
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
    open: boolean
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
}

export interface DataLayer {
  submissions: SubmissionsService;
  profiles: ProfilesService;
  stats: StatsService;
}

// ============================================================================
// DATABASE BACKEND TYPE
// ============================================================================

export type DatabaseBackend = "supabase";
