/**
 * Tests for ccusage normalization + validation.
 * Run: pnpm test [path-to-cc.json]
 *
 * No test framework in this repo, so this is a tiny self-contained harness.
 */
import { readFileSync } from "node:fs";
// Dynamic import: Node's native .ts loader reparses as ESM at runtime, so a
// static `import {…} from "….ts"` fails name resolution; dynamic import works.
const { normalizeCcData, validateCcData, mergeMachineContribution } = await import("../src/lib/ccusage.ts");

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

function throws(name: string, fn: () => void, expectMsg?: string) {
  try {
    fn();
    failed++;
    console.log(`  ✗ ${name} (expected throw, got none)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (expectMsg && !msg.includes(expectMsg)) {
      failed++;
      console.log(`  ✗ ${name} (wrong msg: "${msg}")`);
    } else {
      passed++;
      console.log(`  ✓ ${name}`);
    }
  }
}

function doesNotThrow(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name} (threw: ${e instanceof Error ? e.message : e})`);
  }
}

const FIXED_NOW = new Date("2030-01-01T00:00:00Z"); // far future so test dates are never "future"

// ---------------------------------------------------------------------------
console.log("\n[1] Aggregate report: period-keyed rows with agent:'all'");
{
  const raw = {
    totals: {
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 30,
      totalCost: 0.01,
    },
    daily: [
      {
        period: "2025-10-03",
        agent: "all",
        inputTokens: 10,
        outputTokens: 20,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 30,
        totalCost: 0.01,
        modelsUsed: ["gpt-5-codex"],
        metadata: { agents: ["codex"] },
      },
    ],
  };
  const n = normalizeCcData(raw);
  ok("date derived from period", n.daily[0].date === "2025-10-03");
  ok("agents from metadata.agents", JSON.stringify(n.daily[0].agents) === '["codex"]');
  ok("submission tools = [codex]", JSON.stringify(n.tools) === '["codex"]');
  doesNotThrow("validates", () => validateCcData(n, FIXED_NOW));
}

// ---------------------------------------------------------------------------
console.log("\n[2] Single-source report: date-keyed, no agent field");
{
  const raw = {
    totals: {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 150,
      totalCost: 0.5,
    },
    daily: [
      {
        date: "2025-09-01",
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 150,
        totalCost: 0.5,
        modelsUsed: ["claude-opus-4-8"],
      },
    ],
  };
  const n = normalizeCcData(raw);
  ok("date preserved", n.daily[0].date === "2025-09-01");
  ok("agent inferred from model -> claude", JSON.stringify(n.daily[0].agents) === '["claude"]');
}

// ---------------------------------------------------------------------------
console.log("\n[3] Reasoning tokens: totalTokens > sum(components) is accepted");
{
  const raw = {
    totals: {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 1600, // +100 reasoning tokens not in components
      totalCost: 0.02,
    },
    daily: [
      {
        period: "2026-02-01",
        agent: "all",
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 1600,
        totalCost: 0.02,
        modelsUsed: ["gemini-3-pro-preview"],
        metadata: { agents: ["gemini"] },
      },
    ],
  };
  const n = normalizeCcData(raw);
  doesNotThrow("reasoning inflation accepted (was rejected before #48 fix)", () =>
    validateCcData(n, FIXED_NOW)
  );
}

// ---------------------------------------------------------------------------
console.log("\n[4] Anti-cheat still holds");
{
  // total LESS than components -> reject
  throws(
    "totalTokens < components rejected",
    () =>
      validateCcData(
        {
          totals: { inputTokens: 1000, outputTokens: 1000, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 5, totalCost: 0.01 },
          daily: [{ date: "2025-01-01", inputTokens: 1000, outputTokens: 1000, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 5, totalCost: 0.01, modelsUsed: [], agents: [] }],
        },
        FIXED_NOW
      ),
    "Token totals don't match"
  );
  // absurd token count with tiny cost -> cost/token ratio floor catches it
  throws(
    "inflated tokens (ratio too low) rejected",
    () =>
      validateCcData(
        {
          totals: { inputTokens: 50_000_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 50_000_000_000, totalCost: 0.01, },
          daily: [{ date: "2025-01-01", inputTokens: 50_000_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 50_000_000_000, totalCost: 0.01, modelsUsed: [], agents: [] }],
        },
        FIXED_NOW
      ),
    "Cost per token ratio is unrealistic"
  );
  // future date -> reject
  throws(
    "future date rejected",
    () =>
      validateCcData(
        {
          totals: { inputTokens: 1, outputTokens: 1, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 2, totalCost: 0.001 },
          daily: [{ date: "2031-01-01", inputTokens: 1, outputTokens: 1, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 2, totalCost: 0.001, modelsUsed: [], agents: [] }],
        },
        FIXED_NOW
      ),
    "Future date"
  );
}

// ---------------------------------------------------------------------------
console.log("\n[5] Double-count guard: 'all' row preferred over per-agent rows");
{
  const raw = {
    totals: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, totalCost: 0 },
    daily: [
      { period: "2025-05-01", agent: "all", inputTokens: 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 100, totalCost: 0.1, modelsUsed: ["claude-opus-4-8", "gpt-5-codex"], metadata: { agents: ["claude", "codex"] } },
      { period: "2025-05-01", agent: "claude", inputTokens: 60, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 60, totalCost: 0.06, modelsUsed: ["claude-opus-4-8"] },
      { period: "2025-05-01", agent: "codex", inputTokens: 40, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 40, totalCost: 0.04, modelsUsed: ["gpt-5-codex"] },
    ],
  };
  const n = normalizeCcData(raw);
  ok("one row per date (no double-count)", n.daily.length === 1);
  ok("uses 'all' total (100, not 200)", n.daily[0].totalTokens === 100, `got ${n.daily[0].totalTokens}`);
  ok("tools union [claude, codex]", JSON.stringify(n.tools) === '["claude","codex"]');
}

// ---------------------------------------------------------------------------
console.log("\n[5b] Mixed payload: per-date strategy keeps per-agent-only days");
{
  const raw = {
    totals: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, totalCost: 0 },
    daily: [
      // date A has an aggregate "all" row + per-agent siblings -> use "all" only
      { period: "2025-05-01", agent: "all", inputTokens: 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 100, totalCost: 0.1, modelsUsed: ["claude-opus-4-8"], metadata: { agents: ["claude"] } },
      { period: "2025-05-01", agent: "claude", inputTokens: 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 100, totalCost: 0.1, modelsUsed: ["claude-opus-4-8"] },
      // date B has ONLY a per-agent row, no "all" -> must NOT be dropped
      { period: "2025-05-02", agent: "codex", inputTokens: 40, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 40, totalCost: 0.04, modelsUsed: ["gpt-5-codex"] },
    ],
  };
  const n = normalizeCcData(raw);
  ok("both dates kept", n.daily.length === 2, `got ${n.daily.length}`);
  ok("date A uses 'all' (100, not 200)", n.daily[0].totalTokens === 100, `got ${n.daily[0].totalTokens}`);
  ok("date B (per-agent only) preserved", n.daily[1]?.totalTokens === 40, `got ${n.daily[1]?.totalTokens}`);
  ok("tools union [claude, codex]", JSON.stringify(n.tools) === '["claude","codex"]');
}

// ---------------------------------------------------------------------------
console.log("\n[6] Bad input rejected");
{
  throws("empty daily", () => normalizeCcData({ totals: {} as any, daily: [] }), "non-empty array");
  throws("missing date and period", () =>
    normalizeCcData({ totals: {} as any, daily: [{ inputTokens: 1, outputTokens: 1, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 2, totalCost: 0 } as any] }),
    "Invalid date format"
  );
}

// ---------------------------------------------------------------------------
console.log("\n[7] Real cc.json (your machine, if present)");
{
  const path = process.argv[2];
  if (path) {
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const n = normalizeCcData(raw);
      ok("normalizes real data", n.daily.length > 0, `days=${n.daily.length}`);
      ok("real data has tools", n.tools.length > 0, `tools=${n.tools.join(",")}`);
      doesNotThrow("real data validates (was REJECTED before fix)", () => validateCcData(n));
      console.log(`     -> ${n.daily.length} days, tools: [${n.tools.join(", ")}], totalCost=$${n.totals.totalCost.toFixed(2)}, totalTokens=${n.totals.totalTokens.toLocaleString()}`);
    } catch (e) {
      console.log(`  (skipped real-data test: ${e instanceof Error ? e.message : e})`);
    }
  } else {
    console.log("  (no path arg given, skipping)");
  }
}

// ---------------------------------------------------------------------------
console.log("\n[8] Per-machine daily merge (#43)");
{
  const contrib = (cost: number, models: string[] = ["claude-opus-4-8"], agents: string[] = ["claude"]) => ({
    inputTokens: cost * 100,
    outputTokens: cost * 10,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: cost * 110,
    totalCost: cost,
    modelsUsed: models,
    agents,
  });

  // Two distinct machines on the same day -> SUM.
  const m1 = mergeMachineContribution(null, "machineA", contrib(15));
  const m2 = mergeMachineContribution(m1.contributions, "machineB", contrib(10));
  ok("distinct machines sum cost ($15+$10=$25)", m2.aggregate.totalCost === 25, `got ${m2.aggregate.totalCost}`);
  ok("distinct machines sum tokens", m2.aggregate.totalTokens === 110 * 25, `got ${m2.aggregate.totalTokens}`);
  ok("both machines tracked", Object.keys(m2.contributions).sort().join(",") === "machineA,machineB");

  // Same machine re-submits (ccusage is authoritative) -> REPLACE its slice, no double-count.
  const m3 = mergeMachineContribution(m2.contributions, "machineA", contrib(20));
  ok("same-machine re-submit replaces ($20+$10=$30, not $45)", m3.aggregate.totalCost === 30, `got ${m3.aggregate.totalCost}`);

  // Legacy row (null contributions) -> first id'd submission starts fresh.
  const legacy = mergeMachineContribution(null, "machineA", contrib(12));
  ok("legacy null starts at incoming ($12)", legacy.aggregate.totalCost === 12, `got ${legacy.aggregate.totalCost}`);

  // Models/agents unioned across machines.
  const u1 = mergeMachineContribution(null, "machineA", contrib(5, ["claude-opus-4-8"], ["claude"]));
  const u2 = mergeMachineContribution(u1.contributions, "machineB", contrib(5, ["gpt-5-codex"], ["codex"]));
  ok("agents unioned across machines", u2.aggregate.agents.sort().join(",") === "claude,codex");
  ok("models unioned across machines", u2.aggregate.modelsUsed.sort().join(",") === "claude-opus-4-8,gpt-5-codex");
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
