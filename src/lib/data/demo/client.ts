import { efficiencyScore } from "@/lib/efficiency";
import {
  createWeeklyService,
  type WeeklyDataService,
  type UserDay,
  type UserHistory,
  type WeeklySource,
  type WindowEntry,
  type WindowQuery,
} from "@/lib/v2/service";
import { addDays, isoDate, weekIdOf, weekStart } from "@/lib/v2/week";
import type {
  ClaimResult,
  ClaimStatus,
  DataLayer,
  DateRangeLeaderboardParams,
  DateRangeLeaderboardResult,
  DeleteResult,
  FindProfilesResult,
  GlobalStats,
  SiteStats,
  MonthStats,
  UserMonthStats,
  HireListing,
  LeaderboardParams,
  LeaderboardResult,
  PatternSearchOptions,
  ProfileSummary,
  ProfileWithSubmissions,
  Submission,
} from "../types";
import { sparkSeries } from "@/lib/profile-summary";

const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 4, 6);

const betterModels = [
  "claude-opus-4",
  "claude-sonnet-4",
  "claude-3.7-sonnet",
  "gpt-5-codex",
  "gpt-4.1",
  "gpt-4.1-mini",
  "o4-mini",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "grok-code-fast",
  "qwen3-coder",
  "deepseek-v3",
  "kimi-k2",
  "codestral-latest",
  "devstral-small",
  "openrouter/auto",
  "copilot-gpt-4o",
  "local-llama-coder",
];

function isoDay(offset: number): string {
  return new Date(START + offset * DAY_MS).toISOString().slice(0, 10);
}

function makeDaily(totalCost: number, days: number, models: string[], agents: string[]) {
  const weights = Array.from({ length: days }, (_, index) => {
    if (index === 27) return 4.8;
    if (index % 9 === 0) return 2.2;
    if (index % 6 === 0) return 0.15;
    return 0.8 + (index % 5) * 0.18;
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);

  return weights.map((weight, index) => {
    const cost = Number(((totalCost * weight) / weightTotal).toFixed(2));
    const totalTokens = Math.round(cost * 1_300_000);
    const inputTokens = Math.round(totalTokens * 0.24);
    const outputTokens = Math.round(totalTokens * 0.2);
    const cacheCreationTokens = Math.round(totalTokens * 0.06);
    const cacheReadTokens = totalTokens - inputTokens - outputTokens - cacheCreationTokens;
    const dayModels = models.slice(index % Math.max(1, models.length - 3), index % Math.max(1, models.length - 3) + 3);

    return {
      date: isoDay(index),
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      totalCost: cost,
      modelsUsed: dayModels.length > 0 ? dayModels : models.slice(0, 3),
      agents,
      modelBreakdowns: (dayModels.length > 0 ? dayModels : models.slice(0, 3)).map((modelName, modelIndex) => ({
        modelName,
        inputTokens: Math.round(inputTokens / 3),
        outputTokens: Math.round(outputTokens / 3),
        cacheCreationTokens: Math.round(cacheCreationTokens / 3),
        cacheReadTokens: Math.round(cacheReadTokens / 3),
        cost: Number((cost / 3 + modelIndex * 0.01).toFixed(2)),
      })),
    };
  });
}

function makeSubmission(data: {
  id: string;
  username: string;
  githubName?: string;
  avatarSeed: string;
  totalCost: number;
  totalTokens: number;
  models: string[];
  tools: string[];
  verified?: boolean;
  source?: "cli" | "oauth";
  days?: number;
}): Submission {
  const dailyBreakdown = makeDaily(data.totalCost, data.days ?? 36, data.models, data.tools);
  const inputTokens = Math.round(data.totalTokens * 0.22);
  const outputTokens = Math.round(data.totalTokens * 0.18);
  const cacheCreationTokens = Math.round(data.totalTokens * 0.05);
  const cacheReadTokens = data.totalTokens - inputTokens - outputTokens - cacheCreationTokens;

  return {
    id: data.id,
    username: data.username,
    githubUsername: data.username,
    githubName: data.githubName,
    githubAvatar: `https://avatars.githubusercontent.com/${data.avatarSeed}`,
    totalTokens: data.totalTokens,
    totalCost: data.totalCost,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    dateRange: {
      start: dailyBreakdown[0]?.date ?? isoDay(0),
      end: dailyBreakdown[dailyBreakdown.length - 1]?.date ?? isoDay(0),
    },
    modelsUsed: data.models,
    tools: data.tools,
    dailyBreakdown,
    submittedAt: Date.UTC(2026, 5, 17, 12, 0, 0),
    verified: data.verified ?? true,
    source: data.source ?? "oauth",
  };
}

const submissions: Submission[] = [
  makeSubmission({
    id: "demo-iabdulwasey",
    username: "iabdulwasey",
    githubName: "I Abdul Wasey",
    avatarSeed: "iabdulwasey",
    totalCost: 74134.12,
    totalTokens: 85_000_000_000,
    models: ["claude-opus-4", "claude-sonnet-4", "gemini-2.5-pro", "gpt-5-codex"],
    tools: ["claude", "codex"],
  }),
  makeSubmission({
    id: "demo-betterdigital",
    username: "B-EtterDigital",
    githubName: "Cyrill Etter - B-etter.Digital DEV 1",
    avatarSeed: "B-EtterDigital",
    totalCost: 56702.8,
    totalTokens: 73_600_000_000,
    models: betterModels,
    tools: ["claude", "codex", "gemini", "opencode"],
  }),
  makeSubmission({
    id: "demo-azam",
    username: "azamara",
    githubName: "Azamara",
    avatarSeed: "azamara",
    totalCost: 56694.03,
    totalTokens: 81_300_000_000,
    models: ["claude-sonnet-4", "gpt-4.1", "gemini-2.5-pro"],
    tools: ["claude", "codex", "gemini"],
  }),
  makeSubmission({
    id: "demo-token-leader",
    username: "tokenmaxed",
    githubName: "Token Maxed",
    avatarSeed: "github",
    totalCost: 43231.15,
    totalTokens: 96_800_000_000,
    models: ["gemini-2.5-flash", "gpt-4.1-mini", "claude-haiku"],
    tools: ["gemini", "codex"],
  }),
  makeSubmission({
    id: "demo-startupbros",
    username: "StartupBros",
    totalCost: 54960.08,
    totalTokens: 66_400_000_000,
    avatarSeed: "StartupBros",
    models: ["claude-opus-4", "claude-sonnet-4"],
    tools: ["claude"],
  }),
  makeSubmission({
    id: "demo-devzerops",
    username: "devzerops",
    totalCost: 51291.08,
    totalTokens: 23_900_000_000,
    avatarSeed: "devzerops",
    models: ["gpt-5-codex", "gpt-4.1"],
    tools: ["codex"],
    verified: false,
    source: "cli",
  }),
  makeSubmission({
    id: "demo-dprvda",
    username: "dprvda",
    totalCost: 46069.24,
    totalTokens: 63_000_000_000,
    avatarSeed: "dprvda",
    models: ["opencode/sonnet", "claude-sonnet-4"],
    tools: ["opencode", "claude"],
  }),
  makeSubmission({
    id: "demo-sigrid",
    username: "sigridjineth",
    totalCost: 43231.15,
    totalTokens: 13_800_000_000,
    avatarSeed: "sigridjineth",
    models: ["claude-sonnet-4", "codestral-latest"],
    tools: ["claude", "opencode"],
  }),
  makeSubmission({
    id: "demo-better-cli",
    username: "B-etter.Digital",
    totalCost: 29742.8,
    totalTokens: 45_300_000_000,
    avatarSeed: "B-EtterDigital",
    models: ["claude-sonnet-4", "gpt-4.1", "gemini-2.5-pro"],
    tools: ["claude", "codex", "gemini"],
    verified: false,
    source: "cli",
  }),
  makeSubmission({
    id: "demo-sahir",
    username: "sahir2k",
    totalCost: 26000,
    totalTokens: 17_300_000_000,
    avatarSeed: "sahir2k",
    models: ["claude-sonnet-4"],
    tools: ["claude"],
  }),
  makeSubmission({
    id: "demo-trac",
    username: "trac3rOO",
    totalCost: 25267.44,
    totalTokens: 26_000_000_000,
    avatarSeed: "trac3rOO",
    models: ["gpt-5-codex", "o4-mini"],
    tools: ["codex"],
  }),
  makeSubmission({
    id: "demo-nikshep",
    username: "nikshepsvn",
    totalCost: 21997.12,
    totalTokens: 15_300_000_000,
    avatarSeed: "nikshepsvn",
    models: ["claude-sonnet-4", "gemini-2.5-pro"],
    tools: ["claude", "gemini"],
  }),
];

const openToWork = new Set(["B-EtterDigital", "azamara", "dprvda"]);

function sortSubmissions(
  items: Submission[],
  sortBy: "cost" | "tokens" | "efficiency" = "cost"
) {
  if (sortBy === "efficiency") {
    // Mirrors the real backend: spend floor first, then the volume-weighted score.
    return items
      .filter((item) => item.totalCost >= 100)
      .sort((a, b) => (efficiencyScore(b.totalTokens, b.totalCost) ?? 0) - (efficiencyScore(a.totalTokens, a.totalCost) ?? 0));
  }
  return [...items].sort((a, b) =>
    sortBy === "tokens" ? b.totalTokens - a.totalTokens : b.totalCost - a.totalCost
  );
}

function filterSubmissions(items: Submission[], params: Pick<LeaderboardParams, "tool" | "verifiedOnly" | "includeFlagged">) {
  return items.filter((item) => {
    if (!params.includeFlagged && item.flaggedForReview) return false;
    if (params.verifiedOnly && !item.verified) return false;
    if (params.tool && !(item.tools ?? []).includes(params.tool)) return false;
    return true;
  });
}

function findSubmission(username: string) {
  const normalized = username.toLowerCase();
  return submissions.find(
    (submission) =>
      submission.username.toLowerCase() === normalized ||
      submission.githubUsername?.toLowerCase() === normalized
  );
}

function aggregateDaily(submission: Submission, params: DateRangeLeaderboardParams): Submission | null {
  const dailyBreakdown = submission.dailyBreakdown.filter(
    (day) => day.date >= params.dateFrom && day.date <= params.dateTo
  );
  if (dailyBreakdown.length === 0) return null;

  const totalTokens = dailyBreakdown.reduce((sum, day) => sum + day.totalTokens, 0);
  const totalCost = dailyBreakdown.reduce((sum, day) => sum + day.totalCost, 0);

  return {
    ...submission,
    totalTokens,
    totalCost,
    inputTokens: dailyBreakdown.reduce((sum, day) => sum + day.inputTokens, 0),
    outputTokens: dailyBreakdown.reduce((sum, day) => sum + day.outputTokens, 0),
    cacheCreationTokens: dailyBreakdown.reduce((sum, day) => sum + day.cacheCreationTokens, 0),
    cacheReadTokens: dailyBreakdown.reduce((sum, day) => sum + day.cacheReadTokens, 0),
    dailyBreakdown,
    dateRange: {
      start: dailyBreakdown[0].date,
      end: dailyBreakdown[dailyBreakdown.length - 1].date,
    },
  };
}

function profileFromSubmission(submission: Submission): ProfileWithSubmissions {
  return {
    id: `profile-${submission.id}`,
    username: submission.username,
    githubUsername: submission.githubUsername,
    githubName: submission.githubName,
    avatar: submission.githubAvatar,
    totalSubmissions: 1,
    bestSubmission: submission.id,
    openToWork: openToWork.has(submission.username),
    createdAt: submission.submittedAt,
    submissions: [submission],
  };
}

export function createDemoDataLayer(): DataLayer {
  return {
    // The demo backend is read-only and has no accounts, so it mints nothing
    // and authenticates nobody.
    tokens: {
      async issue(): Promise<never> {
        throw new Error("Demo data is read-only");
      },
      async list() {
        return [];
      },
      async revoke() {
        return false;
      },
      async resolve() {
        return null;
      },
    },
    submissions: {
      async deleteOwn(): Promise<boolean> {
        // Demo data is read-only.
        return false;
      },
      async submit(): Promise<string> {
        throw new Error("Demo data is read-only");
      },
      async getLeaderboard(params: LeaderboardParams): Promise<LeaderboardResult> {
        const page = params.page ?? 0;
        const pageSize = Math.min(params.pageSize ?? 25, 50);
        const filtered = filterSubmissions(submissions, params);
        const sorted = sortSubmissions(filtered, params.sortBy);
        const offset = page * pageSize;

        return {
          items: sorted.slice(offset, offset + pageSize),
          page,
          pageSize,
          hasMore: offset + pageSize < sorted.length,
          totalPages: Math.ceil(sorted.length / pageSize),
        };
      },
      async getLeaderboardByDateRange(params: DateRangeLeaderboardParams): Promise<DateRangeLeaderboardResult> {
        const filtered = filterSubmissions(submissions, params)
          .map((submission) => aggregateDaily(submission, params))
          .filter((submission): submission is Submission => Boolean(submission));
        const sorted = sortSubmissions(filtered, params.sortBy);
        const limit = params.limit ?? 50;

        return {
          items: sorted.slice(0, limit),
          hasMore: sorted.length > limit,
        };
      },
      async getSubmission(id: string): Promise<Submission | null> {
        return submissions.find((submission) => submission.id === id) ?? null;
      },
      async getFlaggedSubmissions(): Promise<Submission[]> {
        return submissions.filter((submission) => submission.flaggedForReview);
      },
      async clearReview(): Promise<{ success: boolean }> {
        return { success: true };
      },
      async updateFlagStatus(): Promise<{ success: boolean }> {
        return { success: false };
      },
      async claimAndMergeSubmissions(githubUsername: string): Promise<ClaimResult> {
        const submission = findSubmission(githubUsername);
        if (!submission) throw new Error("No submissions found");
        return {
          success: true,
          action: submission.verified ? "already_verified" : "claimed",
          submissionId: submission.id,
          mergedCount: 1,
        };
      },
      async checkClaimableSubmissions(githubUsername: string): Promise<ClaimStatus> {
        const submission = findSubmission(githubUsername);
        return {
          actionNeeded: submission && !submission.verified ? "claim" : null,
          actionText: submission && !submission.verified ? "Verify your submission" : "",
          cliCount: submission?.source === "cli" ? 1 : 0,
          oauthCount: submission?.source === "oauth" ? 1 : 0,
          totalSubmissions: submission ? 1 : 0,
          unverifiedCount: submission && !submission.verified ? 1 : 0,
        };
      },
      async getGlobalRank(totalCost: number): Promise<number> {
        return submissions.filter((submission) => !submission.flaggedForReview && submission.totalCost > totalCost).length + 1;
      },
    },
    profiles: {
      async getProfile(username: string): Promise<ProfileWithSubmissions | null> {
        const submission = findSubmission(username);
        return submission ? profileFromSubmission(submission) : null;
      },
      async getProfileSummary(username: string): Promise<ProfileSummary | null> {
        const submission = findSubmission(username);
        if (!submission) return null;
        const profile = profileFromSubmission(submission);
        const days = (submission.dailyBreakdown ?? []).map((day) => ({ date: day.date, cost: day.totalCost }));
        return {
          username: profile.username,
          githubUsername: profile.githubUsername,
          githubName: profile.githubName,
          avatar: profile.avatar,
          totalCost: submission.totalCost,
          totalTokens: submission.totalTokens,
          daysActive: new Set(days.map((day) => day.date)).size,
          bestCost: submission.totalCost,
          tools: [...(submission.tools ?? [])].sort(),
          spark: sparkSeries(days),
        };
      },
      async setOpenToWork(): Promise<{ success: boolean; error?: string }> {
        return { success: false, error: "Demo data is read-only" };
      },
      async recordSignInEmail(): Promise<{ success: boolean; error?: string }> {
        return { success: false, error: "Demo data is read-only" };
      },
      async getHireListings(): Promise<HireListing[]> {
        const ranked = sortSubmissions(submissions, "cost");
        return ranked
          .filter((submission) => openToWork.has(submission.username))
          .map((submission) => ({
            username: submission.username,
            githubUsername: submission.githubUsername ?? submission.username,
            githubName: submission.githubName,
            avatar: submission.githubAvatar,
            bestCost: submission.totalCost,
            totalTokens: submission.totalTokens,
            tools: submission.tools ?? [],
            rank: ranked.findIndex((rankedSubmission) => rankedSubmission.id === submission.id) + 1,
            verified: submission.verified,
          }));
      },
      async deleteByPattern(
        patterns: string[],
        options: PatternSearchOptions & { dryRun?: boolean }
      ): Promise<DeleteResult> {
        return {
          message: "Demo data is read-only",
          matchedCount: 0,
          deletedCount: 0,
          dryRun: options.dryRun ?? true,
          patterns,
          searchField: options.searchField ?? "both",
          profiles: [],
          deletedRows: { profiles: 0, submissions: 0, dailyBreakdowns: 0, rawSubmissions: 0 },
        };
      },
      async findByPattern(patterns: string[], options: PatternSearchOptions): Promise<FindProfilesResult> {
        return {
          count: 0,
          patterns,
          searchField: options.searchField ?? "both",
          profiles: [],
        };
      },
    },
    leagues: {
      async create(): Promise<never> {
        throw new Error("Leagues need the live backend.");
      },
      async previewByCode() {
        return null;
      },
      async joinByCode(): Promise<never> {
        throw new Error("Leagues need the live backend.");
      },
      // One read-only league so the league page can be seen without the live
      // backend: known demo handles plus one member who never synced.
      async getBySlug(slug: string) {
        if (slug !== DEMO_LEAGUE_SLUG) return null;
        const members = [...DEMO_KNOWN_HANDLES.slice(0, 7), "not-synced-yet"].map((username) => {
          const submission = findSubmission(username);
          return {
            username,
            joinedAt: "2026-10-01T00:00:00Z",
            totalCost: submission?.totalCost ?? 0,
            totalTokens: submission?.totalTokens ?? 0,
            verified: Boolean(submission?.verified),
          };
        });
        members.sort((a, b) => b.totalCost - a.totalCost);
        return {
          league: { id: "demo", slug: DEMO_LEAGUE_SLUG, name: "Demo Team", createdBy: DEMO_KNOWN_HANDLES[0], createdAt: "2026-10-01T00:00:00Z" },
          members,
        };
      },
      async getInviteCode() {
        return null;
      },
      async listForUser() {
        return [];
      },
    },
    stats: {
      async getWorkInsightBaselines() {
        return { values: { cacheHitRate: [], cacheReuse: [], costPerMillionTokens: [], outputShare: [] }, byUser: {} };
      },
      // The demo backend has no site-wide rollup table; returning null is the
      // documented "not available" signal and callers already handle it.
      async getSiteStats(): Promise<SiteStats | null> {
        return null;
      },
      // Same "not available" signal as getSiteStats — demo has no daily rollup.
      async getMonthStats(): Promise<MonthStats | null> {
        return null;
      },
      async getUserMonthStats(): Promise<UserMonthStats | null> {
        return null;
      },
      // The demo backend has no cohort to rank against; an empty list makes
      // /calculator render its no-cohort state rather than invent a curve.
      async getSpendRows() {
        return [];
      },
      async getGlobalStats(): Promise<GlobalStats> {
        const ranked = sortSubmissions(submissions, "cost");
        const totalCost = submissions.reduce((sum, submission) => sum + submission.totalCost, 0);
        const totalTokens = submissions.reduce((sum, submission) => sum + submission.totalTokens, 0);
        const modelUsage = submissions.reduce<Record<string, number>>((usage, submission) => {
          for (const tool of submission.tools ?? []) usage[tool] = (usage[tool] ?? 0) + 1;
          return usage;
        }, {});

        return {
          totalUsers: submissions.length,
          totalSubmissions: submissions.length,
          totalCost,
          totalTokens,
          avgCostPerUser: totalCost / submissions.length,
          topCost: ranked[0]?.totalCost ?? 0,
          topUser: ranked[0]?.username ?? "N/A",
          modelUsage,
          totalDays: new Set(submissions.flatMap((submission) => submission.dailyBreakdown.map((day) => day.date))).size,
          avgTokensPerUser: totalTokens / submissions.length,
          isApproximate: false,
        };
      },
    },
    weekly: createDemoWeeklyService(),
  };
}

// ============================================================================
// v2 WEEKLY DEMO DATA
// ============================================================================
// A deterministic population of ~170 developers with daily usage for the last
// twenty weeks plus this week up to today, so the weekly board renders with
// realistic Ranked / Open / Fleets splits, movement and streaks. The same
// WeeklyService the Supabase backend uses runs over it (src/lib/v2/service.ts).

const DEMO_HISTORY_WEEKS = 20;
const DEMO_POPULATION = 170;

const DEMO_LEAGUE_SLUG = "demo-team";
const DEMO_KNOWN_HANDLES = [
  "nikshepsvn", "iabdulwasey", "B-EtterDigital", "azamara", "tokenmaxed", "StartupBros",
  "dprvda", "sigridjineth", "sahir2k", "trac3rOO",
];
const DEMO_FIRST = [
  "quiet", "rapid", "lunar", "amber", "cobalt", "steady", "brisk", "cedar", "delta", "ember",
  "frost", "gamma", "harbor", "indigo", "jade", "kilo", "lumen", "maple", "nova", "onyx",
  "pixel", "quartz", "river", "sable", "tidal", "umbra", "vector", "willow", "xeno", "zephyr",
];
const DEMO_SECOND = [
  "fox", "dev", "byte", "loop", "stack", "forge", "shell", "cache", "node", "lambda",
  "kernel", "patch", "merge", "build", "agent", "prompt", "token", "commit", "ship", "query",
];
const DEMO_TOOLSETS: { tools: string[]; models: string[] }[] = [
  { tools: ["claude"], models: ["claude-opus-4-8", "claude-sonnet-4-6"] },
  { tools: ["claude", "codex"], models: ["claude-opus-4-8", "gpt-5.5"] },
  { tools: ["codex"], models: ["gpt-5.5", "gpt-5.5-mini"] },
  { tools: ["opencode"], models: ["glm-5.3", "deepseek-v4.1"] },
  { tools: ["claude", "gemini"], models: ["claude-sonnet-4-6", "gemini-3-pro"] },
  { tools: ["gemini"], models: ["gemini-3-pro", "gemini-3-flash"] },
  { tools: ["claude", "opencode", "codex"], models: ["claude-opus-4-8", "gpt-5.5", "kimi-k3"] },
];

type DemoKind = "ranked" | "unverified" | "review" | "fleet";

/** mulberry32: small, fast, deterministic. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Log-uniform between lo and hi: most people spend little, a few spend a lot. */
function logUniform(random: () => number, lo: number, hi: number): number {
  return Math.exp(Math.log(lo) + random() * (Math.log(hi) - Math.log(lo)));
}

function demoHandles(random: () => number, count: number): string[] {
  const handles = new Set(DEMO_KNOWN_HANDLES);
  while (handles.size < count) {
    const first = DEMO_FIRST[Math.floor(random() * DEMO_FIRST.length)];
    const second = DEMO_SECOND[Math.floor(random() * DEMO_SECOND.length)];
    const suffix = random() < 0.35 ? String(Math.floor(random() * 99)) : "";
    handles.add(`${first}${second}${suffix}`);
  }
  return [...handles];
}

function demoKind(index: number): DemoKind {
  if (index % 37 === 5) return "fleet";
  if (index % 41 === 7) return "review";
  if (index % 7 === 3) return "unverified";
  return "ranked";
}

/** One week of days for a developer: weekends lighter, nothing after today. */
function demoWeekDays(
  random: () => number,
  monday: string,
  weekCost: number,
  tokensPerDollar: number,
  toolset: (typeof DEMO_TOOLSETS)[number],
  lastDate: string
): UserDay[] {
  const weights = [1, 1.1, 1.15, 1.05, 0.95, 0.35, 0.25].map((w) => (random() < 0.12 ? 0 : w * (0.6 + random() * 0.8)));
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const days: UserDay[] = [];
  weights.forEach((weight, index) => {
    const date = addDays(monday, index);
    if (date > lastDate || weight === 0) return;
    const cost = Math.round(((weekCost * weight) / total) * 100) / 100;
    if (cost <= 0) return;
    const split = 0.55 + random() * 0.35;
    const [primary, secondary] = toolset.models;
    days.push({
      date,
      cost,
      tokens: Math.round(cost * tokensPerDollar),
      agents: toolset.tools,
      models: [
        { model: primary, cost: Math.round(cost * split * 100) / 100 },
        { model: secondary ?? primary, cost: Math.round(cost * (1 - split) * 100) / 100 },
      ],
    });
  });
  return days;
}

function demoDeveloper(handle: string, index: number, today: string, currentMonday: string): UserHistory {
  const random = seededRandom(index * 7919 + 17);
  const kind = demoKind(index);
  const weeklyBase =
    kind === "fleet" ? logUniform(random, 40_000, 140_000) : logUniform(random, 120, kind === "ranked" ? 9_000 : 6_000);
  const tokensPerDollar = logUniform(random, 600_000, 3_200_000);
  const toolset = DEMO_TOOLSETS[index % DEMO_TOOLSETS.length];
  // Some joined recently, some skip weeks: that is what makes streaks vary.
  const joinedWeeksAgo = Math.floor(random() * (DEMO_HISTORY_WEEKS + 1));
  const skipChance = random() < 0.5 ? 0.05 : 0.25;
  const activeThisWeek = random() < 0.9;

  const days: UserDay[] = [];
  let level = weeklyBase;
  for (let weeksAgo = joinedWeeksAgo; weeksAgo >= 0; weeksAgo--) {
    // A random walk around the base, so ranks move week to week.
    level = Math.min(weeklyBase * 1.6, Math.max(weeklyBase * 0.4, level * (0.75 + random() * 0.5)));
    const isCurrent = weeksAgo === 0;
    if (isCurrent ? !activeThisWeek : random() < skipChance) continue;
    const monday = addDays(currentMonday, -7 * weeksAgo);
    days.push(...demoWeekDays(random, monday, level, tokensPerDollar, toolset, today));
  }

  return {
    userKey: handle.toLowerCase(),
    username: handle,
    avatarUrl: `https://github.com/identicons/${encodeURIComponent(handle)}.png`,
    verified: kind !== "unverified",
    source: kind === "unverified" ? "cli" : index % 3 === 0 ? "oauth" : "cli",
    reviewReasons:
      kind === "review"
        ? [`${addDays(today, -1)}: $31,240 in one day, over 20× this profile's median day ($840)`]
        : [],
    days,
  };
}

export function buildDemoDevelopers(now: Date): UserHistory[] {
  const today = isoDate(now);
  const currentMonday = weekStart(weekIdOf(now));
  const handles = demoHandles(seededRandom(48), DEMO_POPULATION);
  return handles.map((handle, index) => demoDeveloper(handle, index, today, currentMonday));
}

function demoWindowEntry(developer: UserHistory, query: WindowQuery): WindowEntry | null {
  const inWindow = (date: string) => (!query.from || date >= query.from) && (!query.to || date <= query.to);
  const days = developer.days.filter((day) => inWindow(day.date) && (!query.tool || day.agents.includes(query.tool)));
  if (days.length === 0) return null;
  const historyFrom = query.historyFrom;
  const activeWeeks = historyFrom
    ? [
        ...new Set(
          developer.days
            .filter((day) => day.date >= historyFrom && (!query.to || day.date <= query.to))
            .map((day) => weekStart(weekIdOf(day.date)))
        ),
      ].sort()
    : undefined;
  return {
    userKey: developer.userKey,
    username: developer.username,
    avatarUrl: developer.avatarUrl,
    verified: developer.verified,
    source: developer.source,
    reviewReasons: developer.reviewReasons,
    tools: [...new Set(days.flatMap((day) => day.agents))].sort(),
    cost: Math.round(days.reduce((sum, day) => sum + day.cost, 0) * 100) / 100,
    tokens: days.reduce((sum, day) => sum + day.tokens, 0),
    activeDays: days.length,
    firstDate: days[0].date,
    lastDate: days[days.length - 1].date,
    ...(query.withDays ? { days: days.map(({ date, cost, tokens }) => ({ date, cost, tokens })) } : {}),
    ...(activeWeeks ? { activeWeeks } : {}),
  };
}

/** The demo WeeklySource: generated developers, nothing frozen, nothing stored. */
export function createDemoWeeklySource(now: Date): WeeklySource {
  const developers = buildDemoDevelopers(now);
  return {
    async windowEntries(query) {
      return developers
        .map((developer) => demoWindowEntry(developer, query))
        .filter((entry): entry is WindowEntry => entry !== null);
    },
    async userHistory(username, from, to) {
      const wanted = username.toLowerCase();
      const developer = developers.find((candidate) => candidate.userKey === wanted);
      if (!developer) return null;
      return {
        ...developer,
        days: developer.days.filter((day) => (!from || day.date >= from) && (!to || day.date <= to)),
      };
    },
    async frozenWeek() {
      return null;
    },
  };
}

export function createDemoWeeklyService(now: () => Date = () => new Date()): WeeklyDataService {
  return createWeeklyService(createDemoWeeklySource(now()), { now, cacheMs: 30_000 });
}
