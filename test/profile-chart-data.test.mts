/**
 * Profile usage chart: the server ships uncollapsed per-model daily costs and
 * the chart ranks the top models within the selected range (#180).
 */
import assert from "node:assert/strict";

const { buildProfileChartDays, selectRangeSeries, OTHER_KEY, TOP_SERIES } = await import(
  "../src/lib/profile-chart-data.ts"
);

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

type Split = [model: string, cost: number];
const day = (date: string, totalCost: number, splits?: Split[]) => ({
  date,
  inputTokens: 1,
  outputTokens: 1,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 2,
  totalCost,
  modelsUsed: (splits ?? []).map(([m]) => m),
  modelBreakdowns: splits?.map(([modelName, cost]) => ({
    modelName,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    cost,
  })),
});
const sumOf = (byModel: Record<string, number>) => Object.values(byModel).reduce((s, c) => s + c, 0);

{
  const [d] = buildProfileChartDays([
    day("2026-09-28", 133.02, [
      ["claude-opus-5-20260901", 41.75],
      ["anthropic/claude-opus-5", 10],
      ["[openclaw] gpt-6-sol", 81.27],
    ]),
  ]);
  assert.deepEqual(d.byModel, { "claude-opus-5": 51.75, "gpt-6-sol": 81.27 });
  assert.equal(d.byModel[OTHER_KEY], undefined, "server days never pre-fold into Other");
  check("server keeps every model split, merged by pretty name");
}

{
  const [d] = buildProfileChartDays([day("2026-09-28", 10, [["model-a", 8], ["model-b", 7]])]);
  assert.ok(Math.abs(sumOf(d.byModel) - 10) < 1e-3, "over-attributed splits are scaled to the daily cost");
  check("over-attributed splits scale down to the recorded cost");
}

// Long history: five old models dominate all-time; two new ones are all
// that's used in the last week.
const history = buildProfileChartDays([
  ...Array.from({ length: 30 }, (_, i) =>
    day(`2026-08-${String(i + 1).padStart(2, "0")}`, 500, [
      ["old-a", 100],
      ["old-b", 100],
      ["old-c", 100],
      ["old-d", 100],
      ["old-e", 100],
    ])
  ),
  ...Array.from({ length: 7 }, (_, i) =>
    day(`2026-10-0${i + 1}`, 60, [
      ["new-x", 40],
      ["new-y", 15],
      ["old-a", 5],
    ])
  ),
]);

{
  const { modelKeys, stacked } = selectRangeSeries(history.slice(-7));
  assert.deepEqual(modelKeys, ["new-x", "new-y", "old-a"], "7d ranks by cost within the visible days");
  for (const d of stacked) {
    assert.equal(d.byModel[OTHER_KEY], undefined, "nothing in range folds into Other");
    assert.ok(Math.abs(sumOf(d.byModel) - d.total) < 1e-9);
  }
  check("new models get their own series in a short range despite all-time leaders");
}

{
  const { modelKeys, stacked } = selectRangeSeries(history);
  assert.equal(modelKeys.length, TOP_SERIES);
  assert.ok(!modelKeys.includes("new-x"), "all-time view keeps all-time leaders");
  const last = stacked[stacked.length - 1];
  assert.equal(last.byModel[OTHER_KEY], 55, "models outside the range's top 5 fold into Other");
  assert.ok(Math.abs(sumOf(last.byModel) - last.total) < 1e-9);
  check("all-time view shows the top 5 and folds the rest into Other");
}

{
  const days = buildProfileChartDays([
    day("2026-09-26", 10, [["model-a", 6]]),
    day("2026-09-27", 7),
    day("2026-09-28", 0.3, [["model-a", 0.1], ["model-b", 0.2]]),
    day("2026-09-29", 1, [["model-a", 0.7], ["model-b", 0.3 - 1e-12]]),
  ]);
  const { stacked } = selectRangeSeries(days);
  const byDate = new Map(stacked.map((d) => [d.date, d.byModel]));
  assert.equal(byDate.get("2026-09-26")?.[OTHER_KEY], 4, "partially attributed cost goes to Other");
  assert.equal(byDate.get("2026-09-27")?.[OTHER_KEY], 7, "legacy cost without splits is Other");
  assert.equal(byDate.get("2026-09-28")?.[OTHER_KEY], undefined, "float noise doesn't add Other $0.00");
  assert.equal(byDate.get("2026-09-29")?.[OTHER_KEY], undefined);
  check("unattributed cost folds into Other above half a cent");
}

{
  const { modelKeys, stacked } = selectRangeSeries(buildProfileChartDays([day("2026-09-27", 7), day("2026-09-28", 3)]));
  assert.deepEqual(modelKeys, [], "legacy-only range has no model series");
  assert.equal(stacked[1].byModel[OTHER_KEY], 3);
  assert.deepEqual(selectRangeSeries([]), { modelKeys: [], stacked: [] });
  check("legacy-only and empty ranges");
}

console.log(`\n✅ ${passed} profile chart checks passed`);
