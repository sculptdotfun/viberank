/**
 * Money vs value: real spend kept apart from API-equivalent value.
 * Run: node --import tsx test/money.test.mts
 */
import assert from "node:assert/strict";

// Dynamic import: tsx transpiles the source to CJS, so a static named import
// fails to bind at instantiation time.
const {
  isIsoDate,
  overlapMonths,
  declaredSubscriptionCost,
  subsidyMultiple,
  median,
  burnByToolMonth,
  estimateSubscriptionCost,
  moneyVsValue,
  activeRange,
  declaredCohortSummary,
  validateSubscriptionInput,
  formatMultiple,
  MIN_DECLARED_FOR_STATS,
} = await import("../src/lib/money.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

// ---------------------------------------------------------------------------
// Month overlap
// ---------------------------------------------------------------------------

{
  const range = { start: "2026-03-10", end: "2026-05-02" };
  assert.equal(overlapMonths("2026-01-15", null, range), 3, "Mar, Apr, May");
  assert.equal(overlapMonths("2026-04-30", "2026-05-01", { start: "2026-01-01", end: "2026-12-31" }), 2);
  assert.equal(overlapMonths("2026-03-05", "2026-03-06", { start: "2026-01-01", end: "2026-12-31" }), 1);
  check("partial months count as whole months");
}

{
  // An open-ended plan runs to the end of the recorded range, not to today,
  // so months after the last recorded day are never charged.
  assert.equal(overlapMonths("2026-05-01", null, { start: "2026-05-06", end: "2026-06-10" }), 2);
  assert.equal(overlapMonths("2025-12-20", null, { start: "2025-11-01", end: "2026-02-03" }), 3, "across a year boundary");
  check("open-ended plans are clamped to the active range");
}

{
  const range = { start: "2026-03-10", end: "2026-06-10" };
  assert.equal(overlapMonths("2025-01-01", "2025-06-30", range), 0, "entirely before");
  assert.equal(overlapMonths("2026-07-01", null, range), 0, "entirely after");
  assert.equal(overlapMonths("2026-01-01", "2026-03-09", range), 0, "ends the day before the range");
  assert.equal(overlapMonths("2026-01-01", "2026-03-10", range), 1, "ends on the range's first day");
  check("plans outside the active range contribute nothing");
}

// ---------------------------------------------------------------------------
// Declared cost
// ---------------------------------------------------------------------------

{
  const range = { start: "2026-03-10", end: "2026-06-10" };
  const cost = declaredSubscriptionCost(
    [
      { tool: "claude", planId: "max20", startedOn: "2026-01-01", endedOn: null },
      { tool: "codex", planId: "plus", startedOn: "2026-05-15", endedOn: "2026-05-20" },
    ],
    range
  );
  assert.deepEqual(
    cost.lines.map((l) => [l.planName, l.months, l.cost]),
    [
      ["Claude Max 20x", 4, 800],
      ["ChatGPT Plus", 1, 20],
    ]
  );
  assert.equal(cost.total, 820);
  check("declared cost is monthly price × overlapping months, summed");
}

{
  const cost = declaredSubscriptionCost(
    [{ tool: "claude", planId: "ultra-retired", startedOn: "2026-01-01", endedOn: null }],
    { start: "2026-01-01", end: "2026-03-01" }
  );
  assert.equal(cost.lines[0].planName, null);
  assert.equal(cost.lines[0].cost, 0, "an unlisted plan is kept but never priced");
  assert.equal(cost.total, 0);
  assert.equal(
    declaredSubscriptionCost([{ tool: "claude", planId: "pro", startedOn: "2026-01-01", endedOn: null }], null).total,
    0,
    "a profile with no days has no overlapping months"
  );
  check("unlisted plans and empty profiles cost nothing");
}

// ---------------------------------------------------------------------------
// Subsidy multiple
// ---------------------------------------------------------------------------

{
  assert.equal(subsidyMultiple(10_000, 200), 50);
  assert.equal(subsidyMultiple(0, 200), 0);
  assert.equal(subsidyMultiple(10_000, 0), null, "nothing paid gives no multiple");
  assert.equal(subsidyMultiple(10_000, -5), null);
  assert.equal(subsidyMultiple(Number.NaN, 200), null);
  assert.equal(subsidyMultiple(10_000, Number.POSITIVE_INFINITY), null);
  check("subsidy multiple is value ÷ spend, null when nothing was paid");
}

{
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  check("median handles empty, odd and even inputs");
}

// ---------------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------------

{
  const burn = burnByToolMonth([
    { date: "2026-05-01", totalCost: 100, agents: ["claude", "codex"] },
    { date: "2026-05-02", totalCost: 30, agents: ["claude"] },
    { date: "2026-06-01", totalCost: 12, agents: [] },
  ]);
  assert.deepEqual(burn, [
    { tool: "claude", month: "2026-05", cost: 80 },
    { tool: "codex", month: "2026-05", cost: 50 },
    { tool: "unattributed", month: "2026-06", cost: 12 },
  ]);
  check("mixed-tool days split evenly; days without agents stay unattributed");
}

{
  const estimate = estimateSubscriptionCost([
    { tool: "claude", month: "2026-01", cost: 50 }, // Pro covers $100
    { tool: "claude", month: "2026-02", cost: 400 }, // Max 5x covers $500
    { tool: "claude", month: "2026-03", cost: 1500 }, // Max 20x covers $2,000
    { tool: "claude", month: "2026-04", cost: 0 }, // no usage, no plan
    { tool: "codex", month: "2026-02", cost: 30 }, // ChatGPT Go covers $40
  ]);
  const claude = estimate.lines.find((l) => l.tool === "claude")!;
  assert.deepEqual(claude.plans, { "Claude Pro": 1, "Claude Max 5x": 1, "Claude Max 20x": 1 });
  assert.equal(claude.cost, 320);
  assert.equal(claude.months, 3);
  const codex = estimate.lines.find((l) => l.tool === "codex")!;
  assert.deepEqual(codex.plans, { "ChatGPT Go": 1 });
  assert.equal(estimate.total, 328);
  assert.deepEqual(estimate.unpricedTools, []);
  check("the estimate picks the cheapest covering plan per tool per month");
}

{
  const estimate = estimateSubscriptionCost([
    { tool: "claude", month: "2026-01", cost: 5000 },
  ]);
  assert.equal(estimate.total, 200, "priced at the largest plan");
  assert.equal(estimate.lines[0].monthsOverTopPlan, 1, "and flagged as outrunning it");
  check("burn beyond the largest plan is priced at it and flagged");
}

{
  const estimate = estimateSubscriptionCost([
    { tool: "gemini", month: "2026-01", cost: 300 },
    { tool: "copilot", month: "2026-01", cost: 300 },
    { tool: "unattributed", month: "2026-01", cost: 300 },
    { tool: "claude", month: "2026-01", cost: 300 },
  ]);
  assert.deepEqual(estimate.unpricedTools, ["copilot", "gemini", "unattributed"]);
  assert.equal(estimate.total, 100, "only Claude is priced");
  // Copilot has plans but no usage tiers: its $10 seat must not be claimed to
  // carry $300/month (plans.ts comparePlans returns no recommendation).
  assert.equal(estimate.lines.some((l) => l.tool === "copilot"), false);
  check("tools without plans or tiers are named, never guessed");
}

{
  assert.deepEqual(estimateSubscriptionCost([]), { total: 0, lines: [], unpricedTools: [] });
  check("an empty profile estimates to zero");
}

// ---------------------------------------------------------------------------
// Profile summary
// ---------------------------------------------------------------------------

const days = [
  { date: "2026-05-06", totalCost: 900, agents: ["claude"] },
  { date: "2026-06-10", totalCost: 1100, agents: ["claude"] },
];

{
  assert.deepEqual(activeRange(days), { start: "2026-05-06", end: "2026-06-10" });
  assert.equal(activeRange([]), null);
  check("active range spans the first and last recorded day");
}

{
  const summary = moneyVsValue({
    value: 2000,
    days,
    subscriptions: [{ tool: "claude", planId: "max20", startedOn: "2026-01-01", endedOn: null }],
  });
  assert.equal(summary.declared!.total, 400, "May and June at $200");
  assert.equal(summary.realSpend, 400);
  assert.equal(summary.multiple, 5);
  assert.equal(summary.estimate, null, "no estimate once something is declared");
  check("declared plans produce real spend and a multiple");
}

{
  const summary = moneyVsValue({ value: 2000, days, subscriptions: [] });
  assert.equal(summary.declared, null);
  assert.equal(summary.realSpend, 0);
  assert.equal(summary.multiple, null, "an estimate never produces a multiple");
  assert.ok(summary.estimate);
  check("no declaration falls back to an estimate with no multiple");
}

{
  // $900 in May needs Max 20x ($500 < $900); $1,100 in June needs Max 20x too.
  const summary = moneyVsValue({ value: 2000, days, subscriptions: [] });
  assert.deepEqual(summary.estimate!.lines[0].plans, { "Claude Max 20x": 2 });
  assert.equal(summary.estimate!.total, 400);
  check("estimate totals are month-by-month plan prices");
}

{
  const summary = moneyVsValue({
    value: 2000,
    days,
    subscriptions: [],
    payAsYouGo: [
      { source: "OpenRouter", amount: 250 },
      { source: "broken", amount: Number.NaN },
      { source: "refund", amount: -10 },
    ],
  });
  assert.deepEqual(summary.payAsYouGo, [{ source: "OpenRouter", amount: 250 }]);
  assert.equal(summary.realSpend, 250);
  assert.equal(summary.multiple, 8, "the multiple uses real spend only, never the estimate");
  check("pay-as-you-go counts as real spend; junk amounts are dropped");
}

// ---------------------------------------------------------------------------
// Site-wide cohort
// ---------------------------------------------------------------------------

{
  const declarer = (value: number) => ({
    value,
    range: { start: "2026-05-01", end: "2026-06-30" },
    subscriptions: [{ tool: "claude", planId: "max20", startedOn: "2026-01-01", endedOn: null }],
  });
  // Each pays $400 over the range.
  const four = [4000, 8000, 12000, 16000].map(declarer);
  assert.deepEqual(declaredCohortSummary(four), { declared: 4, medianMultiple: null }, "withheld below five");

  const five = [...four, declarer(20000)];
  assert.deepEqual(declaredCohortSummary(five), { declared: 5, medianMultiple: 30 });
  assert.equal(MIN_DECLARED_FOR_STATS, 5);

  const outsideRange = {
    value: 1_000_000,
    range: { start: "2026-05-01", end: "2026-06-30" },
    subscriptions: [{ tool: "claude", planId: "max20", startedOn: "2024-01-01", endedOn: "2024-12-31" }],
  };
  assert.deepEqual(
    declaredCohortSummary([...five, outsideRange]),
    { declared: 5, medianMultiple: 30 },
    "a declarer with no overlapping spend has no multiple and isn't counted"
  );
  check("the /stats median needs five declarers and skips zero-spend ones");
}

// ---------------------------------------------------------------------------
// Route validation
// ---------------------------------------------------------------------------

const TODAY = "2026-09-26";

{
  assert.deepEqual(
    validateSubscriptionInput({ tool: "claude", planId: "max20", startedOn: "2026-01-01" }, TODAY),
    { ok: true, value: { tool: "claude", planId: "max20", startedOn: "2026-01-01", endedOn: null } }
  );
  assert.deepEqual(
    validateSubscriptionInput({ tool: "codex", planId: "pro", startedOn: "2026-01-01", endedOn: "" }, TODAY),
    { ok: true, value: { tool: "codex", planId: "pro", startedOn: "2026-01-01", endedOn: null } },
    "an empty end date means still paying"
  );
  assert.equal(
    validateSubscriptionInput({ tool: "claude", planId: "pro", startedOn: TODAY, endedOn: TODAY }, TODAY).ok,
    true,
    "start = end = today is allowed"
  );
  check("valid declarations pass, empty end dates normalise to null");
}

{
  const bad = (body: unknown) => {
    const result = validateSubscriptionInput(body, TODAY);
    assert.equal(result.ok, false, JSON.stringify(body));
    return result.ok ? "" : result.error;
  };
  bad(null);
  bad("claude");
  assert.match(bad({ tool: "gemini", planId: "pro", startedOn: "2026-01-01" }), /Unknown tool/);
  assert.match(bad({ tool: "codex", planId: "max20", startedOn: "2026-01-01" }), /Unknown plan/, "a plan from another tool");
  assert.match(bad({ tool: "claude", planId: "pro", startedOn: "2026-02-31" }), /real date/);
  assert.match(bad({ tool: "claude", planId: "pro", startedOn: "2026-9-1" }), /real date/);
  assert.match(bad({ tool: "claude", planId: "pro", startedOn: "2026-01-01", endedOn: "soon" }), /End date/);
  assert.match(bad({ tool: "claude", planId: "pro", startedOn: "2026-09-27" }), /future/);
  assert.match(bad({ tool: "claude", planId: "pro", startedOn: "2026-03-01", endedOn: "2026-02-28" }), /before the start/);
  assert.match(bad({ tool: "claude", planId: "pro", startedOn: "2026-03-01", endedOn: "2026-10-01" }), /future/);
  check("unknown tools and plans, bad dates, and out-of-order dates are refused");
}

{
  assert.equal(isIsoDate("2024-02-29"), true, "leap day");
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate(20260101), false);
  check("isIsoDate rejects impossible calendar dates");
}

{
  assert.equal(formatMultiple(4.26), "4.3");
  assert.equal(formatMultiple(87.4), "87");
  assert.equal(formatMultiple(1234.5), "1,235");
  check("multiples show a decimal only below 10");
}

console.log(`\n${passed} passed, 0 failed`);
