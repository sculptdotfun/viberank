/**
 * Tests for streak computation.
 * Run: node test/streaks.test.mts
 *
 * No test framework in this repo, so this is a tiny self-contained harness.
 */
// Dynamic import: Node's native .ts loader reparses as ESM at runtime, so a
// static `import {…} from "….ts"` fails name resolution; dynamic import works.
const { computeStreaks } = await import("../src/lib/streaks.ts");

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

const TODAY = "2026-07-24";

console.log("computeStreaks");

eq("empty input", computeStreaks([], TODAY), { current: 0, longest: 0 });

eq(
  "single day today",
  computeStreaks(["2026-07-24"], TODAY),
  { current: 1, longest: 1 }
);

eq(
  "streak alive when last active day is yesterday",
  computeStreaks(["2026-07-21", "2026-07-22", "2026-07-23"], TODAY),
  { current: 3, longest: 3 }
);

eq(
  "streak dead when last active day is two days ago",
  computeStreaks(["2026-07-20", "2026-07-21", "2026-07-22"], TODAY),
  { current: 0, longest: 3 }
);

eq(
  "longest run can predate the current one",
  computeStreaks(
    ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-23", "2026-07-24"],
    TODAY
  ),
  { current: 2, longest: 5 }
);

eq(
  "duplicate and unsorted dates are tolerated",
  computeStreaks(["2026-07-24", "2026-07-23", "2026-07-23", "2026-07-22"], TODAY),
  { current: 3, longest: 3 }
);

eq(
  "gap of one missing day breaks the run",
  computeStreaks(["2026-07-20", "2026-07-22", "2026-07-23", "2026-07-24"], TODAY),
  { current: 3, longest: 3 }
);

eq(
  "month boundary is contiguous",
  computeStreaks(["2026-06-29", "2026-06-30", "2026-07-01"], "2026-07-01"),
  { current: 3, longest: 3 }
);

eq(
  "invalid dates are dropped",
  computeStreaks(["not-a-date", "2026-07-24"], TODAY),
  { current: 1, longest: 1 }
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
