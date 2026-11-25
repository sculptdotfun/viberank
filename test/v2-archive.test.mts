/**
 * Tests for the week archive helpers.
 * Run: node --import tsx test/v2-archive.test.mts
 */
const archive = await import("../src/lib/v2/archive.ts");

let passed = 0;
let failed = 0;

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}: expected ${e}, got ${a}`);
  }
}

// Wednesday of 2026-W48; W47 closed on Monday and froze at Monday 12:00 UTC.
const wed = new Date("2026-11-25T10:00:00Z");
const mondayMorning = new Date("2026-11-23T06:00:00Z");

console.log("archiveWeekState");
eq("current week", archive.archiveWeekState("2026-W48", wed), "current");
eq("last week is final", archive.archiveWeekState("2026-W47", wed), "final");
eq("last week settles in the grace hours", archive.archiveWeekState("2026-W47", mondayMorning), "settling");
eq("next week is future", archive.archiveWeekState("2026-W49", wed), "future");
eq("malformed id", archive.archiveWeekState("2026-48", wed), "invalid");
eq("week 54 does not exist", archive.archiveWeekState("2026-W54", wed), "invalid");
eq("before the archive starts", archive.archiveWeekState("2025-W01", wed), "invalid");

console.log("closedWeekIds");
eq("newest first", archive.closedWeekIds(wed, 3), ["2026-W47", "2026-W46", "2026-W45"]);
eq("crosses the year", archive.closedWeekIds(new Date("2026-01-07T00:00:00Z"), 2), ["2026-W01", "2025-W52"]);
eq("stops at the first archive week", archive.closedWeekIds(new Date("2025-09-10T00:00:00Z"), 5), ["2025-W36"]);

console.log("neighbourWeeks");
eq("latest closed week links to the live one", archive.neighbourWeeks("2026-W47", wed), { prev: "2026-W46", next: "current" });
eq("older week links both ways", archive.neighbourWeeks("2026-W40", wed), { prev: "2026-W39", next: "2026-W41" });
eq("first week has no prev", archive.neighbourWeeks("2025-W36", wed).prev, null);

console.log("topMovers / newEntries");
const row = (rank: number, username: string, movement: number | null) => ({
  rank, username, movement, tools: [], cost: 100 - rank, tokens: 1, days: [], gap: null, planEq: 0, trust: "verified" as const, underReview: false, streakWeeks: 1,
});
const rows = [row(1, "a", 0), row(2, "b", 5), row(3, "c", null), row(4, "d", 5), row(5, "e", 9), row(6, "f", -2)];
eq("most places first, ties by rank", archive.topMovers(rows).map((r) => r.username), ["e", "b", "d"]);
eq("new entries", archive.newEntries(rows).map((r) => r.username), ["c"]);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
