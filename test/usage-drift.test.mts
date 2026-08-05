import assert from "node:assert/strict";

const { mergeMachineContribution, DEFAULT_MACHINE_ID } = await import("../src/lib/ccusage.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const slice = (cost: number, tokens = Math.round(cost * 1000)) => ({
  inputTokens: Math.round(tokens * 0.2),
  outputTokens: Math.round(tokens * 0.1),
  cacheCreationTokens: 0,
  cacheReadTokens: tokens - Math.round(tokens * 0.2) - Math.round(tokens * 0.1),
  totalTokens: tokens,
  totalCost: cost,
  modelsUsed: ["claude-opus-4-8"],
  agents: ["claude"],
});

// ---------------------------------------------------------------------------
// #83 — Claude Code rewrites its own transcripts, so a re-report can be lower
// ---------------------------------------------------------------------------

{
  // The reported case, scaled to one day: a second submission 16h later
  // reports 11% less for a day that already happened.
  const prior = { "machine-a": slice(17117) };
  const { contributions, aggregate, retainedPrior } = mergeMachineContribution(
    prior,
    "machine-a",
    slice(15226)
  );

  assert.equal(retainedPrior, true, "the drop must be reported, not silent");
  assert.equal(contributions["machine-a"].totalCost, 17117, "the observed high stands");
  assert.equal(aggregate.totalCost, 17117);
  check("a drifted-lower re-report does not lower an already-observed day");
}

{
  // Today's day still grows: a later run legitimately reports more.
  const prior = { "machine-a": slice(100) };
  const { contributions, aggregate, retainedPrior } = mergeMachineContribution(
    prior,
    "machine-a",
    slice(250)
  );

  assert.equal(retainedPrior, false);
  assert.equal(contributions["machine-a"].totalCost, 250, "a higher re-report wins");
  assert.equal(aggregate.totalCost, 250);
  check("a higher re-report still replaces the stored slice");
}

{
  // Whole-slice swap, not per-field max: a synthesised record with tokens from
  // one run and cost from another was never actually observed.
  const prior = { "m": { ...slice(500), totalTokens: 1_000_000, outputTokens: 900_000 } };
  const incoming = { ...slice(400), totalTokens: 9_000_000, outputTokens: 10 };
  const { contributions } = mergeMachineContribution(prior, "m", incoming);

  assert.equal(contributions["m"].totalCost, 500);
  assert.equal(contributions["m"].totalTokens, 1_000_000, "tokens come from the kept slice");
  assert.equal(contributions["m"].outputTokens, 900_000, "no field-wise Frankenstein record");
  check("the winning slice is kept whole rather than merged field-by-field");
}

// ---------------------------------------------------------------------------
// The high-water mark must not disturb multi-machine behaviour (#43)
// ---------------------------------------------------------------------------

{
  // A different machine still adds its own slice; the guard is per-machine and
  // must not make one machine's total suppress another's.
  const prior = { "machine-a": slice(1000) };
  const { contributions, aggregate, retainedPrior } = mergeMachineContribution(
    prior,
    "machine-b",
    slice(10)
  );

  assert.equal(retainedPrior, false, "a new machine is not a drop");
  assert.equal(contributions["machine-a"].totalCost, 1000);
  assert.equal(contributions["machine-b"].totalCost, 10);
  assert.equal(aggregate.totalCost, 1010, "machines still sum");
  check("a lower slice from a different machine is still added, not suppressed");
}

{
  // Unattributable submissions still own the whole day (#81) — a web upload or
  // older CLI can't be high-water compared against an id'd slice.
  const prior = { "machine-a": slice(9999) };
  const { contributions, retainedPrior } = mergeMachineContribution(
    prior,
    DEFAULT_MACHINE_ID,
    slice(5)
  );

  assert.deepEqual(Object.keys(contributions), [DEFAULT_MACHINE_ID]);
  assert.equal(contributions[DEFAULT_MACHINE_ID].totalCost, 5);
  assert.equal(retainedPrior, false, "replacing an unattributable day is not a drift signal");
  check("unattributable submissions still replace the day (#81 preserved)");
}

{
  // A legacy row with no per-machine map is not a prior observation.
  for (const empty of [null, undefined, {}]) {
    const { contributions, retainedPrior } = mergeMachineContribution(
      empty as never,
      "m",
      slice(42)
    );
    assert.equal(contributions["m"].totalCost, 42);
    assert.equal(retainedPrior, false);
  }
  check("legacy rows with no prior map are written normally");
}

{
  // Equal cost is not a drop — re-submitting identical data must be a no-op
  // rather than a drift warning.
  const prior = { "m": slice(750) };
  const { contributions, retainedPrior } = mergeMachineContribution(prior, "m", slice(750));
  assert.equal(retainedPrior, false, "an identical re-submit is not drift");
  assert.equal(contributions["m"].totalCost, 750);
  check("an identical re-submit is not reported as drift");
}

console.log(`\n${passed} passed, 0 failed`);
