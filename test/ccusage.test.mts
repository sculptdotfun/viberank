/**
 * Tests for ccusage normalization + validation.
 * Run: pnpm test [path-to-cc.json]
 *
 * No test framework in this repo, so this is a tiny self-contained harness.
 */
import { readFileSync } from "node:fs";
// Dynamic import: Node's native .ts loader reparses as ESM at runtime, so a
// static `import {…} from "….ts"` fails name resolution; dynamic import works.
const { normalizeCcData, validateCcData, mergeMachineContribution, combineContributionMaps, estimatedSliceKey, dayIsEstimated } = await import("../src/lib/ccusage.ts");

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
  // heavy cache-read user: totalTokens trips the old absolute cap but
  // non-cache-read tokens are well under it, cost is far below the cap, and the
  // cost/token ratio is in band -> must be accepted (#77).
  doesNotThrow(
    "cache-read-heavy submission accepted (was rejected by token cap)",
    () =>
      validateCcData(
        {
          totals: {
            inputTokens: 25_000_000_000,
            outputTokens: 113_577_997,
            cacheCreationTokens: 0,
            cacheReadTokens: 66_351_156_098,
            totalTokens: 91_464_734_095,
            totalCost: 44_218,
          },
          daily: [
            {
              date: "2025-01-01",
              inputTokens: 25_000_000_000,
              outputTokens: 113_577_997,
              cacheCreationTokens: 0,
              cacheReadTokens: 66_351_156_098,
              totalTokens: 91_464_734_095,
              totalCost: 44_218,
              modelsUsed: ["claude-opus-4-8"],
              agents: ["claude"],
            },
          ],
        },
        FIXED_NOW
      )
  );
  // but inflating *non-cache-read* tokens past the cap is still rejected (cap
  // still bites when cache reads aren't doing the inflating).
  throws(
    "non-cache-read tokens over cap still rejected",
    () =>
      validateCcData(
        {
          totals: { inputTokens: 100_000_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 100_000_000_000, totalCost: 1_000_000 },
          daily: [{ date: "2025-01-01", inputTokens: 100_000_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 100_000_000_000, totalCost: 1_000_000, modelsUsed: [], agents: [] }],
        },
        FIXED_NOW
      ),
    "Total tokens exceed realistic limits"
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

// ---------------------------------------------------------------------------
console.log("\n[9] Default bucket never sums against id'd slices (#81) — and is never deleted (#138)");
{
  const contrib = (cost: number, agents = ["claude"]) => ({
    inputTokens: cost * 100,
    outputTokens: cost * 10,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: cost * 110,
    totalCost: cost,
    modelsUsed: ["claude-opus-4-8"],
    agents,
  });

  // The #81 doubling: no-id submission filled "default", then the same machine
  // re-submits with an id. The day must not become $30.
  const d1 = mergeMachineContribution(null, "default", contrib(15));
  const d2 = mergeMachineContribution(d1.contributions, "machineA", contrib(15));
  ok("id'd submission over default does not double ($15, not $30)", d2.aggregate.totalCost === 15, `got ${d2.aggregate.totalCost}`);
  ok("default slice is kept, not deleted", Object.keys(d2.contributions).sort().join(",") === "default,machineA");

  // Id'd slices survive an id'd submission from another machine.
  const d3 = mergeMachineContribution(d2.contributions, "machineB", contrib(10));
  ok("distinct id'd machines still sum ($15+$10=$25)", d3.aggregate.totalCost === 25, `got ${d3.aggregate.totalCost}`);

  // #138: a no-id upload used to replace the whole day, wiping machineA and
  // machineB. Now it is one more observation: the day shows the larger view.
  const d4 = mergeMachineContribution(d3.contributions, "default", contrib(30));
  ok("larger no-id upload holds the day up ($30, not $55)", d4.aggregate.totalCost === 30, `got ${d4.aggregate.totalCost}`);
  ok("id'd slices survive a no-id upload", Object.keys(d4.contributions).sort().join(",") === "default,machineA,machineB");

  const small = mergeMachineContribution(d3.contributions, "default", contrib(5, ["claude"]));
  ok("smaller no-id upload cannot wipe other machines ($25 kept)", small.aggregate.totalCost === 25, `got ${small.aggregate.totalCost}`);

  // No-id re-submit over a default-only day is a high-water mark like any slice.
  const d5 = mergeMachineContribution(d4.contributions, "default", contrib(12));
  ok("lower no-id re-report keeps the observed high ($30)", d5.aggregate.totalCost === 30, `got ${d5.aggregate.totalCost}`);
}

console.log("\n[10] Claim merge combines rows without losing any (#152)");
{
  const contrib = (cost: number, tokens = cost * 110) => ({
    inputTokens: tokens, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
    totalTokens: tokens, totalCost: cost, modelsUsed: ["claude-opus-4-8"], agents: ["claude"],
  });

  // The reported case: CLI row held $38k-scale history for machineA, a later
  // web upload (no id) held a shorter, lower view of the same day.
  const cliRow = { machineA: contrib(100) };
  const webRow = { default: contrib(60) };
  const merged = combineContributionMaps([webRow, cliRow]);
  ok("lower web upload does not replace a higher CLI day ($100)", merged.aggregate.totalCost === 100, `got ${merged.aggregate.totalCost}`);
  ok("both observations are kept", Object.keys(merged.contributions).sort().join(",") === "default,machineA");

  const higherWeb = combineContributionMaps([cliRow, { default: contrib(140) }]);
  ok("a genuinely higher upload still wins ($140)", higherWeb.aggregate.totalCost === 140, `got ${higherWeb.aggregate.totalCost}`);

  // The same machine in two rows is one machine: keep its larger slice, never sum.
  const same = combineContributionMaps([{ machineA: contrib(40) }, { machineA: contrib(70) }]);
  ok("same machine across rows is high-water, not summed ($70)", same.aggregate.totalCost === 70, `got ${same.aggregate.totalCost}`);

  // Distinct machines across rows add up, exactly as they would in one row.
  const two = combineContributionMaps([{ machineA: contrib(40) }, { machineB: contrib(70) }]);
  ok("distinct machines across rows sum ($110)", two.aggregate.totalCost === 110, `got ${two.aggregate.totalCost}`);

  // Unpriced models: tokens break the $0 tie.
  const unpriced = combineContributionMaps([{ machineA: contrib(0, 1_000) }, { machineA: contrib(0, 5_000) }]);
  ok("tokens break ties for unpriced models", unpriced.aggregate.totalTokens === 5_000, `got ${unpriced.aggregate.totalTokens}`);
}

console.log("\n[10b] Estimated slices sum with measured ones, and step aside for measured Claude (#138)");
{
  const contrib = (cost: number, models: string[], agents: string[]) => ({
    inputTokens: cost * 100, outputTokens: cost * 10, cacheCreationTokens: 0, cacheReadTokens: 0,
    totalTokens: cost * 110, totalCost: cost, modelsUsed: models, agents,
  });
  const codex = contrib(40, ["gpt-5.5"], ["codex"]);
  const claude = contrib(25, ["claude-opus-4-8"], ["claude"]);
  const est = estimatedSliceKey("machineA");

  // The case the flag exists for: the machine measured Codex that day, and
  // Claude's transcripts are gone. Under one machine key the high-water mark
  // would keep only the larger of the two; as its own slice the estimate adds.
  const e1 = mergeMachineContribution({ machineA: codex }, est, contrib(60, ["claude-opus-4-8"], ["claude"]));
  ok("estimate adds to the machine's measured Codex ($40+$60=$100)", e1.aggregate.totalCost === 100, `got ${e1.aggregate.totalCost}`);
  ok("the day counts as estimated", dayIsEstimated(e1.contributions));
  ok("the measured slice is untouched", e1.contributions.machineA.totalCost === 40);

  // Re-running the backfill is a high-water mark like any slice, never a sum.
  const e2 = mergeMachineContribution(e1.contributions, est, contrib(60, ["claude-opus-4-8"], ["claude"]));
  ok("re-submitting the same estimate does not double ($100)", e2.aggregate.totalCost === 100, `got ${e2.aggregate.totalCost}`);
  // An estimate is recomputed, not re-read, so a lower re-estimate replaces
  // the older one instead of losing to it under the high-water mark (#83).
  const lower = mergeMachineContribution(e1.contributions, est, contrib(48, ["claude-opus-4-8"], ["claude"]));
  ok("a lower re-estimate replaces the older one ($40+$48=$88)", lower.aggregate.totalCost === 88, `got ${lower.aggregate.totalCost}`);
  ok("and is not reported as drift", !lower.retainedPrior);

  // Once Claude is measured for the day, the estimate stops counting — in
  // either arrival order.
  const e3 = mergeMachineContribution(e1.contributions, "machineA", contrib(65, ["gpt-5.5", "claude-opus-4-8"], ["codex", "claude"]));
  ok("measured Claude replaces the estimate ($65, not $125)", e3.aggregate.totalCost === 65, `got ${e3.aggregate.totalCost}`);
  ok("and the day no longer counts as estimated", !dayIsEstimated(e3.contributions));
  const e4 = mergeMachineContribution({ machineA: claude }, est, contrib(60, ["claude-opus-4-8"], ["claude"]));
  ok("an estimate arriving after measured Claude adds nothing ($25)", e4.aggregate.totalCost === 25, `got ${e4.aggregate.totalCost}`);

  // Legacy slices without agents still count as Claude by model name.
  const e5 = mergeMachineContribution({ machineA: contrib(25, ["claude-opus-4-8"], []) }, est, contrib(60, ["claude-opus-4-8"], ["claude"]));
  ok("measured Claude is recognised by model name too ($25)", e5.aggregate.totalCost === 25, `got ${e5.aggregate.totalCost}`);

  // The machine id is the client's claim, so an estimate filed under another
  // (or invented) id must not add to Claude measured under the real one.
  const e6 = mergeMachineContribution({ machineB: claude }, est, contrib(60, ["claude-opus-4-8"], ["claude"]));
  ok("measured Claude from any machine cancels the estimate ($25)", e6.aggregate.totalCost === 25, `got ${e6.aggregate.totalCost}`);
  const e7 = mergeMachineContribution({ default: contrib(20, ["claude-opus-4-8"], ["claude"]) }, est, contrib(60, ["claude-opus-4-8"], ["claude"]));
  ok("so does unattributed Claude ($20)", e7.aggregate.totalCost === 20, `got ${e7.aggregate.totalCost}`);

  // An estimate is attributed: a Codex-only unattributed slice still only holds the day up.
  const e8 = mergeMachineContribution({ default: contrib(150, ["gpt-5.5"], ["codex"]) }, est, contrib(60, ["claude-opus-4-8"], ["claude"]));
  ok("a larger unattributed slice still holds the day ($150)", e8.aggregate.totalCost === 150, `got ${e8.aggregate.totalCost}`);

  // The claim merge keeps the same rules.
  const merged = combineContributionMaps([{ machineA: codex }, { [est]: contrib(60, ["claude-opus-4-8"], ["claude"]) }]);
  ok("claim merge sums an estimate from another row ($100)", merged.aggregate.totalCost === 100, `got ${merged.aggregate.totalCost}`);
  ok("measured-only days are not estimated", !dayIsEstimated({ machineA: codex }));
}

console.log("\n[11] Cost floor is priced per model (#150, #154)");
{
  const mb = (modelName: string, cacheRead: number, io: number, cost: number) => ({
    modelName, inputTokens: io, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: cacheRead, cost,
  });
  const report = (models: ReturnType<typeof mb>[], extraTokens = 0) => {
    const tokens = models.reduce((a, m) => a + m.inputTokens + m.cacheReadTokens, 0) + extraTokens;
    const cost = models.reduce((a, m) => a + m.cost, 0);
    const cacheRead = models.reduce((a, m) => a + m.cacheReadTokens, 0);
    return {
      totals: { inputTokens: tokens - cacheRead, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: cacheRead, totalTokens: tokens, totalCost: cost },
      daily: [{ date: "2026-09-01", inputTokens: tokens - cacheRead, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: cacheRead,
        totalTokens: tokens, totalCost: cost, modelsUsed: models.map((m) => m.modelName), agents: ["opencode"], modelBreakdowns: models }],
    };
  };
  const passes = (d: unknown) => { try { validateCcData(d as never); return true; } catch { return false; } };

  // #150: OpenCode on MiMo + the unpriced big-pickle, ~2e-8 per token.
  const opencode = report([mb("mimo-v2.5", 2_350_054_304, 118_066_095, 51.18), mb("big-pickle", 234_308_288, 12_258_444, 0)]);
  ok("honest MiMo/big-pickle report is accepted", passes(opencode));

  // #154: DeepSeek Harness, 99% cache reads at 2% of the miss price.
  const deepseek = report([mb("deepseek-flash", 16_760_000_000, 142_020_120, 109.59)]);
  ok("honest DeepSeek report is accepted", passes(deepseek));
  ok("DeepSeek with 100x inflated cache reads is rejected",
    !passes(report([mb("deepseek-flash", 1_676_000_000_000, 142_020_120, 109.59)])));

  // The floor follows the model, not the tool or agent tag.
  ok("the same ratio on a Claude model is still rejected",
    !passes(report([mb("claude-opus-4-8", 16_760_000_000, 142_020_120, 109.59)])));

  // A cheap model can't launder inflated Claude tokens in the same report.
  ok("inflated Claude tokens beside a cheap model are rejected",
    !passes(report([mb("deepseek-flash", 16_760_000_000, 142_020_120, 109.59), mb("claude-opus-4-8", 50_000_000_000, 0, 20)])));

  // Tokens beyond the per-model split are charged at the day's cheapest floor.
  ok("unsplit tokens on a Claude-only day keep the default floor",
    !passes(report([mb("claude-opus-4-8", 1_000_000, 0, 5)], 100_000_000_000)));

  // Default-floor-only reports behave exactly as before: 1e-7 per token.
  ok("Claude report just above 1e-7 passes", passes(report([mb("claude-opus-4-8", 1_000_000_000, 0, 101)])));
  ok("Claude report just below 1e-7 fails", !passes(report([mb("claude-opus-4-8", 1_000_000_000, 0, 99)])));
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
