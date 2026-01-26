/**
 * Supabase Data Layer Implementation
 *
 * This implements the DataLayer interface using Supabase as the backend.
 * Used when NEXT_PUBLIC_DATABASE_BACKEND=supabase
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
  DailyBreakdown,
  ProfileWithSubmissions,
  GlobalStats,
  ClaimStatus,
  ClaimResult,
  DeleteResult,
  FindProfilesResult,
  PatternSearchOptions,
} from "../types";
import { SupabaseRateLimiter } from "./rate-limiter";

// ============================================================================
// DATABASE TYPES (matching Supabase schema)
// ============================================================================

interface DbSubmission {
  id: string;
  convex_id: string | null;
  username: string;
  github_username: string | null;
  github_name: string | null;
  github_avatar: string | null;
  total_tokens: number;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  date_range_start: string;
  date_range_end: string;
  models_used: string[];
  submitted_at: string;
  verified: boolean;
  source: "cli" | "oauth" | null;
  claimed_by: string | null;
  flagged_for_review: boolean | null;
  flag_reasons: string[] | null;
  created_at: string;
  updated_at: string;
}

interface DbDailyBreakdown {
  id: string;
  submission_id: string;
  date: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  total_cost: number;
  models_used: string[];
}

interface DbProfile {
  id: string;
  convex_id: string | null;
  username: string;
  github_username: string | null;
  github_name: string | null;
  bio: string | null;
  avatar: string | null;
  total_submissions: number;
  best_submission_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TYPE CONVERSIONS
// ============================================================================

function convertDbSubmissionToSubmission(
  dbSubmission: DbSubmission,
  dailyBreakdowns: DbDailyBreakdown[]
): Submission {
  return {
    id: dbSubmission.id,
    username: dbSubmission.username,
    githubUsername: dbSubmission.github_username || undefined,
    githubName: dbSubmission.github_name || undefined,
    githubAvatar: dbSubmission.github_avatar || undefined,
    totalTokens: dbSubmission.total_tokens,
    totalCost: Number(dbSubmission.total_cost),
    inputTokens: dbSubmission.input_tokens,
    outputTokens: dbSubmission.output_tokens,
    cacheCreationTokens: dbSubmission.cache_creation_tokens,
    cacheReadTokens: dbSubmission.cache_read_tokens,
    dateRange: {
      start: dbSubmission.date_range_start,
      end: dbSubmission.date_range_end,
    },
    modelsUsed: dbSubmission.models_used || [],
    dailyBreakdown: dailyBreakdowns.map(convertDbDailyBreakdown),
    submittedAt: new Date(dbSubmission.submitted_at).getTime(),
    verified: dbSubmission.verified,
    source: dbSubmission.source || undefined,
    claimedBy: dbSubmission.claimed_by || undefined,
    flaggedForReview: dbSubmission.flagged_for_review || undefined,
    flagReasons: dbSubmission.flag_reasons || undefined,
  };
}

function convertDbDailyBreakdown(db: DbDailyBreakdown): DailyBreakdown {
  return {
    date: db.date,
    inputTokens: db.input_tokens,
    outputTokens: db.output_tokens,
    cacheCreationTokens: db.cache_creation_tokens,
    cacheReadTokens: db.cache_read_tokens,
    totalTokens: db.total_tokens,
    totalCost: Number(db.total_cost),
    modelsUsed: db.models_used || [],
  };
}

// ============================================================================
// SUPABASE SUBMISSIONS SERVICE
// ============================================================================

class SupabaseSubmissionsService implements SubmissionsService {
  private client: SupabaseClient;
  private rateLimiter: SupabaseRateLimiter;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.rateLimiter = new SupabaseRateLimiter(client);
  }

  async submit(data: SubmitData): Promise<string> {
    // Check rate limit
    const rateLimitResult = await this.rateLimiter.checkLimit(
      "submitData",
      data.username
    );
    if (!rateLimitResult.allowed) {
      const waitSeconds = Math.ceil(
        ((rateLimitResult.retryAfter || Date.now() + 3600000) - Date.now()) / 1000
      );
      throw new Error(
        `Rate limit exceeded. Please wait ${waitSeconds} seconds before submitting again.`
      );
    }

    // Validate data (same logic as Convex)
    this.validateSubmitData(data);

    // Extract date range and models
    const dates = data.ccData.daily.map((d) => d.date).sort();
    const dateRangeStart = dates[0] || "";
    const dateRangeEnd = dates[dates.length - 1] || "";
    const modelsUsed = Array.from(
      new Set(data.ccData.daily.flatMap((day) => day.modelsUsed))
    );

    // Check for existing submission with overlapping date range
    // Use ilike for case-insensitive username matching
    const { data: existingSubmissions } = await this.client
      .from("submissions")
      .select("*")
      .ilike("username", data.username)
      .eq("source", data.source)
      .or(
        `and(date_range_start.lte.${dateRangeEnd},date_range_end.gte.${dateRangeStart})`
      )
      .limit(1);

    let submissionId: string;

    if (existingSubmissions && existingSubmissions.length > 0) {
      // Merge with existing submission
      submissionId = await this.mergeWithExisting(
        existingSubmissions[0],
        data,
        dateRangeStart,
        dateRangeEnd,
        modelsUsed
      );
    } else {
      // Create new submission
      submissionId = await this.createNewSubmission(
        data,
        dateRangeStart,
        dateRangeEnd,
        modelsUsed
      );
    }

    // Update or create profile
    await this.updateProfile(data, submissionId, !existingSubmissions?.length);

    return submissionId;
  }

  private validateSubmitData(data: SubmitData): void {
    const { ccData } = data;

    // Verify total tokens match sum of components
    const calculatedTotalTokens =
      ccData.totals.inputTokens +
      ccData.totals.outputTokens +
      ccData.totals.cacheCreationTokens +
      ccData.totals.cacheReadTokens;

    if (Math.abs(calculatedTotalTokens - ccData.totals.totalTokens) > 1) {
      throw new Error(
        "Token totals don't match. Please use official ccusage tool."
      );
    }

    // Validate realistic ranges
    const MAX_DAILY_COST = 5000;
    const MAX_DAILY_TOKENS = 250_000_000;

    if (ccData.totals.totalCost < 0 || ccData.totals.totalTokens < 0) {
      throw new Error("Negative values are not allowed.");
    }

    if (ccData.totals.totalCost > MAX_DAILY_COST * 365) {
      throw new Error("Total cost exceeds realistic limits.");
    }

    // Validate date format and daily data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    // Use UTC to avoid timezone issues - get today's date in UTC
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    for (const day of ccData.daily) {
      if (!dateRegex.test(day.date)) {
        throw new Error(`Invalid date format: ${day.date}. Expected YYYY-MM-DD`);
      }

      // Parse date as UTC to match how we're comparing
      const dayDate = new Date(day.date + "T00:00:00Z");
      if (dayDate > todayUTC) {
        throw new Error(`Future date detected: ${day.date}`);
      }

      if (
        day.totalCost < 0 ||
        day.totalTokens < 0 ||
        day.inputTokens < 0 ||
        day.outputTokens < 0
      ) {
        throw new Error("Negative values are not allowed in daily data.");
      }
    }
  }

  private async mergeWithExisting(
    existing: DbSubmission,
    data: SubmitData,
    dateRangeStart: string,
    dateRangeEnd: string,
    modelsUsed: string[]
  ): Promise<string> {
    // Get existing daily breakdowns
    const { data: existingDaily } = await this.client
      .from("daily_breakdowns")
      .select("*")
      .eq("submission_id", existing.id);

    // Create a map of existing daily data
    const dailyMap = new Map<string, DbDailyBreakdown>();
    (existingDaily || []).forEach((day) => dailyMap.set(day.date, day));

    // Update with new daily data
    for (const day of data.ccData.daily) {
      const dailyData = {
        submission_id: existing.id,
        date: day.date,
        input_tokens: day.inputTokens,
        output_tokens: day.outputTokens,
        cache_creation_tokens: day.cacheCreationTokens,
        cache_read_tokens: day.cacheReadTokens,
        total_tokens: day.totalTokens,
        total_cost: day.totalCost,
        models_used: day.modelsUsed,
      };

      if (dailyMap.has(day.date)) {
        // Update existing
        await this.client
          .from("daily_breakdowns")
          .update(dailyData)
          .eq("submission_id", existing.id)
          .eq("date", day.date);
      } else {
        // Insert new
        await this.client.from("daily_breakdowns").insert(dailyData);
      }
      dailyMap.set(day.date, dailyData as DbDailyBreakdown);
    }

    // Recalculate totals from all daily data
    const allDaily = Array.from(dailyMap.values());
    const totals = allDaily.reduce(
      (acc, day) => ({
        inputTokens: acc.inputTokens + day.input_tokens,
        outputTokens: acc.outputTokens + day.output_tokens,
        cacheCreationTokens: acc.cacheCreationTokens + day.cache_creation_tokens,
        cacheReadTokens: acc.cacheReadTokens + day.cache_read_tokens,
        totalTokens: acc.totalTokens + day.total_tokens,
        totalCost: acc.totalCost + Number(day.total_cost),
      }),
      {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        totalCost: 0,
      }
    );

    // Update date range
    const allDates = allDaily.map((d) => d.date).sort();
    const newDateRangeStart = allDates[0] || dateRangeStart;
    const newDateRangeEnd = allDates[allDates.length - 1] || dateRangeEnd;

    // Merge models
    const allModels = Array.from(
      new Set([...(existing.models_used || []), ...modelsUsed])
    );

    // Update submission
    await this.client
      .from("submissions")
      .update({
        github_username: data.githubUsername,
        github_name: data.githubName,
        github_avatar: data.githubAvatar,
        total_tokens: totals.totalTokens,
        total_cost: totals.totalCost,
        input_tokens: totals.inputTokens,
        output_tokens: totals.outputTokens,
        cache_creation_tokens: totals.cacheCreationTokens,
        cache_read_tokens: totals.cacheReadTokens,
        date_range_start: newDateRangeStart,
        date_range_end: newDateRangeEnd,
        models_used: allModels,
        submitted_at: new Date().toISOString(),
        verified: data.verified,
        source: data.source,
      })
      .eq("id", existing.id);

    return existing.id;
  }

  private async createNewSubmission(
    data: SubmitData,
    dateRangeStart: string,
    dateRangeEnd: string,
    modelsUsed: string[]
  ): Promise<string> {
    // Insert submission
    const { data: submission, error } = await this.client
      .from("submissions")
      .insert({
        username: data.username,
        github_username: data.githubUsername,
        github_name: data.githubName,
        github_avatar: data.githubAvatar,
        total_tokens: data.ccData.totals.totalTokens,
        total_cost: data.ccData.totals.totalCost,
        input_tokens: data.ccData.totals.inputTokens,
        output_tokens: data.ccData.totals.outputTokens,
        cache_creation_tokens: data.ccData.totals.cacheCreationTokens,
        cache_read_tokens: data.ccData.totals.cacheReadTokens,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        models_used: modelsUsed,
        submitted_at: new Date().toISOString(),
        verified: data.verified,
        source: data.source,
      })
      .select()
      .single();

    if (error || !submission) {
      throw new Error("Failed to create submission: " + error?.message);
    }

    // Insert daily breakdowns
    const dailyRows = data.ccData.daily.map((day) => ({
      submission_id: submission.id,
      date: day.date,
      input_tokens: day.inputTokens,
      output_tokens: day.outputTokens,
      cache_creation_tokens: day.cacheCreationTokens,
      cache_read_tokens: day.cacheReadTokens,
      total_tokens: day.totalTokens,
      total_cost: day.totalCost,
      models_used: day.modelsUsed,
    }));

    await this.client.from("daily_breakdowns").insert(dailyRows);

    return submission.id;
  }

  private async updateProfile(
    data: SubmitData,
    submissionId: string,
    isNewSubmission: boolean
  ): Promise<void> {
    const { data: existingProfile } = await this.client
      .from("profiles")
      .select("*")
      .eq("username", data.username)
      .single();

    if (existingProfile) {
      const updates: any = {
        best_submission_id: submissionId,
        github_username: data.githubUsername,
        github_name: data.githubName,
        avatar: data.githubAvatar,
      };

      if (isNewSubmission) {
        updates.total_submissions = existingProfile.total_submissions + 1;
      }

      await this.client
        .from("profiles")
        .update(updates)
        .eq("id", existingProfile.id);
    } else {
      await this.client.from("profiles").insert({
        username: data.username,
        github_username: data.githubUsername,
        github_name: data.githubName,
        avatar: data.githubAvatar,
        total_submissions: 1,
        best_submission_id: submissionId,
      });
    }
  }

  async getLeaderboard(params: LeaderboardParams): Promise<LeaderboardResult> {
    const sortBy = params.sortBy || "cost";
    const page = params.page || 0;
    const pageSize = Math.min(params.pageSize || 25, 50);
    const offset = page * pageSize;
    const includeFlagged = params.includeFlagged || false;

    let query = this.client
      .from("submissions")
      .select("*", { count: "exact" })
      .order(sortBy === "cost" ? "total_cost" : "total_tokens", {
        ascending: false,
      })
      .range(offset, offset + pageSize - 1);

    if (!includeFlagged) {
      query = query.or("flagged_for_review.is.null,flagged_for_review.eq.false");
    }

    const { data: submissions, count, error } = await query;

    if (error) {
      throw new Error("Failed to fetch leaderboard: " + error.message);
    }

    // Fetch daily breakdowns for all submissions
    const submissionIds = (submissions || []).map((s) => s.id);
    const { data: allDailyBreakdowns } = await this.client
      .from("daily_breakdowns")
      .select("*")
      .in("submission_id", submissionIds);

    const dailyBySubmission = new Map<string, DbDailyBreakdown[]>();
    (allDailyBreakdowns || []).forEach((db) => {
      const existing = dailyBySubmission.get(db.submission_id) || [];
      existing.push(db);
      dailyBySubmission.set(db.submission_id, existing);
    });

    const items = (submissions || []).map((s) =>
      convertDbSubmissionToSubmission(s, dailyBySubmission.get(s.id) || [])
    );

    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items,
      page,
      pageSize,
      hasMore: offset + pageSize < totalItems,
      totalPages,
    };
  }

  async getLeaderboardByDateRange(
    params: DateRangeLeaderboardParams
  ): Promise<DateRangeLeaderboardResult> {
    const limit = Math.min(params.limit || 50, 100);
    const includeFlagged = params.includeFlagged || false;
    const sortBy = params.sortBy || "cost";

    // This query uses a Postgres function for date-filtered aggregation
    // For now, we'll do it in the application layer (like Convex does)
    let query = this.client.from("submissions").select("*");

    if (!includeFlagged) {
      query = query.or("flagged_for_review.is.null,flagged_for_review.eq.false");
    }

    const { data: submissions } = await query.limit(100);

    if (!submissions) {
      return { items: [], hasMore: false };
    }

    // Fetch all daily breakdowns
    const submissionIds = submissions.map((s) => s.id);
    const { data: allDailyBreakdowns } = await this.client
      .from("daily_breakdowns")
      .select("*")
      .in("submission_id", submissionIds)
      .gte("date", params.dateFrom)
      .lte("date", params.dateTo);

    const dailyBySubmission = new Map<string, DbDailyBreakdown[]>();
    (allDailyBreakdowns || []).forEach((db) => {
      const existing = dailyBySubmission.get(db.submission_id) || [];
      existing.push(db);
      dailyBySubmission.set(db.submission_id, existing);
    });

    // Filter and aggregate
    const processedItems: Submission[] = [];

    for (const submission of submissions) {
      const filteredDaily = dailyBySubmission.get(submission.id) || [];
      if (filteredDaily.length === 0) continue;

      // Calculate totals for filtered date range
      const totals = filteredDaily.reduce(
        (acc, day) => ({
          totalCost: acc.totalCost + Number(day.total_cost),
          totalTokens: acc.totalTokens + day.total_tokens,
          inputTokens: acc.inputTokens + day.input_tokens,
          outputTokens: acc.outputTokens + day.output_tokens,
          cacheCreationTokens: acc.cacheCreationTokens + day.cache_creation_tokens,
          cacheReadTokens: acc.cacheReadTokens + day.cache_read_tokens,
        }),
        {
          totalCost: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        }
      );

      const converted = convertDbSubmissionToSubmission(submission, filteredDaily);
      // Override with filtered totals
      processedItems.push({
        ...converted,
        ...totals,
      });
    }

    // Sort
    processedItems.sort((a, b) =>
      sortBy === "cost" ? b.totalCost - a.totalCost : b.totalTokens - a.totalTokens
    );

    return {
      items: processedItems.slice(0, limit),
      hasMore: processedItems.length > limit,
      needsMoreData: false,
    };
  }

  async getSubmission(id: string): Promise<Submission | null> {
    const { data: submission } = await this.client
      .from("submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (!submission) return null;

    const { data: dailyBreakdowns } = await this.client
      .from("daily_breakdowns")
      .select("*")
      .eq("submission_id", id)
      .order("date");

    return convertDbSubmissionToSubmission(submission, dailyBreakdowns || []);
  }

  async getFlaggedSubmissions(limit: number = 25): Promise<Submission[]> {
    const { data: submissions } = await this.client
      .from("submissions")
      .select("*")
      .eq("flagged_for_review", true)
      .order("submitted_at", { ascending: false })
      .limit(Math.min(limit, 50));

    if (!submissions) return [];

    const submissionIds = submissions.map((s) => s.id);
    const { data: allDailyBreakdowns } = await this.client
      .from("daily_breakdowns")
      .select("*")
      .in("submission_id", submissionIds);

    const dailyBySubmission = new Map<string, DbDailyBreakdown[]>();
    (allDailyBreakdowns || []).forEach((db) => {
      const existing = dailyBySubmission.get(db.submission_id) || [];
      existing.push(db);
      dailyBySubmission.set(db.submission_id, existing);
    });

    return submissions.map((s) =>
      convertDbSubmissionToSubmission(s, dailyBySubmission.get(s.id) || [])
    );
  }

  async updateFlagStatus(
    id: string,
    flagged: boolean,
    reason?: string
  ): Promise<{ success: boolean }> {
    const { data: submission } = await this.client
      .from("submissions")
      .select("flag_reasons")
      .eq("id", id)
      .single();

    const updates: any = {
      flagged_for_review: flagged,
    };

    if (flagged && reason) {
      updates.flag_reasons = [...(submission?.flag_reasons || []), reason];
    } else if (!flagged) {
      updates.flag_reasons = null;
    }

    await this.client.from("submissions").update(updates).eq("id", id);

    return { success: true };
  }

  async claimAndMergeSubmissions(githubUsername: string): Promise<ClaimResult> {
    const { data: submissions } = await this.client
      .from("submissions")
      .select("*")
      .eq("github_username", githubUsername)
      .limit(100);

    if (!submissions || submissions.length === 0) {
      throw new Error("No submissions found");
    }

    if (submissions.length === 1 && submissions[0].verified) {
      return {
        success: true,
        action: "already_verified",
        submissionId: submissions[0].id,
        mergedCount: 1,
      };
    }

    const cliSubmissions = submissions.filter((s) => s.source === "cli");
    const oauthSubmissions = submissions.filter((s) => s.source === "oauth");

    if (oauthSubmissions.length === 0 && cliSubmissions.length === 1) {
      await this.client
        .from("submissions")
        .update({ verified: true })
        .eq("id", cliSubmissions[0].id);

      return {
        success: true,
        action: "claimed",
        submissionId: cliSubmissions[0].id,
        mergedCount: 1,
      };
    }

    // Merge submissions
    const baseSubmission =
      oauthSubmissions[0] ||
      submissions.sort((a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )[0];

    // Get all daily breakdowns
    const submissionIds = submissions.map((s) => s.id);
    const { data: allDailyBreakdowns } = await this.client
      .from("daily_breakdowns")
      .select("*")
      .in("submission_id", submissionIds);

    // Merge daily data (OAuth takes priority)
    const dailyMap = new Map<string, DbDailyBreakdown>();
    for (const submission of submissions) {
      const isOauth = submission.source === "oauth";
      const daily = (allDailyBreakdowns || []).filter(
        (d) => d.submission_id === submission.id
      );
      for (const day of daily) {
        if (isOauth || !dailyMap.has(day.date)) {
          dailyMap.set(day.date, day);
        }
      }
    }

    const mergedDaily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Calculate new totals
    const totals = mergedDaily.reduce(
      (acc, day) => ({
        totalTokens: acc.totalTokens + day.total_tokens,
        totalCost: acc.totalCost + Number(day.total_cost),
        inputTokens: acc.inputTokens + day.input_tokens,
        outputTokens: acc.outputTokens + day.output_tokens,
        cacheCreationTokens: acc.cacheCreationTokens + day.cache_creation_tokens,
        cacheReadTokens: acc.cacheReadTokens + day.cache_read_tokens,
      }),
      {
        totalTokens: 0,
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      }
    );

    const dateRange = {
      start: mergedDaily[0]?.date || "",
      end: mergedDaily[mergedDaily.length - 1]?.date || "",
    };

    const allModels = Array.from(
      new Set(mergedDaily.flatMap((d) => d.models_used || []))
    );

    // Update base submission
    await this.client
      .from("submissions")
      .update({
        total_tokens: totals.totalTokens,
        total_cost: totals.totalCost,
        input_tokens: totals.inputTokens,
        output_tokens: totals.outputTokens,
        cache_creation_tokens: totals.cacheCreationTokens,
        cache_read_tokens: totals.cacheReadTokens,
        date_range_start: dateRange.start,
        date_range_end: dateRange.end,
        models_used: allModels,
        submitted_at: new Date().toISOString(),
        verified: true,
        source: oauthSubmissions.length > 0 ? "oauth" : baseSubmission.source,
      })
      .eq("id", baseSubmission.id);

    // Delete daily breakdowns for base and re-insert merged
    await this.client
      .from("daily_breakdowns")
      .delete()
      .eq("submission_id", baseSubmission.id);

    await this.client.from("daily_breakdowns").insert(
      mergedDaily.map((d) => ({
        submission_id: baseSubmission.id,
        date: d.date,
        input_tokens: d.input_tokens,
        output_tokens: d.output_tokens,
        cache_creation_tokens: d.cache_creation_tokens,
        cache_read_tokens: d.cache_read_tokens,
        total_tokens: d.total_tokens,
        total_cost: d.total_cost,
        models_used: d.models_used,
      }))
    );

    // Delete other submissions (cascade deletes their daily breakdowns)
    const deletedCount = submissions.length - 1;
    for (const submission of submissions) {
      if (submission.id !== baseSubmission.id) {
        await this.client.from("submissions").delete().eq("id", submission.id);
      }
    }

    // Update profile totalSubmissions to reflect merged count
    if (deletedCount > 0) {
      const { data: profile } = await this.client
        .from("profiles")
        .select("id, total_submissions")
        .eq("github_username", githubUsername)
        .single();

      if (profile) {
        await this.client
          .from("profiles")
          .update({
            total_submissions: Math.max(1, profile.total_submissions - deletedCount),
            best_submission_id: baseSubmission.id,
          })
          .eq("id", profile.id);
      }
    }

    return {
      success: true,
      action: "merged",
      submissionId: baseSubmission.id,
      mergedCount: submissions.length,
    };
  }

  async checkClaimableSubmissions(githubUsername: string): Promise<ClaimStatus> {
    const { data: submissions } = await this.client
      .from("submissions")
      .select("*")
      .eq("github_username", githubUsername)
      .limit(100);

    if (!submissions || submissions.length === 0) {
      return {
        actionNeeded: null,
        actionText: "",
        cliCount: 0,
        oauthCount: 0,
        totalSubmissions: 0,
        unverifiedCount: 0,
      };
    }

    const cliCount = submissions.filter((s) => s.source === "cli").length;
    const oauthCount = submissions.filter((s) => s.source === "oauth").length;
    const unverifiedCount = submissions.filter((s) => !s.verified).length;

    let actionNeeded: "claim" | "merge" | null = null;
    let actionText = "";

    if (submissions.length === 1 && submissions[0].verified) {
      actionNeeded = null;
    } else if (unverifiedCount > 0 && submissions.length === 1) {
      actionNeeded = "claim";
      actionText = "Verify your submission";
    } else if (submissions.length > 1) {
      actionNeeded = "merge";
      actionText = `Merge ${submissions.length} submissions into one`;
    }

    return {
      actionNeeded,
      actionText,
      cliCount,
      oauthCount,
      totalSubmissions: submissions.length,
      unverifiedCount,
    };
  }
}

// ============================================================================
// SUPABASE PROFILES SERVICE
// ============================================================================

class SupabaseProfilesService implements ProfilesService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getProfile(
    username: string,
    submissionLimit: number = 10
  ): Promise<ProfileWithSubmissions | null> {
    // Use ilike for case-insensitive username matching
    const { data: profile } = await this.client
      .from("profiles")
      .select("*")
      .ilike("username", username)
      .single();

    if (!profile) return null;

    const limit = Math.min(submissionLimit, 25);
    // Use the stored username (with correct case) for submission lookup
    const { data: submissions } = await this.client
      .from("submissions")
      .select("*")
      .ilike("username", profile.username)
      .order("submitted_at", { ascending: false })
      .limit(limit);

    const submissionIds = (submissions || []).map((s) => s.id);
    const { data: allDailyBreakdowns } = await this.client
      .from("daily_breakdowns")
      .select("*")
      .in("submission_id", submissionIds);

    const dailyBySubmission = new Map<string, DbDailyBreakdown[]>();
    (allDailyBreakdowns || []).forEach((db) => {
      const existing = dailyBySubmission.get(db.submission_id) || [];
      existing.push(db);
      dailyBySubmission.set(db.submission_id, existing);
    });

    return {
      id: profile.id,
      username: profile.username,
      githubUsername: profile.github_username || undefined,
      githubName: profile.github_name || undefined,
      bio: profile.bio || undefined,
      avatar: profile.avatar || undefined,
      totalSubmissions: profile.total_submissions,
      bestSubmission: profile.best_submission_id || undefined,
      createdAt: new Date(profile.created_at).getTime(),
      submissions: (submissions || []).map((s) =>
        convertDbSubmissionToSubmission(s, dailyBySubmission.get(s.id) || [])
      ),
    };
  }

  async deleteByPattern(
    patterns: string[],
    options: PatternSearchOptions & { dryRun?: boolean }
  ): Promise<DeleteResult> {
    const { searchField = "githubUsername", caseSensitive = false, dryRun = false } = options;

    const { data: allProfiles } = await this.client.from("profiles").select("*");

    const matchingProfiles = (allProfiles || []).filter((profile) => {
      const githubUsername = profile.github_username || "";
      const username = profile.username || "";

      let fieldsToCheck: string[] = [];
      if (searchField === "githubUsername") {
        fieldsToCheck = [githubUsername];
      } else if (searchField === "username") {
        fieldsToCheck = [username];
      } else {
        fieldsToCheck = [githubUsername, username];
      }

      return fieldsToCheck.some((field) => {
        const fieldToCheck = caseSensitive ? field : field.toLowerCase();
        return patterns.some((pattern) => {
          const patternToCheck = caseSensitive ? pattern : pattern.toLowerCase();
          return fieldToCheck.includes(patternToCheck);
        });
      });
    });

    let deletedCount = 0;
    if (!dryRun) {
      for (const profile of matchingProfiles) {
        await this.client.from("profiles").delete().eq("id", profile.id);
        deletedCount++;
      }
    }

    return {
      message: dryRun
        ? `Dry run: Would delete ${matchingProfiles.length} profiles`
        : `Successfully deleted ${deletedCount} profiles`,
      matchedCount: matchingProfiles.length,
      deletedCount: dryRun ? 0 : deletedCount,
      dryRun,
      patterns,
      searchField,
      profiles: matchingProfiles.map((p) => ({
        id: p.id,
        githubUsername: p.github_username || undefined,
        username: p.username,
        createdAt: new Date(p.created_at).getTime(),
      })),
    };
  }

  async findByPattern(
    patterns: string[],
    options: PatternSearchOptions
  ): Promise<FindProfilesResult> {
    const { searchField = "githubUsername", caseSensitive = false } = options;

    const { data: allProfiles } = await this.client.from("profiles").select("*");

    const matchingProfiles = (allProfiles || []).filter((profile) => {
      const githubUsername = profile.github_username || "";
      const username = profile.username || "";

      let fieldsToCheck: string[] = [];
      if (searchField === "githubUsername") {
        fieldsToCheck = [githubUsername];
      } else if (searchField === "username") {
        fieldsToCheck = [username];
      } else {
        fieldsToCheck = [githubUsername, username];
      }

      return fieldsToCheck.some((field) => {
        const fieldToCheck = caseSensitive ? field : field.toLowerCase();
        return patterns.some((pattern) => {
          const patternToCheck = caseSensitive ? pattern : pattern.toLowerCase();
          return fieldToCheck.includes(patternToCheck);
        });
      });
    });

    return {
      count: matchingProfiles.length,
      patterns,
      searchField,
      profiles: matchingProfiles.map((p) => ({
        id: p.id,
        githubUsername: p.github_username || undefined,
        username: p.username,
        createdAt: new Date(p.created_at).getTime(),
        avatar: p.avatar || undefined,
        totalSubmissions: p.total_submissions,
      })),
    };
  }
}

// ============================================================================
// SUPABASE STATS SERVICE
// ============================================================================

class SupabaseStatsService implements StatsService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getGlobalStats(): Promise<GlobalStats> {
    // Get profile count
    const { count: profileCount } = await this.client
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Get top submissions by cost
    const { data: topByCost } = await this.client
      .from("submissions")
      .select("*")
      .or("flagged_for_review.is.null,flagged_for_review.eq.false")
      .order("total_cost", { ascending: false })
      .limit(500);

    let totalCost = 0;
    let totalTokens = 0;
    let totalDays = 0;
    let validSubmissions = 0;
    const uniqueUsers = new Set<string>();
    const modelUsage: Record<string, number> = {};
    let topSubmission: DbSubmission | null = null;

    // Get daily breakdown counts for totalDays
    const submissionIds = (topByCost || []).map((s) => s.id);
    const { data: dailyCounts } = await this.client
      .from("daily_breakdowns")
      .select("submission_id")
      .in("submission_id", submissionIds);

    const daysPerSubmission = new Map<string, number>();
    (dailyCounts || []).forEach((d) => {
      daysPerSubmission.set(
        d.submission_id,
        (daysPerSubmission.get(d.submission_id) || 0) + 1
      );
    });

    for (const submission of topByCost || []) {
      validSubmissions++;
      uniqueUsers.add(submission.username);
      totalCost += Number(submission.total_cost);
      totalTokens += submission.total_tokens;
      totalDays += daysPerSubmission.get(submission.id) || 0;

      if (!topSubmission || Number(submission.total_cost) > Number(topSubmission.total_cost)) {
        topSubmission = submission;
      }

      (submission.models_used || []).forEach((model: string) => {
        const key = model.includes("opus") ? "opus" : "sonnet";
        modelUsage[key] = (modelUsage[key] || 0) + 1;
      });
    }

    // Get total submission count
    const { count: totalSubmissionCount } = await this.client
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .or("flagged_for_review.is.null,flagged_for_review.eq.false");

    const uniqueUserCount = Math.max(uniqueUsers.size, profileCount || 0);
    const avgCostPerUser = uniqueUserCount > 0 ? totalCost / uniqueUserCount : 0;
    const avgTokensPerUser = uniqueUserCount > 0 ? totalTokens / uniqueUserCount : 0;

    return {
      totalUsers: uniqueUserCount,
      totalSubmissions: Math.max(validSubmissions, totalSubmissionCount || 0),
      totalCost,
      totalTokens,
      avgCostPerUser,
      topCost: topSubmission ? Number(topSubmission.total_cost) : 0,
      topUser: topSubmission?.username || "N/A",
      modelUsage,
      totalDays,
      avgTokensPerUser,
      isApproximate: true,
      basedOnTop: 500,
    };
  }
}

// ============================================================================
// DATA LAYER FACTORY
// ============================================================================

class SupabaseDataLayer implements DataLayer {
  submissions: SubmissionsService;
  profiles: ProfilesService;
  stats: StatsService;

  constructor(client: SupabaseClient) {
    this.submissions = new SupabaseSubmissionsService(client);
    this.profiles = new SupabaseProfilesService(client);
    this.stats = new SupabaseStatsService(client);
  }
}

/**
 * Create a Supabase data layer for client-side use
 */
export function createSupabaseDataLayer(): DataLayer {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables not set");
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  return new SupabaseDataLayer(client);
}

/**
 * Create a Supabase data layer for server-side use
 * Uses the service key for elevated permissions
 */
export function createSupabaseServerDataLayer(): DataLayer {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase server environment variables not set");
  }

  const client = createClient(supabaseUrl, supabaseServiceKey);
  return new SupabaseDataLayer(client);
}
