/**
 * Shared types for data layer abstraction
 * These types work with both Convex and Supabase backends
 */

// ============================================================================
// CORE DATA TYPES
// ============================================================================

export interface DailyBreakdown {
  date: string; // YYYY-MM-DD format
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
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
  createdAt: number; // Unix timestamp in ms
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
}

export interface DateRangeLeaderboardParams {
  dateFrom: string;
  dateTo: string;
  sortBy?: "cost" | "tokens";
  limit?: number;
  cursor?: string;
  includeFlagged?: boolean;
}

export interface SubmitData {
  username: string;
  githubUsername?: string;
  githubName?: string;
  githubAvatar?: string;
  source: "cli" | "oauth";
  verified: boolean;
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
      modelBreakdowns?: Array<{
        modelName: string;
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        cost: number;
      }>;
    }>;
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
}

export interface ProfilesService {
  getProfile(
    username: string,
    submissionLimit?: number
  ): Promise<ProfileWithSubmissions | null>;
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
}

export interface DataLayer {
  submissions: SubmissionsService;
  profiles: ProfilesService;
  stats: StatsService;
}

// ============================================================================
// DATABASE BACKEND TYPE
// ============================================================================

export type DatabaseBackend = "convex" | "supabase";
