import assert from "node:assert/strict";

const { buildSpendCurve, quantile, percentileLadder, percentileFromLadder } = await import("../src/lib/spend-curve.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

const row = (username: string, totalCost: number, start: string, end: string) => ({
  username,
  totalCost,
  start,
  end,
});

{
  // 30 days at $300 and 15 days at $150 are the same monthly burn — the whole
  // point of normalising rather than comparing raw totals.
  const curve = buildSpendCurve([
    row("a", 300, "2026-01-01", "2026-01-30"),
    row("b", 150, "2026-01-01", "2026-01-15"),
  ]);
  assert.equal(curve.cohortSize, 2);
  assert.ok(Math.abs(curve.sorted[0] - 300) < 1, `got ${curve.sorted[0]}`);
  assert.ok(Math.abs(curve.sorted[1] - 300) < 1, `got ${curve.sorted[1]}`);
  check("normalises different spans to a comparable monthly burn");
}

{
  // A resubmitter must not be counted twice — otherwise one heavy user drags
  // the whole curve toward their own usage.
  const curve = buildSpendCurve([
    row("heavy", 3000, "2026-01-01", "2026-01-30"),
    row("heavy", 2000, "2026-01-01", "2026-01-30"),
    row("HEAVY", 1000, "2026-01-01", "2026-01-30"),
    row("light", 60, "2026-01-01", "2026-01-30"),
  ]);
  assert.equal(curve.cohortSize, 2, "heavy counted once, case-insensitively");
  assert.ok(Math.abs(curve.sorted[1] - 3000) < 1, "keeps the highest-cost submission");
  check("collapses to one row per user, case-insensitively");
}

{
  const curve = buildSpendCurve([
    row("ok", 300, "2026-01-01", "2026-01-30"),
    row("tooshort", 100, "2026-01-01", "2026-01-03"),
    row("zero", 0, "2026-01-01", "2026-01-30"),
    row("backwards", 300, "2026-01-30", "2026-01-01"),
    row("garbage", 300, "not-a-date", "also-not"),
  ]);
  assert.equal(curve.cohortSize, 1, "only the valid 30-day row survives");
  check("drops short spans, zero cost, inverted ranges and unparseable dates");
}

{
  const empty = buildSpendCurve([]);
  assert.equal(empty.cohortSize, 0);
  assert.deepEqual(
    empty.percentiles.map((x) => x.burn),
    [0, 0, 0, 0, 0, 0, 0],
    "an empty cohort must yield zeros, not NaN"
  );
  check("an empty cohort produces zeros rather than NaN");
}

{
  const sorted = [10, 20, 30, 40, 50];
  assert.equal(quantile(sorted, 0), 10);
  assert.equal(quantile(sorted, 0.5), 30);
  assert.equal(quantile(sorted, 1), 50);
  assert.equal(quantile(sorted, 0.25), 20);
  assert.equal(quantile([], 0.5), 0);
  assert.equal(quantile([42], 0.9), 42);
  check("quantile interpolates and survives empty/single-element cohorts");
}

{
  // A realistic shape: the curve must come back ascending, or percentile
  // placement silently lies.
  const rows = Array.from({ length: 200 }, (_, i) =>
    row(`u${i}`, (i + 1) * 25, "2026-01-01", "2026-01-30")
  );
  const curve = buildSpendCurve(rows);
  for (let i = 1; i < curve.sorted.length; i++) {
    assert.ok(curve.sorted[i] >= curve.sorted[i - 1], "cohort must be ascending");
  }
  const ps = curve.percentiles.map((x) => x.burn);
  for (let i = 1; i < ps.length; i++) {
    assert.ok(ps[i] >= ps[i - 1], "percentiles must be monotonic");
  }
  check("cohort and percentiles come back monotonically ascending");
}

{
  const rows = Array.from({ length: 500 }, (_, i) =>
    row(`u${i}`, (i + 1) * 20, "2026-01-01", "2026-01-30")
  );
  const curve = buildSpendCurve(rows);
  const ladder = percentileLadder(curve.sorted);

  assert.equal(ladder.length, 101, "the ladder is a fixed size regardless of cohort size");
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(ladder[i] >= ladder[i - 1], "ladder must be ascending");
  }
  check("percentile ladder is a fixed 101 ascending thresholds");
}

{
  // The ladder must agree with a direct scan of the full cohort, or the
  // payload saving comes at the cost of a wrong answer.
  const rows = Array.from({ length: 400 }, (_, i) =>
    row(`u${i}`, (i + 1) * 15, "2026-01-01", "2026-01-30")
  );
  const curve = buildSpendCurve(rows);
  const ladder = percentileLadder(curve.sorted);

  for (const probe of [0.5, 100, 1000, 4500, 9000, 999999]) {
    const direct = Math.round(
      (curve.sorted.filter((b) => b < probe).length / curve.sorted.length) * 100
    );
    const viaLadder = percentileFromLadder(ladder, probe);
    assert.ok(
      Math.abs(direct - viaLadder) <= 1,
      `ladder disagreed at ${probe}: direct p${direct}, ladder p${viaLadder}`
    );
  }
  check("ladder percentiles match a full-cohort scan within one point");
}

{
  assert.equal(percentileFromLadder([], 500), 0, "empty ladder must not throw");
  assert.equal(percentileFromLadder(percentileLadder([]), 500), 0);
  const single = percentileLadder([42]);
  assert.equal(percentileFromLadder(single, 1), 0);
  assert.equal(percentileFromLadder(single, 99), 100);
  check("ladder handles empty and single-element cohorts");
}

console.log(`\n${passed} passed, 0 failed`);
