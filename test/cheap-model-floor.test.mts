/**
 * #199: the per-model cost floor accepts honest cache-heavy workloads on
 * GLM-Flash, Beam, LongCat and OpenCode's "-free" proxies, and still rejects
 * inflated tokens on them.
 * Run: node --import tsx test/cheap-model-floor.test.mts
 */
const { validateCcData, minCostPerTokenForModel } = await import("../src/lib/ccusage.ts");

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

/** One model's slice: ~89% cache reads, the agentic shape from the issue. */
const mb = (modelName: string, tokens: number, cost: number) => {
  const cacheRead = Math.round(tokens * 0.89);
  return { modelName, inputTokens: tokens - cacheRead, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: cacheRead, cost };
};

/** A report spreading each model's usage evenly over `days` days. */
function report(models: ReturnType<typeof mb>[], days = 69) {
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(2026, 5, 7) + index * 86_400_000).toISOString().slice(0, 10);
    const split = models.map((m) => ({
      ...m,
      inputTokens: Math.round(m.inputTokens / days),
      cacheReadTokens: Math.round(m.cacheReadTokens / days),
      cost: m.cost / days,
    }));
    const input = split.reduce((a, m) => a + m.inputTokens, 0);
    const cacheRead = split.reduce((a, m) => a + m.cacheReadTokens, 0);
    return {
      date, inputTokens: input, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: cacheRead,
      totalTokens: input + cacheRead, totalCost: split.reduce((a, m) => a + m.cost, 0),
      modelsUsed: split.map((m) => m.modelName), agents: ["opencode"], modelBreakdowns: split,
    };
  });
  const sum = (key: "inputTokens" | "cacheReadTokens" | "totalTokens" | "totalCost") => daily.reduce((a, d) => a + d[key], 0);
  return {
    totals: {
      inputTokens: sum("inputTokens"), outputTokens: 0, cacheCreationTokens: 0,
      cacheReadTokens: sum("cacheReadTokens"), totalTokens: sum("totalTokens"), totalCost: sum("totalCost"),
    },
    daily,
  };
}

const passes = (data: unknown) => {
  try {
    validateCcData(data as never, new Date("2026-11-20T00:00:00Z"));
    return true;
  } catch {
    return false;
  }
};

console.log("[1] Floors by model family");
{
  ok("GLM Flash gets the intermediate floor", minCostPerTokenForModel("glm-5.3-flash-free") === 1e-8);
  ok("provider-prefixed GLM Flash too", minCostPerTokenForModel("zai/glm-5.3-flash") === 1e-8);
  ok("Beam", minCostPerTokenForModel("beam-free") === 1e-8);
  ok("Reflection's Beam by its full name", minCostPerTokenForModel("reflection/Beam-1.0-501B-A23B") === 1e-8);
  ok("LongCat", minCostPerTokenForModel("longcat-2.5-free") === 1e-8);
  ok("Nemotron Lightning", minCostPerTokenForModel("nemotron-3.5-lightning") === 1e-8);
  ok("unidentified OpenCode free proxies", minCostPerTokenForModel("space-bunny-free") === 1e-8);
  ok("the cheap families keep their lower floor", minCostPerTokenForModel("minimax-m3.1-flash-free") === 1e-9);
  ok("Claude keeps the default floor", minCostPerTokenForModel("claude-opus-4-8") === 1e-7);
  ok("full GLM (not Flash) keeps the default floor", minCostPerTokenForModel("glm-5.3") === 1e-7);
  ok("'free' inside a word does not count", minCostPerTokenForModel("freeform-coder") === 1e-7);
}

console.log("[2] The report from #199 (priced at the paid twins' list prices)");
{
  const issue = [
    mb("glm-5.3-flash-free", 155_000_000, 7.01),
    mb("beam-free", 232_000_000, 14.35),
    mb("longcat-2.5-free", 140_000_000, 3.11),
    mb("space-bunny-free", 566_000_000, 11.26),
    mb("pulse-alpha-free", 11_700_000, 0.19),
    mb("minimax-m3.1-flash-free", 601_000_000, 5),
    mb("big-pickle", 1_170_000_000, 19),
  ];
  ok("the honest report is accepted", passes(report(issue)));
  ok("GLM Flash alone at its list price is accepted", passes(report([mb("glm-5.3-flash-free", 155_000_000, 7.01)])));
  ok("LongCat alone at its list price is accepted", passes(report([mb("longcat-2.5-free", 140_000_000, 3.11)])));
}

console.log("[3] Inflation is still caught");
{
  ok("GLM Flash with 10x inflated tokens is rejected", !passes(report([mb("glm-5.3-flash-free", 1_550_000_000, 7.01)])));
  ok("a free proxy at 1e-9 per token is rejected", !passes(report([mb("space-bunny-free", 10_000_000_000, 10)])));
  ok("Claude at the GLM Flash ratio is still rejected", !passes(report([mb("claude-opus-4-8", 155_000_000, 7.01)])));
  ok("inflated Claude beside honest GLM Flash is rejected",
    !passes(report([mb("glm-5.3-flash-free", 155_000_000, 7.01), mb("claude-opus-4-8", 5_000_000_000, 20)])));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
