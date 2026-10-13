import assert from "node:assert/strict";

const { spendRowsForTool, buildCostBenchmark } = await import("../src/lib/cost-benchmark.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

const row = (username: string, totalCost: number, tools?: string[]) => ({
  username,
  totalCost,
  start: "2026-01-01",
  end: "2026-01-30",
  tools,
});

const rows = [
  row("solo", 300, ["codex"]),
  row("mixed", 900, ["claude", "codex"]),
  row("claudeOnly", 600, ["claude"]),
  row("legacy", 100),
  row("cased", 50, ["Codex"]),
];

{
  const only = spendRowsForTool(rows, "codex", "only").map((r) => r.username);
  assert.deepEqual(only, ["solo", "cased"]);
  check("'only' keeps submissions where the tool is the sole agent, case-insensitively");
}

{
  const includes = spendRowsForTool(rows, "codex", "includes").map((r) => r.username);
  assert.deepEqual(includes, ["solo", "mixed", "cased"]);
  check("'includes' keeps any submission that used the tool");
}

{
  assert.equal(spendRowsForTool(rows, "gemini", "includes").length, 0);
  assert.equal(buildCostBenchmark(spendRowsForTool(rows, "gemini", "only")).cohortSize, 0);
  check("a tool nobody used yields an empty cohort, and legacy rows never match");
}

console.log(`\n${passed} cost-benchmark checks passed`);
