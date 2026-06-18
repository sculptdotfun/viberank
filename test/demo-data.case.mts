import { strict as assert } from "node:assert";

process.env.NEXT_PUBLIC_VIBERANK_DEMO_DATA = "1";

const { getDatabaseBackend, getServerDataLayer } = await import("../src/lib/data/index.ts");

let passed = 0;
let failed = 0;

function ok(name: string, condition: unknown, detail = "") {
  if (condition) {
    console.log(`  \u2713 ${name}`);
    passed++;
  } else {
    console.error(`  \u2717 ${name}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n[1] Demo data backend can be selected for local visual QA");
ok("selects demo backend from env", getDatabaseBackend() === "demo");

const dataLayer = await getServerDataLayer();

console.log("\n[2] Demo leaderboard has realistic sortable rows");
{
  const byCost = await dataLayer.submissions.getLeaderboard({ sortBy: "cost", pageSize: 5 });
  const byTokens = await dataLayer.submissions.getLeaderboard({ sortBy: "tokens", pageSize: 5 });

  ok("returns enough rows to render the board", byCost.items.length === 5);
  ok("cost sort is descending", byCost.items[0].totalCost >= byCost.items[1].totalCost);
  ok("token sort can produce a different leader", byTokens.items[0].id !== byCost.items[0].id);
  ok("pagination reports more rows", byCost.hasMore);
}

console.log("\n[3] Demo data exercises profile and hire surfaces");
{
  const profile = await dataLayer.profiles.getProfile("B-EtterDigital");
  assert(profile, "expected B-EtterDigital demo profile");

  ok("profile has daily rows for charts", profile.submissions[0].dailyBreakdown.length >= 30);
  ok("profile has many models for expandable-list QA", profile.submissions[0].modelsUsed.length > 15);
  ok("profile is opted into hire flow", profile.openToWork);

  const hire = await dataLayer.profiles.getHireListings();
  ok("hire page has opted-in profiles", hire.length >= 2);
  ok("hire listings are ranked", hire.every((entry) => typeof entry.rank === "number"));
}

console.log("\n[4] Demo stats expose tool filter keys");
{
  const stats = await dataLayer.stats.getGlobalStats();
  const statKeys = Object.keys(stats.modelUsage);

  ok("includes tool names for the leaderboard filter", statKeys.includes("claude") && statKeys.includes("codex"));
  ok("does not expose model names as tools", !statKeys.includes("gpt-4.1") && !statKeys.includes("claude-opus-4"));
}

console.log(`\n${failed === 0 ? "\u2705" : "\u274c"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
