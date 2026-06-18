/**
 * Focused regression tests for leaderboard/profile display bugs.
 * Run: node test/site-bugs.test.mts
 */

const {
  shouldUseServerSeededLeaderboard,
  getLeaderboardRequestKey,
  isLeaderboardResultForRequest,
} = await import("../src/lib/leaderboard-view.ts");
const {
  buildCalendarDailySeries,
  buildRecentSpendSpark,
  getDailyFreshness,
} = await import("../src/lib/profile-timeline.ts");
const {
  normalizeClaimHandle,
  isClaimableCliAlias,
} = await import("../src/lib/claim-handles.ts");

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

console.log("\n[1] Leaderboard server seed only applies before user interaction");
{
  const base = {
    hasInitialItems: true,
    hasUserInteracted: false,
    page: 0,
    sortBy: "cost" as const,
    hasToolFilter: false,
    verifiedOnly: false,
    isDateFiltered: false,
  };

  ok("initial default view can use server seed", shouldUseServerSeededLeaderboard(base));
  ok(
    "returning to default cost after a user click must fetch page 0",
    !shouldUseServerSeededLeaderboard({ ...base, hasUserInteracted: true })
  );
  ok(
    "token sort must fetch its own top page",
    !shouldUseServerSeededLeaderboard({ ...base, sortBy: "tokens" })
  );
  ok(
    "loaded next pages must never masquerade as rank 1",
    !shouldUseServerSeededLeaderboard({ ...base, page: 2 })
  );
}

console.log("\n[2] Profile timelines use real calendar spacing");
{
  const daily = [
    { date: "2026-06-01", cost: 10, tokens: 100 },
    { date: "2026-06-03", cost: 30, tokens: 300 },
  ];

  const series = buildCalendarDailySeries(daily, {
    range: "all",
    today: "2026-06-05",
  });

  ok("fills missing in-range days", series.length === 5, `got ${series.length}`);
  ok("keeps first recorded day", series[0]?.date === "2026-06-01");
  ok("fills internal gap with zero cost", series[1]?.date === "2026-06-02" && series[1]?.cost === 0);
  ok("extends to today so stale uploads are visible", series[4]?.date === "2026-06-05" && series[4]?.cost === 0);
}

console.log("\n[3] Profile sheet spark is last N calendar days, not last N recorded rows");
{
  const daily = [
    { date: "2026-06-01", cost: 10, tokens: 100 },
    { date: "2026-06-05", cost: 50, tokens: 500 },
  ];

  const spark = buildRecentSpendSpark(daily, {
    days: 5,
    today: "2026-06-05",
  });

  ok("returns exactly requested calendar days", spark.values.length === 5, `got ${spark.values.length}`);
  ok("starts at the expected calendar day", spark.startDate === "2026-06-01", spark.startDate);
  ok("preserves gaps as zero-height bars", JSON.stringify(spark.values) === "[10,0,0,0,50]", JSON.stringify(spark.values));
}

console.log("\n[4] Stale profile data is explicit");
{
  const stale = getDailyFreshness(
    [
      { date: "2026-06-01", cost: 10, tokens: 100 },
      { date: "2026-06-03", cost: 30, tokens: 300 },
    ],
    "2026-06-05"
  );

  ok("reports last recorded date", stale.lastRecordedDate === "2026-06-03", stale.lastRecordedDate ?? "");
  ok("marks stale data before today", stale.isStale);
  ok("reports missing days", stale.missingDays === 2, `got ${stale.missingDays}`);
}

console.log("\n[5] Leaderboard ignores results from stale sort/filter requests");
{
  const oldRequest = { sortBy: "cost" as const, page: 2, pageSize: 25 };
  const currentRequest = { sortBy: "tokens" as const, page: 0, pageSize: 25 };
  const staleResult = {
    items: [],
    page: 2,
    pageSize: 25,
    hasMore: true,
    requestKey: getLeaderboardRequestKey(oldRequest),
  };

  ok(
    "old paginated cost result does not match current token request",
    !isLeaderboardResultForRequest(staleResult, currentRequest)
  );
  ok(
    "same request key is accepted",
    isLeaderboardResultForRequest(
      { ...staleResult, requestKey: getLeaderboardRequestKey(currentRequest), page: 0 },
      currentRequest
    )
  );
}

console.log("\n[6] CLI/GitHub duplicate handles can be claimed safely");
{
  ok("normalizes invalid punctuation and case while preserving hyphens", normalizeClaimHandle("B-etter.Digital") === "b-etterdigital");
  ok(
    "matches unverified CLI alias against signed-in GitHub username",
    isClaimableCliAlias("B-EtterDigital", {
      username: "B-etter.Digital",
      githubUsername: "B-etter.Digital",
      source: "cli",
      verified: false,
    })
  );
  ok(
    "does not claim verified aliases",
    !isClaimableCliAlias("B-EtterDigital", {
      username: "B-etter.Digital",
      githubUsername: "B-etter.Digital",
      source: "cli",
      verified: true,
    })
  );
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
