import assert from "node:assert/strict";

const {
  comparePlans,
  coversBurn,
  percentileOf,
  monthlyBurn,
  toolPlansFor,
  hasCapacityData,
  TOOL_PLANS,
} = await import("../src/lib/plans.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

const claude = toolPlansFor("claude");
const codex = toolPlansFor("codex");
const copilot = toolPlansFor("copilot");

// ---------------------------------------------------------------------------
// Prices — these are real numbers users will act on, so pin them.
// Any edit without re-checking the vendor's page fails here.
// ---------------------------------------------------------------------------

{
  assert.deepEqual(
    claude.plans.map((p) => [p.name, p.monthly]),
    [["Claude Pro", 20], ["Claude Max 5x", 100], ["Claude Max 20x", 200]],
    "claude.com/pricing, checked 2026-08-05"
  );
  assert.deepEqual(
    codex.plans.map((p) => p.monthly),
    [8, 20, 100, 200],
    "learn.chatgpt.com/docs/pricing, checked 2026-08-05"
  );
  assert.deepEqual(
    copilot.plans.map((p) => p.monthly),
    [10, 39, 100],
    "github.com/features/copilot/plans, checked 2026-08-05"
  );
  check("plan prices match the vendor pricing pages");
}

{
  for (const tool of TOOL_PLANS) {
    const prices = tool.plans.map((p) => p.monthly);
    assert.deepEqual(
      prices,
      [...prices].sort((a, b) => a - b),
      `${tool.id} plans must be ordered cheapest-first for selection to work`
    );
    assert.ok(tool.source.length > 0, `${tool.id} must cite a source`);
  }
  check("every tool is ordered cheapest-first and cites a source");
}

// ---------------------------------------------------------------------------
// Plan selection
// ---------------------------------------------------------------------------

{
  assert.equal(comparePlans(claude, 45).recommended!.id, "pro");
  assert.equal(comparePlans(claude, 400).recommended!.id, "max5");
  assert.equal(comparePlans(claude, 1318).recommended!.id, "max20", "the median viberank dev");
  assert.equal(comparePlans(claude, 26000).recommended!.id, "max20", "p99 still tops out");
  check("recommends the cheapest plan whose usage tier covers the burn");
}

{
  const light = comparePlans(claude, 12);
  assert.ok(
    light.savingVsApi < 0,
    `expected a negative saving for a $12/mo user, got ${light.savingVsApi}`
  );
  check("reports a negative saving when a subscription would cost more");
}

{
  const median = comparePlans(claude, 1318);
  assert.equal(median.savingVsApi, 1318 - 200);
  assert.ok(Math.abs(median.multiple - 6.59) < 0.01, `got ${median.multiple}`);
  check("saving and multiple are computed against the recommended plan");
}

{
  assert.equal(comparePlans(claude, 1000).exceedsTopPlan, false);
  assert.equal(comparePlans(claude, 5000).exceedsTopPlan, true);
  check("flags burn that would strain even the largest plan's limits");
}

{
  for (const bad of [0, -50, NaN, Infinity]) {
    for (const tool of TOOL_PLANS) {
      const verdict = comparePlans(tool, bad as number);
      // Ranked tools must still name a plan; unranked ones must still not.
      assert.equal(
        verdict.recommended !== null,
        hasCapacityData(tool),
        `${tool.id} changed its ranking behaviour on input ${bad}`
      );
      assert.ok(Number.isFinite(verdict.savingVsApi), `non-finite saving for ${bad}`);
      assert.ok(Number.isFinite(verdict.multiple), `non-finite multiple for ${bad}`);
    }
  }
  check("degenerate inputs never produce NaN or Infinity, for any tool");
}

// ---------------------------------------------------------------------------
// Capacity — the guard against the table recommending against itself
// ---------------------------------------------------------------------------

{
  // On price alone Pro "saves" more than Max 20x against a $1,300/mo burn,
  // because Pro is cheaper. Presenting that as the better deal is nonsense —
  // Pro would rate-limit that user at a fraction of it.
  const burn = 1300;
  const pro = claude.plans.find((p) => p.id === "pro")!;
  const max20 = claude.plans.find((p) => p.id === "max20")!;

  assert.ok(burn - pro.monthly > burn - max20.monthly, "cheaper plan shows a bigger raw saving");
  assert.equal(coversBurn(claude, pro, burn), false, "Pro must not be shown as covering $1300/mo");
  assert.equal(coversBurn(claude, max20, burn), true);
  check("capacity check stops a cheaper plan from looking like the better deal");
}

{
  // Copilot publishes no usage multiples. Inventing a "too small" label would
  // be a different lie from the one the capacity check exists to prevent, so
  // every plan is treated as covering and the page says why.
  for (const plan of copilot.plans) {
    assert.equal(plan.usageMultiple, null, `${plan.id} must not claim an unsourced multiple`);
    assert.equal(coversBurn(copilot, plan, 99_999), true);
  }
  assert.ok(copilot.capacityUnknownNote, "must explain why no plan is marked too small");
  assert.equal(comparePlans(copilot, 5000).exceedsTopPlan, false, "no unsourced ceiling claim");
  check("tools without published usage tiers make no capacity claims");
}

{
  // The mirror-image bug: with no capacity data, picking the cheapest plan
  // claimed a $10 Copilot Pro seat carries $1,300/mo of usage and "pays for
  // itself 130x over". Declining to rank is the only honest option.
  assert.equal(hasCapacityData(copilot), false);
  const verdict = comparePlans(copilot, 1300);
  assert.equal(verdict.recommended, null, "must not name a plan it cannot rank");
  assert.equal(verdict.savingVsApi, 0, "no saving claim without a recommended plan");
  assert.equal(verdict.multiple, 0, "no 130x multiple claim");

  // Tools that do publish tiers keep recommending.
  assert.equal(hasCapacityData(claude), true);
  assert.equal(hasCapacityData(codex), true);
  assert.ok(comparePlans(codex, 1300).recommended, "codex still ranks");
  check("no plan is recommended when the vendor publishes no usage tiers");
}

{
  assert.equal(coversBurn(claude, claude.plans[0], 50), true, "Pro covers a light user");
  assert.equal(coversBurn(claude, claude.plans[0], 0), true, "zero burn is covered by every plan");
  check("capacity check is true for burn within a plan's tier");
}

{
  assert.equal(toolPlansFor("nonsense").id, "claude", "unknown tool falls back, never throws");
  check("an unknown tool id falls back to the default");
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
  assert.equal(percentileOf([10, 10, 10, 10], 10), 0, "ties sit at the bottom of their run");
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

console.log(`\n${passed} passed, 0 failed`);
