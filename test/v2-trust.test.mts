/**
 * Tests for v2 trust classification and plan-equivalents.
 * Run: node --import tsx test/v2-trust.test.mts
 */
const trust = await import("../src/lib/v2/trust.ts");
const { FLEET_PLAN_EQ, PLAN_EQ_USD_PER_WEEK } = await import("../src/lib/v2/contract.ts");

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

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `(got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

console.log("[1] Plan-equivalents");
{
  eq("one plan's week is 1.0", trust.planEqFor(PLAN_EQ_USD_PER_WEEK, 7), 1);
  eq("the ceiling sits at $13,000 a week", trust.planEqFor(13_000), 10);
  eq("a 28-day window divides by four weeks", trust.planEqFor(5_200, 28), 1);
  eq("a window under a week is measured as a week", trust.planEqFor(1_300, 3), 1);
  eq("zero and bad input are 0", [trust.planEqFor(0), trust.planEqFor(-5), trust.planEqFor(NaN)], [0, 0, 0]);
  eq("rounded to two decimals", trust.roundPlanEq(1.23456), 1.23);
}

console.log("[2] Trust marks");
{
  eq("OAuth upload is verified", trust.trustMarkFor({ verified: true, source: "oauth" }), "verified");
  eq("signed CLI is claimed", trust.trustMarkFor({ verified: true, source: "cli" }), "claimed");
  eq("anonymous CLI is unverified", trust.trustMarkFor({ verified: false, source: "cli" }), "unverified");
  eq("unverified wins over a source", trust.trustMarkFor({ verified: false, source: "oauth" }), "unverified");
}

console.log("[3] Classification");
{
  eq("verified, clean, under the ceiling: ranked", trust.classify({ trust: "verified", planEq: 3 }), { cls: "ranked", underReview: false });
  eq("claimed counts as GitHub-backed", trust.classify({ trust: "claimed", planEq: 9.9 }).cls, "ranked");
  eq("exactly at the ceiling is still ranked", trust.classify({ trust: "verified", planEq: FLEET_PLAN_EQ }).cls, "ranked");
  eq(
    "unverified goes to Open with a reason",
    trust.classify({ trust: "unverified", planEq: 2 }),
    { cls: "open", underReview: false, heldReason: "Not verified with GitHub" }
  );
  const held = trust.classify({ trust: "verified", planEq: 2, reviewReasons: ["One submission added $120,000"] });
  eq("under review goes to Open", [held.cls, held.underReview], ["open", true]);
  eq("the held reason quotes the review mark", held.heldReason, "Under review: One submission added $120,000");
  eq(
    "above the ceiling is a fleet even when verified",
    trust.classify({ trust: "verified", planEq: 10.01 }),
    { cls: "fleets", underReview: false, heldReason: "Above 10 plans a week" }
  );
  eq("above the ceiling beats unverified", trust.classify({ trust: "unverified", planEq: 40 }).cls, "fleets");
  const fleetUnderReview = trust.classify({ trust: "verified", planEq: 20, reviewReasons: ["x"] });
  eq("a fleet keeps its review flag", [fleetUnderReview.cls, fleetUnderReview.underReview], ["fleets", true]);
  eq("blank review marks are ignored", trust.classify({ trust: "verified", planEq: 1, reviewReasons: ["", "  "] }).cls, "ranked");
  const long = trust.classify({ trust: "verified", planEq: 1, reviewReasons: ["x".repeat(200)] });
  ok("a long review mark is shortened", (long.heldReason ?? "").length < 110, `got ${long.heldReason?.length}`);
}

console.log("[4] Movement and streaks");
{
  eq("up three places", trust.movementFor(10, 7), 3);
  eq("down two places", trust.movementFor(5, 7), -2);
  eq("new on the board", trust.movementFor(undefined, 4), null);
  const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];
  eq("three closed weeks plus this one", trust.streakWeeks(weeks, "2026-11-23"), 4);
  eq("no usage yet this week keeps the closed run", trust.streakWeeks(weeks.slice(0, 3), "2026-11-23"), 3);
  eq("a gap ends the run", trust.streakWeeks(["2026-11-02", "2026-11-16", "2026-11-23"], "2026-11-23"), 2);
  eq("nothing at all is 0", trust.streakWeeks([], "2026-11-23"), 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
