/**
 * Convex Data Layer Implementation
 *
 * This wraps the existing Convex functions to match the DataLayer interface.
 * Used when NEXT_PUBLIC_DATABASE_BACKEND=convex (default)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { clientEnv } from "@/lib/env";
import type {
  DataLayer,
  SubmissionsService,
  ProfilesService,
  StatsService,
  SubmitData,
  LeaderboardParams,
  DateRangeLeaderboardParams,
  LeaderboardResult,
  DateRangeLeaderboardResult,
  Submission,
  ProfileWithSubmissions,
  GlobalStats,
  ClaimStatus,
  ClaimResult,
  DeleteResult,
  FindProfilesResult,
  PatternSearchOptions,
} from "../types";

// ============================================================================
// TYPE CONVERSIONS
// ============================================================================

/**
 * Convert Convex submission document to our Submission type
 */
function convertSubmission(doc: any): Submission {
  return {
    id: doc._id,
    username: doc.username,
    githubUsername: doc.githubUsername,
    githubName: doc.githubName,
    githubAvatar: doc.githubAvatar,
    totalTokens: doc.totalTokens,
    totalCost: doc.totalCost,
    inputTokens: doc.inputTokens,
    outputTokens: doc.outputTokens,
    cacheCreationTokens: doc.cacheCreationTokens,
    cacheReadTokens: doc.cacheReadTokens,
    dateRange: doc.dateRange,
    modelsUsed: doc.modelsUsed,
    dailyBreakdown: doc.dailyBreakdown,
    submittedAt: doc.submittedAt,
    verified: doc.verified,
    source: doc.source,
    claimedBy: doc.claimedBy,
    flaggedForReview: doc.flaggedForReview,
    flagReasons: doc.flagReasons,
  };
}

// ============================================================================
// SERVER-SIDE CLIENT (for API routes)
// ============================================================================

class ConvexSubmissionsService implements SubmissionsService {
  private client: ConvexHttpClient;

  constructor(client: ConvexHttpClient) {
    this.client = client;
  }

  async submit(data: SubmitData): Promise<string> {
    const result = await this.client.mutation(api.submissions.submit, data);
    return result;
  }

  async getLeaderboard(params: LeaderboardParams): Promise<LeaderboardResult> {
    const result = await this.client.query(api.submissions.getLeaderboard, {
      sortBy: params.sortBy,
      page: params.page,
      pageSize: params.pageSize,
      includeFlagged: params.includeFlagged,
    });

    return {
      items: result.items.map(convertSubmission),
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      totalPages: result.totalPages,
    };
  }

  async getLeaderboardByDateRange(
    params: DateRangeLeaderboardParams
  ): Promise<DateRangeLeaderboardResult> {
    const result = await this.client.query(
      api.submissions.getLeaderboardByDateRange,
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sortBy: params.sortBy,
        limit: params.limit,
        cursor: params.cursor as any,
        includeFlagged: params.includeFlagged,
      }
    );

    return {
      items: result.items.map(convertSubmission),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      needsMoreData: result.needsMoreData,
    };
  }

  async getSubmission(id: string): Promise<Submission | null> {
    const result = await this.client.query(api.submissions.getSubmission, {
      id: id as any,
    });
    return result ? convertSubmission(result) : null;
  }

  async getFlaggedSubmissions(limit?: number): Promise<Submission[]> {
    const result = await this.client.query(
      api.submissions.getFlaggedSubmissions,
      { limit }
    );
    return result.map(convertSubmission);
  }

  async updateFlagStatus(
    id: string,
    flagged: boolean,
    reason?: string
  ): Promise<{ success: boolean }> {
    return await this.client.mutation(api.submissions.updateFlagStatus, {
      submissionId: id as any,
      flagged,
      reason,
    });
  }

  async claimAndMergeSubmissions(githubUsername: string): Promise<ClaimResult> {
    const result = await this.client.mutation(
      api.submissions.claimAndMergeSubmissions,
      { githubUsername }
    );
    return {
      success: result.success,
      action: result.action as "already_verified" | "claimed" | "merged",
      submissionId: result.submissionId || "",
      mergedCount: result.mergedCount || 0,
    };
  }

  async checkClaimableSubmissions(githubUsername: string): Promise<ClaimStatus> {
    const result = await this.client.query(
      api.submissions.checkClaimableSubmissions,
      { githubUsername }
    );
    return {
      actionNeeded: result.actionNeeded as "claim" | "merge" | null,
      actionText: result.actionText,
      cliCount: result.cliCount,
      oauthCount: result.oauthCount,
      totalSubmissions: result.totalSubmissions,
      unverifiedCount: result.unverifiedCount,
    };
  }
}

class ConvexProfilesService implements ProfilesService {
  private client: ConvexHttpClient;

  constructor(client: ConvexHttpClient) {
    this.client = client;
  }

  async getProfile(
    username: string,
    submissionLimit?: number
  ): Promise<ProfileWithSubmissions | null> {
    const result = await this.client.query(api.submissions.getProfile, {
      username,
      submissionLimit,
    });

    if (!result) return null;

    return {
      id: result._id,
      username: result.username,
      githubUsername: result.githubUsername,
      githubName: result.githubName,
      bio: result.bio,
      avatar: result.avatar,
      totalSubmissions: result.totalSubmissions,
      bestSubmission: result.bestSubmission,
      createdAt: result.createdAt,
      submissions: result.submissions.map(convertSubmission),
    };
  }

  async deleteByPattern(
    patterns: string[],
    options: PatternSearchOptions & { dryRun?: boolean }
  ): Promise<DeleteResult> {
    const result = await this.client.mutation(api.admin.deleteProfilesByPattern, {
      patterns,
      searchField: options.searchField,
      caseSensitive: options.caseSensitive,
      dryRun: options.dryRun,
    });

    return {
      message: result.message,
      matchedCount: result.matchedCount,
      deletedCount: result.deletedCount,
      dryRun: result.dryRun,
      patterns: result.patterns,
      searchField: result.searchField,
      profiles: result.profiles.map((p: any) => ({
        id: p.id,
        githubUsername: p.githubUsername,
        username: p.username,
        createdAt: p.createdAt,
      })),
    };
  }

  async findByPattern(
    patterns: string[],
    options: PatternSearchOptions
  ): Promise<FindProfilesResult> {
    const result = await this.client.query(api.admin.findProfilesByPattern, {
      patterns,
      searchField: options.searchField,
      caseSensitive: options.caseSensitive,
    });

    return {
      count: result.count,
      patterns: result.patterns,
      searchField: result.searchField,
      profiles: result.profiles.map((p: any) => ({
        id: p.id,
        githubUsername: p.githubUsername,
        username: p.username,
        createdAt: p.createdAt,
        avatar: p.avatar,
        totalSubmissions: p.totalSubmissions,
      })),
    };
  }
}

class ConvexStatsService implements StatsService {
  private client: ConvexHttpClient;

  constructor(client: ConvexHttpClient) {
    this.client = client;
  }

  async getGlobalStats(): Promise<GlobalStats> {
    const result = await this.client.query(api.stats.getGlobalStats, {});

    return {
      totalUsers: result.totalUsers,
      totalSubmissions: result.totalSubmissions,
      totalCost: result.totalCost,
      totalTokens: result.totalTokens,
      avgCostPerUser: result.avgCostPerUser,
      topCost: result.topCost,
      topUser: result.topUser,
      modelUsage: result.modelUsage,
      totalDays: result.totalDays,
      avgTokensPerUser: result.avgTokensPerUser,
      isApproximate: result.isApproximate,
      basedOnTop: result.basedOnTop,
    };
  }
}

// ============================================================================
// DATA LAYER FACTORY
// ============================================================================

class ConvexDataLayer implements DataLayer {
  submissions: SubmissionsService;
  profiles: ProfilesService;
  stats: StatsService;

  constructor(client: ConvexHttpClient) {
    this.submissions = new ConvexSubmissionsService(client);
    this.profiles = new ConvexProfilesService(client);
    this.stats = new ConvexStatsService(client);
  }
}

/**
 * Create a Convex data layer for client-side use
 * Uses the NEXT_PUBLIC_CONVEX_URL environment variable
 */
export function createConvexDataLayer(): DataLayer {
  const client = new ConvexHttpClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);
  return new ConvexDataLayer(client);
}

/**
 * Create a Convex data layer for server-side use
 * Used in API routes and server components
 */
export function createConvexServerDataLayer(): DataLayer {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  const client = new ConvexHttpClient(convexUrl);
  return new ConvexDataLayer(client);
}
