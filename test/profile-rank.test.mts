/**
 * Focused tests for profile rank presentation helpers.
 * Run: node test/profile-rank.test.mts
 */

const { getProfileRankDisplay } = await import("../src/lib/profile-rank.ts");

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

console.log("\n[1] Ranked profiles get a strong rank display");
{
  const display = getProfileRankDisplay(2);

  ok("marks profile as ranked", display.isRanked);
  ok("formats rank with hash prefix", display.value === "#2", display.value);
  ok("uses a leaderboard-specific label", display.label === "Viberank position", display.label);
}

console.log("\n[2] Unranked profiles are explicit");
{
  const display = getProfileRankDisplay(null);

  ok("marks profile as unranked", !display.isRanked);
  ok("does not fake a rank", display.value === "—", display.value);
  ok("keeps the same label for layout stability", display.label === "Viberank position", display.label);
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
