import assert from "node:assert/strict";

const { normalizeCcData, mergeMachineContribution } = await import("../src/lib/ccusage.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const slice = (cost: number, tok: number) => ({
  inputTokens: tok, outputTokens: 0, cacheCreationTokens: 0,
  cacheReadTokens: 0, totalTokens: tok, totalCost: cost,
});
const contrib = (cost: number, tok: number, byAgent?: Record<string, ReturnType<typeof slice>>) => ({
  ...slice(cost, tok), modelsUsed: ["m"], agents: Object.keys(byAgent ?? {}),
  ...(byAgent ? { agentBreakdowns: byAgent } : {}),
});

/* ---------- normalization ---------- */

const rawDay = (extra: Record<string, unknown> = {}) => ({
  date: "2026-05-01",
  inputTokens: 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
  totalTokens: 100, totalCost: 10, modelsUsed: ["claude-opus-4-8"],
  metadata: { agents: ["claude", "codex"] },
  ...extra,
});

{
  const n = normalizeCcData({ totals: {}, daily: [rawDay({
    agents: [
      { agent: "claude", inputTokens: 60, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 60, totalCost: 6 },
      { agent: "codex",  inputTokens: 40, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 40, totalCost: 4 },
    ],
  })] } as never);
  assert.deepEqual(Object.keys(n.daily[0].agentBreakdowns!).sort(), ["claude", "codex"]);
  assert.equal(n.daily[0].agentBreakdowns!.claude.totalCost, 6);
  check("a --by-agent report keeps its per-agent split");
}

{
  // A split that does not add up to the row is a malformed or hostile payload:
  // storing it would let a caller inflate one agent behind a believable total.
  const n = normalizeCcData({ totals: {}, daily: [rawDay({
    agents: [
      { agent: "claude", inputTokens: 60, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 60, totalCost: 999 },
    ],
  })] } as never);
  assert.equal(n.daily[0].agentBreakdowns, undefined);
  assert.equal(n.daily[0].totalCost, 10, "the day's own total is untouched");
  check("a split that doesn't reconcile with the day is discarded");
}

{
  const n = normalizeCcData({ totals: {}, daily: [rawDay()] } as never);
  assert.equal(n.daily[0].agentBreakdowns, undefined);
  check("a report without --by-agent normalizes exactly as before");
}

/* ---------- the #125 fix ---------- */

{
  // Claude transcripts pruned; Codex untouched. Before the fix the whole slice
  // was swapped and the Codex $40 vanished with it.
  const prior = { laptop: contrib(100, 1000, { claude: slice(60, 600), codex: slice(40, 400) }) };
  const incoming = contrib(60, 600, { claude: slice(20, 200), codex: slice(40, 400) });
  const r = mergeMachineContribution(prior, "laptop", incoming, true);
  assert.equal(r.aggregate.totalCost, 60, "claude 20 lowered + codex 40 retained");
  assert.equal(r.contributions.laptop.agentBreakdowns!.codex.totalCost, 40);
  assert.equal(r.contributions.laptop.agentBreakdowns!.claude.totalCost, 20);
  check("a Claude cleanup lowers Claude alone and leaves Codex whole (#125)");
}

{
  // A month the user really did clear: Claude drops out of the report entirely
  // and must not be preserved, while Codex still stands.
  const prior = { laptop: contrib(100, 1000, { claude: slice(60, 600), codex: slice(40, 400) }) };
  const incoming = contrib(40, 400, { codex: slice(40, 400) });
  const r = mergeMachineContribution(prior, "laptop", incoming, true);
  assert.equal(r.aggregate.totalCost, 40);
  assert.equal(r.contributions.laptop.agentBreakdowns!.claude, undefined,
    "a deleted month is honoured, not held at its high-water mark");
  check("deletion is still honoured for the tool the corpus is evidence about");
}

{
  // Without acceptLower nothing changes: the high-water mark still wins.
  const prior = { laptop: contrib(100, 1000, { claude: slice(60, 600), codex: slice(40, 400) }) };
  const r = mergeMachineContribution(prior, "laptop", contrib(60, 600, { claude: slice(20, 200), codex: slice(40, 400) }), false);
  assert.equal(r.aggregate.totalCost, 100);
  assert.equal(r.retainedPrior, true);
  check("an ordinary lower re-report still holds the high-water mark (#83)");
}

{
  // The board is mostly older payloads. They must behave exactly as before.
  const prior = { laptop: contrib(100, 1000) };
  const r = mergeMachineContribution(prior, "laptop", contrib(60, 600), true);
  assert.equal(r.aggregate.totalCost, 60, "no split available -> whole-slice swap, unchanged");
  check("payloads with no split fall back to the old behaviour");
}

{
  // One side new, one side old — the common shape during rollout.
  const prior = { laptop: contrib(100, 1000) };
  const r = mergeMachineContribution(prior, "laptop", contrib(60, 600, { claude: slice(60, 600) }), true);
  assert.equal(r.aggregate.totalCost, 60);
  check("a half-upgraded pair falls back rather than guessing a split");
}

console.log(`\n${passed} checks passed`);
