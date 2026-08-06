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
  SiteStats,
  ClaimStatus,
  ClaimResult,
  DeleteResult,
  FindProfilesResult,
  PatternSearchOptions,
  HireListing,
  ModelBreakdown,
  TokensService,
  ApiTokenSummary,
  TokenOwner,
} from "../types";
import { generateToken, hashToken, looksLikeToken } from "@/lib/tokens";
import { monthsUserDeleted, monthOfDate, corpusCoversDay, type CorpusSize } from "@/lib/drift";
import { SupabaseRateLimiter } from "./rate-limiter";
import type { BurnRow } from "@/lib/spend-curve";
import {
  validateCcData,
  inferToolFromModel,
  mergeMachineContribution,
  DEFAULT_MACHINE_ID,
  type MachineContribution,
} from "@/lib/ccusage";

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
  tools: string[] | null;
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
  agents: string[] | null;
  model_breakdowns: ModelBreakdown[] | null;
  // Per-machine slices of this day, keyed by machine id. NULL on legacy rows
  // that predate per-machine tracking (#43).
  machine_contributions: Record<string, MachineContribution> | null;
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
  open_to_work: boolean | null;
  open_to_work_email: string | null;
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
    tools: dbSubmission.tools || [],
    dailyBreakdown: dailyBreakdowns.map(convertDbDailyBreakdown),
    submittedAt: new Date(dbSubmission.submitted_at).getTime(),
    verified: dbSubmission.verified,
    source: dbSubmission.source || undefined,
    claimedBy: dbSubmission.claimed_by || undefined,
    flaggedForReview: dbSubmission.flagged_for_review || undefined,
    flagReasons: dbSubmission.flag_reasons || undefined,
  };
}

/** One incoming day (one machine's cc.json) as a per-machine contribution. */
function dailyEntryToContribution(
  day: SubmitData["ccData"]["daily"][number]
): MachineContribution {
  return {
    inputTokens: day.inputTokens,
    outputTokens: day.outputTokens,
    cacheCreationTokens: day.cacheCreationTokens,
    cacheReadTokens: day.cacheReadTokens,
    totalTokens: day.totalTokens,
    totalCost: day.totalCost,
    modelsUsed: day.modelsUsed,
    agents: day.agents ?? [],
    modelBreakdowns: day.modelBreakdowns,
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
    agents: db.agents || [],
    modelBreakdowns: db.model_breakdowns || undefined,
  };
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * PostgREST caps every response at the project's `db-max-rows` (1000 by
 * default), and it does so *silently* — a larger `.limit()` is not an error,
 * it just returns the cap. Truncation here is worse than a partial result:
 * callers that group rows by submission see a submission with zero rows and
 * skip it entirely, so a user disappears rather than showing a low total.
 *
 * Page explicitly instead. The caller supplies a builder so the ordering is
 * applied to its own query — a stable order is what makes paging correct, and
 * without one it is arbitrary which rows survive.
 */
/**
 * Minimum lifetime spend before a submission is ranked on tokens-per-dollar.
 *
 * Measured against the live board: unfiltered, the top of the efficiency
 * ranking was a $0.01 submission at 7M tokens/$ against a median of 1.2M —
 * the ratio of a rounding error, not a way of working. At $100 the ranking
 * spans real usage ($112 to $11K of spend) and reads as a genuine second axis.
 */
export const EFFICIENCY_MIN_COST = 100;

const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000;

export async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  context: string
): Promise<T[]> {
  const all: T[] = [];

  while (all.length < MAX_ROWS) {
    const { data, error } = await buildPage(all.length, all.length + PAGE_SIZE - 1);

    // A failed page must not look like the end of the data. Silently breaking
    // here would reintroduce the truncation this helper exists to prevent.
    if (error) {
      throw new Error(`Failed to query ${context}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    // Advance by what the server actually returned, and stop only on an empty
    // page. Stopping at `length < PAGE_SIZE` would assume `db-max-rows` is at
    // least PAGE_SIZE — if it were configured lower, every page would come
    // back short and we'd silently truncate at the first one. The cost is one
    // extra empty request per query, which is the right trade for a helper
    // whose entire job is to not lose rows.
    all.push(...data);
  }

  if (all.length >= MAX_ROWS) {
    console.error(
      `fetchAllPages hit the ${MAX_ROWS}-row ceiling for ${context}; results are truncated.`
    );
  }

  return all;
}

/**
 * `.in("col", ids)` is serialised into the query string, so a large id list
 * builds a URL the server refuses. Measured against production: ~350 UUIDs is
 * the ceiling, and past it the request fails outright rather than degrading.
 *
 * That failure was invisible — callers destructured `{ data }` and read a
 * null as "no rows", so `getGlobalStats` silently reported 0 days tracked and
 * the date-range leaderboard returned an empty board. Chunk well under the
 * limit and page each chunk.
 */
const IN_FILTER_CHUNK = 200;

async function fetchAllByIds<T>(
  ids: string[],
  buildPage: (
    chunk: string[],
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  context: string
): Promise<T[]> {
  if (ids.length === 0) return [];

  const all: T[] = [];
  for (let i = 0; i < ids.length; i += IN_FILTER_CHUNK) {
    const chunk = ids.slice(i, i + IN_FILTER_CHUNK);
    const rows = await fetchAllPages<T>(
      (from, to) => buildPage(chunk, from, to),
      context
    );
    all.push(...rows);
  }
  return all;
}

// ============================================================================
// SUPABASE SUBMISSIONS SERVICE
// ============================================================================

/** The slice of the rate limiter this service needs — injectable for tests. */
type RateLimitChecker = Pick<SupabaseRateLimiter, "checkLimit">;

export class SupabaseSubmissionsService implements SubmissionsService {
  private client: SupabaseClient;
  private rateLimiter: RateLimitChecker;

  constructor(
    client: SupabaseClient,
    rateLimiter: RateLimitChecker = new SupabaseRateLimiter(client)
  ) {
    this.client = client;
    this.rateLimiter = rateLimiter;
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
    // Tools/agents contributing to this submission (claude, codex, …).
    const tools =
      data.ccData.tools ??
      Array.from(new Set(data.ccData.daily.flatMap((day) => day.agents ?? [])));

    // Check for existing submission with overlapping date range
    // Use ilike for case-insensitive username matching
    const { data: existingSubmissions, error: existingSubmissionsError } = await this.client
      .from("submissions")
      .select("*")
      .ilike("username", data.username)
      .eq("source", data.source)
      .or(
        `and(date_range_start.lte.${dateRangeEnd},date_range_end.gte.${dateRangeStart})`
      )
      .limit(1);

    if (existingSubmissionsError) {
      throw new Error(
        `Failed to query existing submissions: ${existingSubmissionsError.message}`
      );
    }

    // Identify the contributing machine so overlapping dates from distinct
    // machines sum while a same-machine re-submit replaces only its slice (#43).
    // Web uploads / older CLIs send no id ("default"): unattributable, so
    // they replace the whole day rather than sum against id'd slices (#81).
    const machineId = data.machineId || DEFAULT_MACHINE_ID;

    let submissionId: string;

    if (existingSubmissions && existingSubmissions.length > 0) {
      // Merge with existing submission
      submissionId = await this.mergeWithExisting(
        existingSubmissions[0],
        data,
        dateRangeStart,
        dateRangeEnd,
        modelsUsed,
        tools,
        machineId
      );
    } else {
      // Create new submission
      submissionId = await this.createNewSubmission(
        data,
        dateRangeStart,
        dateRangeEnd,
        modelsUsed,
        tools,
        machineId
      );
    }

    // The submission is durable by this point. The profile row is a projection
    // of it, so a failure here must be logged rather than raised: turning an
    // accepted submission into a client-visible error is what pushes users to
    // retry a write that already landed (#93).
    try {
      await this.updateProfile(data, submissionId, !existingSubmissions?.length);
    } catch (profileError) {
      console.error(
        "Profile update failed after the submission was accepted:",
        profileError
      );
    }

    return submissionId;
  }

  private validateSubmitData(data: SubmitData): void {
    // All validation lives in the shared, unit-tested validator so every
    // ingestion path enforces the same rules. Data arrives already normalized
    // (period→date, deduped) from src/lib/ccusage.normalizeCcData.
    validateCcData(data.ccData as Parameters<typeof validateCcData>[0]);
  }

  /**
   * Compare the client's per-month corpus against what this machine last
   * reported, and return the months whose lower totals should be honoured.
   *
   * Best effort throughout: a client that sends no corpus, or a table that
   * isn't migrated yet, yields an empty set — which is #111's behaviour, so
   * the worst case is the status quo rather than a failed submission.
   */
  private async classifyCorpusDrift(
    data: SubmitData,
    machineId: string
  ): Promise<Set<string>> {
    const incoming = data.corpus;
    if (!incoming || Object.keys(incoming).length === 0) return new Set();

    try {
      const { data: rows, error } = await this.client
        .from("corpus_observations")
        .select("month, files, bytes")
        .ilike("username", data.username)
        .eq("machine_id", machineId);

      if (error) {
        if (MISSING_TABLE_CODES.has(error.code)) return new Set();
        console.error("Corpus lookup failed:", error.message);
        return new Set();
      }

      const prior: Record<string, CorpusSize> = {};
      for (const row of rows ?? []) {
        prior[row.month] = { files: Number(row.files), bytes: Number(row.bytes) };
      }

      const deleted = monthsUserDeleted(prior, incoming);

      // Record the new observation so the next submission has something to
      // compare against. Upsert on the natural key rather than delete-insert,
      // so a failure here cannot leave the machine with no history at all.
      const { error: upsertError } = await this.client.from("corpus_observations").upsert(
        Object.entries(incoming).map(([month, size]) => ({
          username: data.username,
          machine_id: machineId,
          month,
          files: Math.max(0, Math.trunc(Number(size.files) || 0)),
          bytes: Math.max(0, Math.trunc(Number(size.bytes) || 0)),
          observed_at: new Date().toISOString(),
        })),
        { onConflict: "username,machine_id,month" }
      );
      if (upsertError) console.error("Corpus observation upsert failed:", upsertError.message);

      if (deleted.size > 0) {
        console.warn(
          `Corpus shrank for ${data.username} (machine ${machineId}) in ${[...deleted].join(", ")} — honouring the lower totals rather than holding the high-water mark (#112).`
        );
      }

      return deleted;
    } catch (error) {
      console.error("Corpus classification failed:", error);
      return new Set();
    }
  }

  private async mergeWithExisting(
    existing: DbSubmission,
    data: SubmitData,
    dateRangeStart: string,
    dateRangeEnd: string,
    modelsUsed: string[],
    tools: string[],
    machineId: string
  ): Promise<string> {
    // Totals below are recomputed from this map and written back to the parent
    // row, so a truncated read would silently shrink the user's totals. Page it.
    const existingDaily = await fetchAllPages<DbDailyBreakdown>(
      (from, to) =>
        this.client
          .from("daily_breakdowns")
          .select("*")
          .eq("submission_id", existing.id)
          .order("date", { ascending: true })
          .range(from, to),
      "existing daily breakdowns"
    );

    // Create a map of existing daily data
    const dailyMap = new Map<string, DbDailyBreakdown>();
    existingDaily.forEach((day) => dailyMap.set(day.date, day));

    // Fold each incoming day into the existing per-machine map. A day from a new
    // machine adds a slice (sums); a re-submit from the same machine replaces
    // only its own slice (no double-count). #43
    //
    // Build every row first, then write them in one request. This used to be a
    // round-trip per day, which put a multi-year history past the request
    // budget even though each individual write was fast (#93).
    // Which months the user actually cleared, as opposed to months the runtime
    // rewrote (#112). Only the first should be allowed to lower a stored
    // total; #111 held the high-water mark for both, which meant a deliberate
    // deletion left behind a figure the user meant to erase.
    const deletedMonths = await this.classifyCorpusDrift(data, machineId);

    // Days where a re-report came in lower than what we already had, i.e.
    // Claude Code rewrote its own transcript between runs (#83). Counted so
    // the submission response can tell the user rather than silently keeping
    // the higher number.
    const driftedDays: string[] = [];

    const dailyRows = data.ccData.daily.map((day) => {
      const prior = dailyMap.get(day.date);
      const { contributions, aggregate, retainedPrior } = mergeMachineContribution(
        prior?.machine_contributions ?? null,
        machineId,
        dailyEntryToContribution(day),
        // A day inside a month the user cleared takes the lower number — but
        // only if the corpus is evidence about that day. The scan covers
        // ~/.claude/projects alone, so a Codex or Gemini day in the same month
        // keeps its high-water mark regardless of what happened to Claude's
        // transcripts.
        deletedMonths.has(monthOfDate(day.date) ?? "") && corpusCoversDay(day.agents)
      );
      if (retainedPrior) driftedDays.push(day.date);

      const dailyData = {
        submission_id: existing.id,
        date: day.date,
        input_tokens: aggregate.inputTokens,
        output_tokens: aggregate.outputTokens,
        cache_creation_tokens: aggregate.cacheCreationTokens,
        cache_read_tokens: aggregate.cacheReadTokens,
        total_tokens: aggregate.totalTokens,
        total_cost: aggregate.totalCost,
        models_used: aggregate.modelsUsed,
        agents: aggregate.agents,
        model_breakdowns: aggregate.modelBreakdowns ?? null,
        machine_contributions: contributions,
      };

      dailyMap.set(day.date, dailyData as DbDailyBreakdown);
      return dailyData;
    });

    // Upserting on the UNIQUE(submission_id, date) constraint collapses the old
    // insert-or-update branch: the constraint decides, not a prior read.
    if (dailyRows.length > 0) {
      const { error: dailyUpsertError } = await this.client
        .from("daily_breakdowns")
        .upsert(dailyRows, { onConflict: "submission_id,date" });

      if (dailyUpsertError) {
        throw new Error(
          `Failed to update daily breakdowns: ${dailyUpsertError.message}`
        );
      }
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

    // Merge models and tools
    const allModels = Array.from(
      new Set([...(existing.models_used || []), ...modelsUsed])
    );
    const allTools = Array.from(
      new Set([...(existing.tools || []), ...tools])
    ).sort();

    // Update submission
    const { error: submissionUpdateError } = await this.client
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
        tools: allTools,
        submitted_at: new Date().toISOString(),
        verified: data.verified,
        source: data.source,
      })
      .eq("id", existing.id);

    if (submissionUpdateError) {
      throw new Error(
        `Failed to update existing submission: ${submissionUpdateError.message}`
      );
    }

    if (driftedDays.length > 0) {
      console.warn(
        `Usage drift for ${data.username}: ${driftedDays.length} day(s) re-reported lower than stored and kept at the earlier figure (#83).`,
        driftedDays.slice(0, 10)
      );
    }

    return existing.id;
  }

  private async createNewSubmission(
    data: SubmitData,
    dateRangeStart: string,
    dateRangeEnd: string,
    modelsUsed: string[],
    tools: string[],
    machineId: string
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
        tools: tools,
        submitted_at: new Date().toISOString(),
        verified: data.verified,
        source: data.source,
      })
      .select()
      .single();

    if (error || !submission) {
      throw new Error("Failed to create submission: " + error?.message);
    }

    // Insert daily breakdowns. Seed each day's per-machine map with this
    // machine's slice so a later submission from another machine sums (#43).
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
      agents: day.agents ?? [],
      model_breakdowns: day.modelBreakdowns ?? null,
      machine_contributions: { [machineId]: dailyEntryToContribution(day) },
    }));

    const { error: dailyError } = await this.client
      .from("daily_breakdowns")
      .insert(dailyRows);

    if (dailyError) {
      // Roll back the parent submission so we don't leave a half-written row.
      await this.client.from("submissions").delete().eq("id", submission.id);
      throw new Error("Failed to create daily breakdowns: " + dailyError.message);
    }

    return submission.id;
  }

  private async updateProfile(
    data: SubmitData,
    submissionId: string,
    isNewSubmission: boolean
  ): Promise<void> {
    const { data: existingProfile, error: profileQueryError } = await this.client
      .from("profiles")
      .select("*")
      .eq("username", data.username)
      .single();

    // PGRST116 is PostgREST's "no rows" for .single() — expected for a first
    // submission, so it falls through to the insert below. Anything else is a
    // real failure and must not be mistaken for "this profile doesn't exist".
    if (profileQueryError && profileQueryError.code !== "PGRST116") {
      throw new Error(`Failed to query profile: ${profileQueryError.message}`);
    }

    if (existingProfile) {
      const updates: Record<string, unknown> = {
        best_submission_id: submissionId,
        github_username: data.githubUsername,
        github_name: data.githubName,
        avatar: data.githubAvatar,
      };

      if (isNewSubmission) {
        updates.total_submissions = existingProfile.total_submissions + 1;
      }

      const { error: profileUpdateError } = await this.client
        .from("profiles")
        .update(updates)
        .eq("id", existingProfile.id);

      if (profileUpdateError) {
        throw new Error(`Failed to update profile: ${profileUpdateError.message}`);
      }
    } else {
      const { error: profileInsertError } = await this.client
        .from("profiles")
        .insert({
          username: data.username,
          github_username: data.githubUsername,
          github_name: data.githubName,
          avatar: data.githubAvatar,
          total_submissions: 1,
          best_submission_id: submissionId,
        });

      if (profileInsertError) {
        throw new Error(`Failed to create profile: ${profileInsertError.message}`);
      }
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
      // Efficiency is ranked on the stored tokens_per_dollar column (011) with
      // a spend floor. Without the floor the board is topped by rounding noise:
      // a $0.01 submission scored 7M tokens/$ against a median of 1.2M.
      .order(
        sortBy === "cost" ? "total_cost" : sortBy === "efficiency" ? "tokens_per_dollar" : "total_tokens",
        { ascending: false, nullsFirst: false }
      )
      .range(offset, offset + pageSize - 1);

    if (!includeFlagged) {
      query = query.or("flagged_for_review.is.null,flagged_for_review.eq.false");
    }

    // Filter to submissions that used a given tool (GIN-indexed array contains).
    if (params.tool) {
      query = query.contains("tools", [params.tool]);
    }

    if (params.verifiedOnly) {
      query = query.eq("verified", true);
    }

    // The spend floor is part of what the efficiency board *means*: below it
    // the ratio is rounding noise rather than a signal about how someone
    // works. Applied as a filter so the count and hasMore agree with the rows.
    if (sortBy === "efficiency") {
      query = query.gte("total_cost", EFFICIENCY_MIN_COST);
    }

    const { data: submissions, count, error } = await query;

    if (error) {
      throw new Error("Failed to fetch leaderboard: " + error.message);
    }

    // The list view only renders submission-level fields (cost, tokens, tools,
    // date range), so skip fetching daily_breakdowns entirely — that was
    // thousands of rows per page for data the UI never showed. Callers that
    // need daily data use getSubmission/getProfile/date-range queries.
    const items = (submissions || []).map((s) =>
      convertDbSubmissionToSubmission(s, [])
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

    // Date-range totals can't be derived from `submissions.total_cost` (which
    // covers a submission's full range, not the requested window) so we have
    // to aggregate `daily_breakdowns`. Push the range filter down to the DB:
    // only fetch submissions whose date_range overlaps the requested window.
    // A `.limit(5000)` here was silently served as 1000 by db-max-rows, so
    // submissions past the first thousand were never considered at all. Page it.
    const submissions = await fetchAllPages<DbSubmission>((from, to) => {
      let query = this.client
        .from("submissions")
        .select("*")
        .lte("date_range_start", params.dateTo)
        .gte("date_range_end", params.dateFrom);

      if (!includeFlagged) {
        query = query.or("flagged_for_review.is.null,flagged_for_review.eq.false");
      }

      if (params.tool) {
        query = query.contains("tools", [params.tool]);
      }

      if (params.verifiedOnly) {
        query = query.eq("verified", true);
      }

      return query.order("id", { ascending: true }).range(from, to);
    }, "submissions for date range");

    if (submissions.length === 0) {
      return { items: [], hasMore: false };
    }

    const submissionIds = submissions.map((s) => s.id);

    // The previous `.limit(50000)` was silently capped at `db-max-rows`, and
    // because the loop below skips any submission with zero rows in range, the
    // users past the cut vanished from the board rather than showing a partial
    // total. With no ORDER BY it was also arbitrary which ones survived.
    //
    // The id list also has to be chunked: past ~350 ids the `.in()` filter
    // builds a URL the server rejects, which failed the whole query and
    // emptied the board for any wide range.
    const allDailyBreakdowns = await fetchAllByIds<DbDailyBreakdown>(
      submissionIds,
      (chunk, from, to) =>
        this.client
          .from("daily_breakdowns")
          .select("*")
          .in("submission_id", chunk)
          .gte("date", params.dateFrom)
          .lte("date", params.dateTo)
          .order("submission_id", { ascending: true })
          .order("date", { ascending: true })
          .range(from, to),
      "daily breakdowns for date range"
    );

    const dailyBySubmission = new Map<string, DbDailyBreakdown[]>();
    allDailyBreakdowns.forEach((db) => {
      const existing = dailyBySubmission.get(db.submission_id) || [];
      existing.push(db);
      dailyBySubmission.set(db.submission_id, existing);
    });

    const processedItems: Submission[] = [];

    for (const submission of submissions) {
      const filteredDaily = dailyBySubmission.get(submission.id) || [];
      if (filteredDaily.length === 0) continue;

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
      processedItems.push({
        ...converted,
        ...totals,
      });
    }

    processedItems.sort((a, b) =>
      sortBy === "cost" ? b.totalCost - a.totalCost : b.totalTokens - a.totalTokens
    );

    const hasMore = processedItems.length > limit;

    return {
      items: processedItems.slice(0, limit),
      hasMore,
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

    // Up to 50 submissions here, but each can carry hundreds of daily rows, so
    // the total is well past the 1000-row response cap.
    const submissionIds = submissions.map((s) => s.id);
    const allDailyBreakdowns = await fetchAllByIds<DbDailyBreakdown>(
      submissionIds,
      (chunk, from, to) =>
        this.client
          .from("daily_breakdowns")
          .select("*")
          .in("submission_id", chunk)
          .order("submission_id", { ascending: true })
          .order("date", { ascending: true })
          .range(from, to),
      "daily breakdowns for flagged submissions"
    );

    const dailyBySubmission = new Map<string, DbDailyBreakdown[]>();
    allDailyBreakdowns.forEach((db) => {
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
      [...submissions].sort((a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )[0];

    // Get all daily breakdowns. The merged result is written back as the
    // surviving submission, so a capped read here would silently discard the
    // days it failed to see — data loss during a claim, not just a bad view.
    const submissionIds = submissions.map((s) => s.id);
    const allDailyBreakdowns = await fetchAllByIds<DbDailyBreakdown>(
      submissionIds,
      (chunk, from, to) =>
        this.client
          .from("daily_breakdowns")
          .select("*")
          .in("submission_id", chunk)
          .order("submission_id", { ascending: true })
          .order("date", { ascending: true })
          .range(from, to),
      "daily breakdowns for claim merge"
    );

    // Merge daily data (OAuth takes priority)
    const dailyMap = new Map<string, DbDailyBreakdown>();
    for (const submission of submissions) {
      const isOauth = submission.source === "oauth";
      const daily = allDailyBreakdowns.filter(
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
    // Union tools from the submission rows AND the merged daily agents, so
    // tools set by an earlier normalized submission survive a claim/merge even
    // when older daily_breakdowns rows have empty `agents`.
    const allTools = Array.from(
      new Set([
        ...submissions.flatMap((s) => s.tools || []),
        ...mergedDaily.flatMap((d) => d.agents || []),
      ])
    ).sort();

    // Update base submission
    const { error: updateError } = await this.client
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
        tools: allTools,
        submitted_at: new Date().toISOString(),
        verified: true,
        source: oauthSubmissions.length > 0 ? "oauth" : baseSubmission.source,
      })
      .eq("id", baseSubmission.id);

    if (updateError) {
      throw new Error("Failed to update merged submission: " + updateError.message);
    }

    // Replace daily breakdowns on the base submission with the merged set.
    const { error: deleteError } = await this.client
      .from("daily_breakdowns")
      .delete()
      .eq("submission_id", baseSubmission.id);

    if (deleteError) {
      throw new Error("Failed to clear daily breakdowns: " + deleteError.message);
    }

    const { error: insertError } = await this.client.from("daily_breakdowns").insert(
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
        agents: d.agents || [],
        model_breakdowns: d.model_breakdowns ?? null,
        machine_contributions: d.machine_contributions ?? null,
      }))
    );

    if (insertError) {
      throw new Error("Failed to insert merged daily breakdowns: " + insertError.message);
    }

    // Delete other submissions (cascade deletes their daily breakdowns).
    // Anything that referenced the deleted submissions via FK
    // (e.g. profiles.best_submission_id ON DELETE SET NULL) will be repaired
    // by the unconditional profile update below.
    for (const submission of submissions) {
      if (submission.id !== baseSubmission.id) {
        await this.client.from("submissions").delete().eq("id", submission.id);
      }
    }

    // Recompute total_submissions from the source of truth (a count of rows
    // post-delete), and always repoint best_submission_id at the surviving
    // base — even if no rows were deleted, this self-heals stale FK state.
    const { data: profile } = await this.client
      .from("profiles")
      .select("id")
      .eq("github_username", githubUsername)
      .single();

    if (profile) {
      const { count: liveCount } = await this.client
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("github_username", githubUsername);

      await this.client
        .from("profiles")
        .update({
          total_submissions: Math.max(1, liveCount ?? 1),
          best_submission_id: baseSubmission.id,
        })
        .eq("id", profile.id);
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

  async getGlobalRank(totalCost: number): Promise<number> {
    // Rank = how many unflagged submissions beat this cost, plus one. Uses a
    // head-only count so no rows are transferred.
    const { count, error } = await this.client
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .gt("total_cost", totalCost)
      .or("flagged_for_review.is.null,flagged_for_review.eq.false");

    if (error) {
      throw new Error("Failed to compute rank: " + error.message);
    }
    return (count ?? 0) + 1;
  }
}

// ============================================================================
// SUPABASE PROFILES SERVICE
// ============================================================================

export class SupabaseProfilesService implements ProfilesService {
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

    // A heavy user's few submissions can still hold thousands of daily rows,
    // so an uncapped read here truncated the profile's own history.
    const submissionIds = (submissions || []).map((s) => s.id);
    const allDailyBreakdowns = await fetchAllByIds<DbDailyBreakdown>(
      submissionIds,
      (chunk, from, to) =>
        this.client
          .from("daily_breakdowns")
          .select("*")
          .in("submission_id", chunk)
          .order("submission_id", { ascending: true })
          .order("date", { ascending: true })
          .range(from, to),
      "daily breakdowns for profile"
    );

    const dailyBySubmission = new Map<string, DbDailyBreakdown[]>();
    allDailyBreakdowns.forEach((db) => {
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
      openToWork: profile.open_to_work || false,
      openToWorkEmail: profile.open_to_work_email || undefined,
      createdAt: new Date(profile.created_at).getTime(),
      submissions: (submissions || []).map((s) =>
        convertDbSubmissionToSubmission(s, dailyBySubmission.get(s.id) || [])
      ),
    };
  }

  async setOpenToWork(
    githubUsername: string,
    open: boolean,
    workEmail?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await this.client
      .from("profiles")
      .update({
        open_to_work: open,
        open_to_work_email: open ? workEmail ?? null : null,
      })
      .ilike("github_username", githubUsername)
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "No profile found — submit your stats first." };
    }
    return { success: true };
  }

  async getHireListings(): Promise<HireListing[]> {
    const { data: profiles } = await this.client
      .from("profiles")
      .select("*")
      .eq("open_to_work", true);

    if (!profiles || profiles.length === 0) return [];

    // Best submission per opted-in profile, plus the full cost ladder so we
    // can attach the same global rank the leaderboard would show.
    const usernames = profiles.map((p) => p.username);
    const [{ data: subs }, { data: ladder }] = await Promise.all([
      this.client.from("submissions").select("*").in("username", usernames),
      this.client
        .from("submissions")
        .select("total_cost")
        .order("total_cost", { ascending: false }),
    ]);

    const costs = (ladder || []).map((r) => Number(r.total_cost));
    const bestByUser = new Map<string, DbSubmission>();
    (subs || []).forEach((s) => {
      const cur = bestByUser.get(s.username);
      if (!cur || Number(s.total_cost) > Number(cur.total_cost)) bestByUser.set(s.username, s);
    });

    return profiles
      .filter((p) => p.github_username && bestByUser.has(p.username))
      .map((p) => {
        const best = bestByUser.get(p.username)!;
        const bestCost = Number(best.total_cost);
        return {
          username: p.username,
          githubUsername: p.github_username!,
          githubName: p.github_name || best.github_name || undefined,
          avatar: p.avatar || best.github_avatar || undefined,
          bestCost,
          totalTokens: Number(best.total_tokens),
          tools: best.tools && best.tools.length > 0 ? best.tools : ["claude"],
          rank: costs.length > 0 ? costs.filter((c) => c > bestCost).length + 1 : null,
          verified: best.verified,
          workEmail: p.open_to_work_email || undefined,
        };
      })
      .sort((a, b) => b.bestCost - a.bestCost);
  }

  async deleteByPattern(
    patterns: string[],
    options: PatternSearchOptions & { dryRun?: boolean }
  ): Promise<DeleteResult> {
    const { searchField = "githubUsername", caseSensitive = false, dryRun = false } = options;

    // Matching happens in memory, so a capped read would silently narrow the
    // match set — a delete that quietly skips accounts is worse than one that
    // errors. Page the scan.
    const allProfiles = await fetchAllPages<DbProfile>(
      (from, to) =>
        this.client
          .from("profiles")
          .select("*")
          .order("id", { ascending: true })
          .range(from, to),
      "profiles for delete"
    );

    const matchingProfiles = allProfiles.filter((profile) => {
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

    // Removing a profile alone does not remove the user from the site. The
    // leaderboard reads `submissions`, and `raw_submissions` archives the
    // original payload with no FK to either table — so a profile-only delete
    // leaves the entry ranked and the raw data stored. Collect every row that
    // belongs to these accounts, then delete children before parents.
    const usernames = matchingProfiles.map((p) => p.username);

    const ownedSubmissions = usernames.length
      ? await fetchAllPages<DbSubmission>(
          (from, to) =>
            this.client
              .from("submissions")
              .select("*")
              .in("username", usernames)
              .order("id", { ascending: true })
              .range(from, to),
          "submissions for delete"
        )
      : [];
    const submissionIds = ownedSubmissions.map((s) => s.id);

    const ownedDaily = submissionIds.length
      ? await fetchAllPages<DbDailyBreakdown>(
          (from, to) =>
            this.client
              .from("daily_breakdowns")
              .select("*")
              .in("submission_id", submissionIds)
              .order("id", { ascending: true })
              .range(from, to),
          "daily breakdowns for delete"
        )
      : [];

    const ownedRaw = usernames.length
      ? await fetchAllPages<{ id: string }>(
          (from, to) =>
            this.client
              .from("raw_submissions")
              .select("id")
              .in("username", usernames)
              .order("id", { ascending: true })
              .range(from, to),
          "raw submissions for delete"
        )
      : [];

    const deletedRows = {
      profiles: 0,
      submissions: 0,
      dailyBreakdowns: 0,
      rawSubmissions: 0,
    };

    if (!dryRun) {
      if (submissionIds.length > 0) {
        // daily_breakdowns is ON DELETE CASCADE, but delete it explicitly so a
        // failure surfaces here rather than being assumed.
        const { error: dailyError } = await this.client
          .from("daily_breakdowns")
          .delete()
          .in("submission_id", submissionIds);
        if (dailyError) {
          throw new Error(`Failed to delete daily breakdowns: ${dailyError.message}`);
        }
        deletedRows.dailyBreakdowns = ownedDaily.length;

        const { error: submissionError } = await this.client
          .from("submissions")
          .delete()
          .in("id", submissionIds);
        if (submissionError) {
          throw new Error(`Failed to delete submissions: ${submissionError.message}`);
        }
        deletedRows.submissions = submissionIds.length;
      }

      if (ownedRaw.length > 0) {
        const { error: rawError } = await this.client
          .from("raw_submissions")
          .delete()
          .in("id", ownedRaw.map((r) => r.id));
        if (rawError) {
          throw new Error(`Failed to delete raw submissions: ${rawError.message}`);
        }
        deletedRows.rawSubmissions = ownedRaw.length;
      }

      for (const profile of matchingProfiles) {
        const { error: profileError } = await this.client
          .from("profiles")
          .delete()
          .eq("id", profile.id);
        if (profileError) {
          throw new Error(`Failed to delete profile: ${profileError.message}`);
        }
        deletedRows.profiles++;
      }
    }

    const wouldDelete = {
      profiles: matchingProfiles.length,
      submissions: submissionIds.length,
      dailyBreakdowns: ownedDaily.length,
      rawSubmissions: ownedRaw.length,
    };
    const summary = (counts: typeof wouldDelete) =>
      `${counts.profiles} profiles, ${counts.submissions} submissions, ` +
      `${counts.dailyBreakdowns} daily rows, ${counts.rawSubmissions} archived payloads`;

    return {
      message: dryRun
        ? `Dry run: would delete ${summary(wouldDelete)}`
        : `Deleted ${summary(deletedRows)}`,
      matchedCount: matchingProfiles.length,
      deletedCount: dryRun ? 0 : deletedRows.profiles,
      dryRun,
      patterns,
      searchField,
      profiles: matchingProfiles.map((p) => ({
        id: p.id,
        githubUsername: p.github_username || undefined,
        username: p.username,
        createdAt: new Date(p.created_at).getTime(),
      })),
      deletedRows: dryRun ? { profiles: 0, submissions: 0, dailyBreakdowns: 0, rawSubmissions: 0 } : deletedRows,
    };
  }

  async findByPattern(
    patterns: string[],
    options: PatternSearchOptions
  ): Promise<FindProfilesResult> {
    const { searchField = "githubUsername", caseSensitive = false } = options;

    // This is the preview for deleteByPattern. It must page for the same
    // reason the delete does — a capped preview would show fewer accounts
    // than the delete goes on to remove.
    const allProfiles = await fetchAllPages<DbProfile>(
      (from, to) =>
        this.client
          .from("profiles")
          .select("*")
          .order("id", { ascending: true })
          .range(from, to),
      "profiles for search"
    );

    const matchingProfiles = allProfiles.filter((profile) => {
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

export class SupabaseStatsService implements StatsService {
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

    // Get daily breakdown counts for totalDays.
    //
    // This asked for 500 ids in one `.in()`, which exceeds what the server
    // will accept in a URL — the request failed, the null was read as "no
    // rows", and every submission contributed 0 days. The site reported
    // totalDays: 0 while every other stat looked right.
    const submissionIds = (topByCost || []).map((s) => s.id);
    const dailyCounts = await fetchAllByIds<{ submission_id: string }>(
      submissionIds,
      (chunk, from, to) =>
        this.client
          .from("daily_breakdowns")
          .select("submission_id")
          .in("submission_id", chunk)
          .order("submission_id", { ascending: true })
          .range(from, to),
      "daily counts for global stats"
    );

    const daysPerSubmission = new Map<string, number>();
    dailyCounts.forEach((d) => {
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

      // Count submissions per tool (claude, codex, gemini, …). Prefer the
      // stored `tools`; fall back to classifying models for legacy rows.
      const submissionTools =
        submission.tools && submission.tools.length > 0
          ? submission.tools
          : Array.from(
              new Set((submission.models_used || []).map(inferToolFromModel))
            );
      submissionTools.forEach((tool: string) => {
        modelUsage[tool] = (modelUsage[tool] || 0) + 1;
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

  async getSiteStats(): Promise<SiteStats | null> {
    // Exact aggregates computed in-database (migration 007). Returns null when
    // the function isn't deployed yet so callers can fall back to the
    // approximate getGlobalStats().
    const { data, error } = await this.client.rpc("get_site_stats");
    if (error || !data) {
      if (error) console.error("get_site_stats failed:", error.message);
      return null;
    }
    return data as SiteStats;
  }

  async getSpendRows(): Promise<BurnRow[]> {
    // Only the four columns the spend curve needs, paged. The whole table is
    // ~1k rows and /calculator is ISR-cached hourly, so this is cheaper than
    // the aggregates /stats already runs — no RPC or migration required.
    const rows = await fetchAllPages<{
      username: string;
      total_cost: number;
      date_range_start: string;
      date_range_end: string;
    }>(
      (from, to) =>
        this.client
          .from("submissions")
          .select("username,total_cost,date_range_start,date_range_end")
          .or("flagged_for_review.is.null,flagged_for_review.eq.false")
          .order("id", { ascending: true })
          .range(from, to),
      "submissions for spend curve"
    );

    return rows.map((r) => ({
      username: r.username,
      totalCost: Number(r.total_cost),
      start: r.date_range_start,
      end: r.date_range_end,
    }));
  }
}

// ============================================================================
// DATA LAYER FACTORY
// ============================================================================


// ============================================================================
// SUPABASE TOKENS SERVICE
// ============================================================================

/**
 * The table is missing because the migration hasn't been applied yet.
 *
 * Two codes, because two layers can notice: PostgREST answers PGRST205 when
 * the table isn't in its schema cache, and Postgres answers 42P01 if a query
 * does reach it. Checking only the Postgres code was not enough — verified
 * against the live project, which returns PGRST205 — and missing it would
 * have turned every submission into a 500 the moment this deployed ahead of
 * the migration.
 */
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"]);

export class SupabaseTokensService implements TokensService {
  constructor(private client: SupabaseClient) {}

  async issue(username: string, githubUsername: string, label: string) {
    const { plaintext, hash, hint } = generateToken();

    const { data, error } = await this.client
      .from("api_tokens")
      .insert({
        username,
        github_username: githubUsername,
        token_hash: hash,
        label: label.slice(0, 60) || "CLI",
        hint,
      })
      .select("id, label, hint, created_at, last_used_at")
      .single();

    if (error) throw new Error(`Failed to issue token: ${error.message}`);

    return {
      // The only time the plaintext exists outside the caller's terminal.
      plaintext,
      token: {
        id: data.id,
        label: data.label,
        hint: data.hint,
        createdAt: new Date(data.created_at).getTime(),
        lastUsedAt: data.last_used_at ? new Date(data.last_used_at).getTime() : null,
      },
    };
  }

  async list(username: string): Promise<ApiTokenSummary[]> {
    const { data, error } = await this.client
      .from("api_tokens")
      .select("id, label, hint, created_at, last_used_at")
      .ilike("username", username)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      if (MISSING_TABLE_CODES.has(error.code)) return [];
      throw new Error(`Failed to list tokens: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      hint: row.hint,
      createdAt: new Date(row.created_at).getTime(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).getTime() : null,
    }));
  }

  async revoke(username: string, id: string): Promise<boolean> {
    // Scoped by username as well as id so one user cannot revoke another's
    // token by guessing a uuid.
    const { data, error } = await this.client
      .from("api_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .ilike("username", username)
      .is("revoked_at", null)
      .select("id");

    if (error) throw new Error(`Failed to revoke token: ${error.message}`);
    return (data ?? []).length > 0;
  }

  async resolve(plaintext: string): Promise<TokenOwner | null> {
    if (!looksLikeToken(plaintext)) return null;

    const { data, error } = await this.client
      .from("api_tokens")
      .select("id, username, github_username, revoked_at")
      .eq("token_hash", hashToken(plaintext))
      .limit(1);

    if (error) {
      // Deploying the code before applying the migration must not break
      // submissions — degrade to "no token auth" rather than 500.
      if (MISSING_TABLE_CODES.has(error.code)) return null;
      console.error("Token lookup failed:", error.message);
      return null;
    }

    const row = (data ?? [])[0];
    if (!row || row.revoked_at) return null;

    // Best effort: a failed touch must not fail the submission it authorised.
    void this.client
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(undefined, () => undefined);

    return { username: row.username, githubUsername: row.github_username };
  }
}

class SupabaseDataLayer implements DataLayer {
  tokens: TokensService;
  submissions: SubmissionsService;
  profiles: ProfilesService;
  stats: StatsService;

  constructor(client: SupabaseClient) {
    this.tokens = new SupabaseTokensService(client);
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
