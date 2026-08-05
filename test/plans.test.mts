import assert from "node:assert/strict";

const { comparePlans, coversBurn, percentileOf, monthlyBurn, PLANS } = await import("../src/lib/plans.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

// ---------------------------------------------------------------------------
// Plan selection
// ---------------------------------------------------------------------------

{
  assert.equal(comparePlans(45).recommended.id, "pro");
  assert.equal(comparePlans(400).recommended.id, "max5");
  assert.equal(comparePlans(1318).recommended.id, "max20", "the median viberank dev");
  assert.equal(comparePlans(26000).recommended.id, "max20", "p99 still tops out at max20");
  check("recommends the cheapest plan whose usage tier covers the burn");
}

{
  // The honest case: a light user is genuinely better off on the API, and the
  // tool has to be willing to say so rather than invent a saving.
  const light = comparePlans(12);
  assert.equal(light.recommended.id, "pro");
  assert.ok(
    light.savingVsApi < 0,
    `expected a negative saving for a $12/mo user, got ${light.savingVsApi}`
  );
  check("reports a negative saving when a subscription would cost more");
}

{
  const median = comparePlans(1318);
  assert.equal(median.savingVsApi, 1318 - 200);
  assert.ok(Math.abs(median.multiple - 6.59) < 0.01, `got ${median.multiple}`);
  check("saving and multiple are computed against the recommended plan");
}

{
  assert.equal(comparePlans(1000).exceedsTopPlan, false);
  assert.equal(comparePlans(5000).exceedsTopPlan, true);
  check("flags burn that would strain even the largest plan's limits");
}

{
  // Guard the degenerate inputs a form can produce.
  for (const bad of [0, -50, NaN, Infinity]) {
    const verdict = comparePlans(bad as number);
    assert.equal(verdict.recommended.id, "pro", `bad input ${bad}`);
    assert.ok(Number.isFinite(verdict.savingVsApi), `non-finite saving for ${bad}`);
    assert.ok(Number.isFinite(verdict.multiple), `non-finite multiple for ${bad}`);
  }
  check("degenerate inputs never produce NaN or Infinity");
}

// ---------------------------------------------------------------------------
// Percentiles
// ---------------------------------------------------------------------------

{
  const cohort = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentileOf(cohort, 5), 0);
  assert.equal(percentileOf(cohort, 55), 50);
  assert.equal(percentileOf(cohort, 1000), 100);
  check("percentile places a burn against the cohort");
}

{
  assert.equal(percentileOf([], 500), 0, "an empty cohort must not divide by zero");
  // Ties sit at the bottom of their run, so the cheapest dev is p0 rather than
  // inheriting a percentile from everyone equal to them.
  assert.equal(percentileOf([10, 10, 10, 10], 10), 0);
  check("empty cohorts and ties are handled without dividing by zero");
}

// ---------------------------------------------------------------------------
// Monthly burn
// ---------------------------------------------------------------------------

{
  assert.equal(monthlyBurn(300, 30), 300);
  assert.equal(monthlyBurn(150, 15), 300);
  assert.equal(monthlyBurn(0, 30), 0);
  assert.equal(monthlyBurn(300, 0), 0, "a zero-day span must not divide by zero");
  assert.equal(monthlyBurn(300, -5), 0);
  check("monthly burn normalises any span without dividing by zero");
}

// ---------------------------------------------------------------------------
// Plan data sanity — these are real prices users will act on
// ---------------------------------------------------------------------------

{
  assert.deepEqual(
    PLANS.map((p) => p.monthly),
    [20, 100, 200],
    "plan prices must match claude.com/pricing (verified 2026-08-05)"
  );
  assert.deepEqual(
    PLANS.map((p) => p.monthly).slice().sort((a: number, b: number) => a - b),
    PLANS.map((p) => p.monthly),
    "plans must be ordered cheapest-first for selection to work"
  );
  check("plan prices are correct and ordered cheapest-first");
}

{
  // The bug this guards: on price alone Pro "saves" more than Max 20x against
  // a $1,300/mo burn, because Pro is cheaper. Presenting that as the better
  // deal is nonsense — Pro would rate-limit that user at a fraction of it.
  const burn = 1300;
  const pro = PLANS.find((p) => p.id === "pro")!;
  const max20 = PLANS.find((p) => p.id === "max20")!;

  assert.ok(burn - pro.monthly > burn - max20.monthly, "cheaper plan shows a bigger raw saving");
  assert.equal(coversBurn(pro, burn), false, "Pro must not be presented as covering $1300/mo");
  assert.equal(coversBurn(max20, burn), true);
  check("capacity check stops a cheaper plan from looking like the better deal");
}

{
  assert.equal(coversBurn(PLANS[0], 50), true, "Pro covers a light user");
  assert.equal(coversBurn(PLANS[0], 0), true, "zero burn is covered by every plan");
  check("capacity check is true for burn within a plan's tier");
}

console.log(`\n${passed} passed, 0 failed`);
