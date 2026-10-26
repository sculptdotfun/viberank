/**
 * /api/leaderboard and /api/profile/[username] shapes. The viberank MCP
 * server reads these field names, so a rename here breaks it.
 */
import assert from "node:assert/strict";
import type { Submission, ProfileWithSubmissions } from "../src/lib/data/types.ts";

const {
  parseLeaderboardQuery,
  shapeLeaderboardEntries,
  shapeProfileSummary,
  bestSubmissionCost,
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
} = await import("../src/lib/public-api.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

const q = (s: string) => parseLeaderboardQuery(new URLSearchParams(s));

{
  assert.deepEqual(q(""), { limit: LEADERBOARD_DEFAULT_LIMIT });
  assert.equal(LEADERBOARD_DEFAULT_LIMIT, 10);
  assert.deepEqual(q("limit=25"), { limit: 25 });
  assert.deepEqual(q("limit=500"), { limit: LEADERBOARD_MAX_LIMIT }, "capped, not refused");
  assert.equal(LEADERBOARD_MAX_LIMIT, 50);
  assert.deepEqual(q("limit=0"), { limit: 10 });
  assert.deepEqual(q("limit=-3"), { limit: 10 });
  assert.deepEqual(q("limit=abc"), { limit: 10 });
  assert.deepEqual(q("limit=7&tool=Codex"), { limit: 7, tool: "codex" }, "tool slugs are lowercased");
  assert.deepEqual(q("tool="), { limit: 10 }, "an empty tool is no filter");
  assert.ok("error" in q("tool=../../etc"), "a non-slug tool is a 400");
  check("limit defaults to 10, caps at 50, and tool must be a slug");
}

const submission = (over: Partial<Submission>): Submission => ({
  id: "s",
  username: "alice",
  totalTokens: 1_000,
  totalCost: 10,
  inputTokens: 500,
  outputTokens: 500,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  dateRange: { start: "2026-10-01", end: "2026-10-02" },
  modelsUsed: [],
  dailyBreakdown: [],
  submittedAt: 0,
  verified: false,
  ...over,
});

{
  const entries = shapeLeaderboardEntries([
    submission({ id: "1", username: "alice", githubUsername: "Alice", totalCost: 900, totalTokens: 9e9, tools: ["claude", "codex"], verified: true }),
    submission({ id: "2", username: "bob", totalCost: 500, reviewReasons: ["spike"] }),
    submission({ id: "3", username: "carol", totalCost: 100, tools: undefined }),
  ]);
  assert.deepEqual(entries[0], {
    rank: 1,
    username: "Alice",
    totalCost: 900,
    totalTokens: 9e9,
    tools: ["claude", "codex"],
    verified: true,
    underReview: false,
    profileUrl: "https://www.viberank.app/profile/Alice",
  });
  assert.deepEqual(entries.map((e) => e.rank), [1, 2, 3], "rank is board position, as the homepage prints it");
  assert.equal(entries[1].underReview, true, "rows under review are marked, not hidden");
  assert.deepEqual(entries[2].tools, [], "tools is always an array");
  assert.deepEqual(Object.keys(entries[0]).sort(), [
    "profileUrl", "rank", "tools", "totalCost", "totalTokens", "underReview", "username", "verified",
  ]);
  check("leaderboard entries carry exactly the contract's fields");
}

{
  const profile: ProfileWithSubmissions = {
    id: "p",
    username: "alice",
    githubUsername: "Alice",
    totalSubmissions: 2,
    createdAt: 0,
    submissions: [
      submission({
        id: "a",
        totalCost: 300,
        totalTokens: 3e9,
        tools: ["codex", "claude"],
        verified: true,
        dailyBreakdown: [
          { date: "2026-10-01", inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, totalCost: 0, modelsUsed: [] },
          { date: "2026-10-02", inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, totalCost: 0, modelsUsed: [] },
        ],
      }),
      submission({
        id: "b",
        totalCost: 50,
        totalTokens: 1e9,
        tools: ["gemini"],
        dailyBreakdown: [
          // Overlaps the first submission's day: counted once.
          { date: "2026-10-02", inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, totalCost: 0, modelsUsed: [] },
        ],
      }),
    ],
  };
  assert.equal(bestSubmissionCost(profile), 300, "rank comes from the best submission, as on the board");
  assert.deepEqual(shapeProfileSummary(profile, 42), {
    username: "Alice",
    rank: 42,
    totalCost: 350,
    totalTokens: 4e9,
    daysTracked: 2,
    tools: ["claude", "codex", "gemini"],
    verified: true,
    profileUrl: "https://www.viberank.app/profile/alice",
  });
  assert.equal(shapeProfileSummary(profile, null).rank, null);
  check("a profile summary sums submissions and counts distinct days");
}

console.log(`\n${passed} passed`);
