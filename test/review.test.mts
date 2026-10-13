/**
 * Automatic review marks (#183): unusual, not invalid, never hidden.
 * Run: node --import tsx test/review.test.mts
 */
const { reviewReasonsFor, mergeReviewReasons, median } = await import("../src/lib/review.ts");

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${detail}`); }
}

const days = (n: number, cost: number) => Array.from({ length: n }, () => cost);

console.log("\n[1] Outlier days");
{
  // A profile of $300 days that suddenly reports $1.8M in one day (#182).
  const r = reviewReasonsFor({
    incomingDays: [{ date: "2026-10-08", totalCost: 1_825_000 }],
    allDayCosts: [...days(87, 300), 1_825_000],
    previousTotal: 25_920,
    newTotal: 1_850_920,
  });
  ok("a synthetic-sized day is marked", r.some((x) => x.startsWith("2026-10-08")), JSON.stringify(r));
  ok("and so is the size of the addition", r.some((x) => x.startsWith("One submission added")));

  // A steady heavy user: $40K days every day is their normal.
  const steady = reviewReasonsFor({
    incomingDays: [{ date: "2026-10-01", totalCost: 45_000 }],
    allDayCosts: days(60, 40_000),
    previousTotal: 2_400_000,
    newTotal: 2_445_000,
  });
  ok("a steady heavy user's big day is not marked", steady.length === 0, JSON.stringify(steady));

  // A light user with one $20K day: unusual but under the absolute floor.
  const light = reviewReasonsFor({
    incomingDays: [{ date: "2026-10-01", totalCost: 20_000 }],
    allDayCosts: [...days(40, 50), 20_000],
    previousTotal: 2_000,
    newTotal: 22_000,
  });
  ok("a $20K spike stays under the absolute floor", light.length === 0, JSON.stringify(light));
}

console.log("\n[2] Large additions");
{
  const r = reviewReasonsFor({
    incomingDays: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, totalCost: 4_000 })),
    allDayCosts: days(30, 4_000),
    previousTotal: 0,
    newTotal: 120_000,
  });
  ok("a $120K first upload spread over 30 even days is marked once", r.length === 1 && r[0].includes("$120,000"), JSON.stringify(r));
}

console.log("\n[3] Merging reasons");
{
  ok("repeats are dropped", mergeReviewReasons(["a", "b"], ["b", "c"]).join() === "a,b,c");
  ok("null existing works", mergeReviewReasons(null, ["x"]).join() === "x");
  ok("median of an even list", median([1, 3, 5, 7]) === 4);
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
