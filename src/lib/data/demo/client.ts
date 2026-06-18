import type {
  ClaimResult,
  ClaimStatus,
  DataLayer,
  DateRangeLeaderboardParams,
  DateRangeLeaderboardResult,
  DeleteResult,
  FindProfilesResult,
  GlobalStats,
  HireListing,
  LeaderboardParams,
  LeaderboardResult,
  PatternSearchOptions,
  ProfileWithSubmissions,
  Submission,
  SubmitData,
} from "../types";

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

function sortSubmissions(items: Submission[], sortBy: "cost" | "tokens" = "cost") {
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
    submissions: {
      async submit(_data: SubmitData): Promise<string> {
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
      async getProfile(username: string, _submissionLimit?: number): Promise<ProfileWithSubmissions | null> {
        const submission = findSubmission(username);
        return submission ? profileFromSubmission(submission) : null;
      },
      async setOpenToWork(): Promise<{ success: boolean; error?: string }> {
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
    stats: {
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
  };
}
