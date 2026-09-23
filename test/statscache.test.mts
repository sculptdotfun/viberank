import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { counterFiles, scanTranscripts, measureFactor, buildBackfill, MIN_FACTOR_DAYS } = await import(
  "../packages/viberank-cli/lib/statscache.js"
);
const { normalizeCcData, validateCcData } = await import("../src/lib/ccusage.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const MODEL = "claude-opus-4-8";
const PRICE = { input: 5e-6, output: 25e-6, cacheRead: 0.5e-6, cacheWrite: 6.25e-6 };
const PRICING = {
  [MODEL]: {
    input_cost_per_token: PRICE.input,
    output_cost_per_token: PRICE.output,
    cache_read_input_token_cost: PRICE.cacheRead,
    cache_creation_input_token_cost: PRICE.cacheWrite,
  },
};

// Two kinds of message, the way they really differ: a tool-calling turn is
// output-heavy and written as three content-block lines; a plain reply is
// mostly cache reads and written as one. So output is duplicated 3× by the
// counter and cache reads not at all.
const TOOL_TURN = { usage: { input_tokens: 10, output_tokens: 90, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, blocks: 3 };
const REPLY = { usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 }, blocks: 1 };

const root = fs.mkdtempSync(path.join(os.tmpdir(), "vb-statscache-"));
let seq = 0;
const message = (date: string, kind: typeof TOOL_TURN) => {
  const id = `msg_${++seq}`;
  return Array.from({ length: kind.blocks }, (_, i) =>
    JSON.stringify({
      type: "assistant",
      timestamp: `${date}T12:00:0${i}Z`,
      requestId: `req_${seq}`,
      uuid: `${id}-${i}`,
      message: { id, model: MODEL, usage: kind.usage },
    })
  );
};
const write = (rel: string, lines: string[]) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, lines.join("\n") + "\n");
};

// Six itemised days whose transcripts survive: 1,200 counter tokens each
// (300 + 900), 1,000 once deduplicated.
const reproduced = ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18"];
write("projects/p/main.jsonl", reproduced.flatMap((d) => [...message(d, TOOL_TURN), ...message(d, REPLY)]));
// A subagent transcript is part of the counter; a deeper workflow one is not.
write("projects/p/s1/subagents/agent-1.jsonl", message("2026-07-18", REPLY));
write("projects/p/s1/subagents/workflows/w/agent-2.jsonl", message("2026-07-18", TOOL_TURN));
// A day the counter skipped but whose transcript survives: ccusage measured it.
write("projects/p/late.jsonl", message("2026-07-21", TOOL_TURN));

const dmt = (date: string) => (date === "2026-07-18" ? 2_100 : 1_200);
// Itemised by the counter, transcripts gone.
const LOST = { "2026-07-22": 2_400, "2026-07-23": 1_200 };
const WINDOW_RAW = 1_200_000; // counter tokens before anything was itemised
const SKIPPED_WITH_TRANSCRIPT = 300; // what the counter added for 07-21

const cache = {
  version: 5,
  // Lifetime mix 1% input, 9% output, 90% cache reads: 1,212,000 tokens in all.
  modelUsage: { [MODEL]: { inputTokens: 12_120, outputTokens: 109_080, cacheReadInputTokens: 1_090_800, cacheCreationInputTokens: 0 } },
  dailyModelTokens: [
    ...reproduced.map((date) => ({ date, tokensByModel: { [MODEL]: dmt(date) } })),
    ...Object.entries(LOST).map(([date, tokens]) => ({ date, tokensByModel: { [MODEL]: tokens } })),
  ],
  dailyActivity: [
    { date: "2026-05-01", messageCount: 100 },
    { date: "2026-05-02", messageCount: 0 },
    { date: "2026-06-01", messageCount: 300 },
    ...reproduced.map((date) => ({ date, messageCount: 50 })),
    // Skipped, and no transcript: as invisible to ccusage as the window.
    { date: "2026-07-20", messageCount: 100 },
    { date: "2026-07-21", messageCount: 50 },
  ],
};
{
  const lifetime = Object.values(cache.modelUsage[MODEL]).reduce((a, b) => a + b, 0);
  const itemised = cache.dailyModelTokens.reduce((sum, d) => sum + d.tokensByModel[MODEL], 0);
  assert.equal(lifetime - itemised - SKIPPED_WITH_TRANSCRIPT, WINDOW_RAW, "fixture is self-consistent");
}

const files = counterFiles(root);
const scan = await scanTranscripts(files);

{
  assert.equal(files.length, 3, `expected main, late and one subagent transcript, got ${files.length}`);
  assert.ok(!files.some((f: string) => f.includes("workflows")), "workflow transcripts are not part of the counter");
  assert.equal(scan.firstDate, "2026-07-13");
  check("reads the transcripts the counter reads, and nothing deeper");
}

{
  const factors = measureFactor(cache, scan);
  assert.equal(factors.days.length, reproduced.length);
  assert.deepEqual(factors.byModel[MODEL].slice(0, 3), [3, 3, 1]);
  check("the duplication is measured per token type on days reproduced to the token");

  // A rewritten transcript no longer reproduces its day, so that day is left
  // out of the measurement rather than skewing it.
  const rewritten = structuredClone(cache);
  rewritten.dailyModelTokens[0].tokensByModel[MODEL] += 7;
  assert.equal(measureFactor(rewritten, scan).days.length, reproduced.length - 1);
  check("a day the transcripts no longer reproduce is left out of the factor");

  const tooFew = { ...cache, dailyModelTokens: cache.dailyModelTokens.slice(0, MIN_FACTOR_DAYS - 1) };
  assert.throws(() => measureFactor(tooFew, scan), /reproduced on only/);
  check(`fewer than ${MIN_FACTOR_DAYS} reproducible days refuses to estimate`);
}

{
  const report = buildBackfill(cache, scan, measureFactor(cache, scan), PRICING);
  const byDate = Object.fromEntries(report.daily.map((d: { date: string }) => [d.date, d]));

  assert.deepEqual(Object.keys(byDate), ["2026-05-01", "2026-06-01", "2026-07-20", "2026-07-22", "2026-07-23"]);
  assert.deepEqual(report.provenance.skippedDays, ["2026-07-20", "2026-07-21"]);
  assert.deepEqual(report.provenance.lostItemisedDays, ["2026-07-22", "2026-07-23"]);
  assert.equal(report.provenance.counterTokens, WINDOW_RAW + 2_400 + 1_200);
  check("the window takes untraceable days, subtracts measured ones, and adds itemised days whose transcripts are gone");

  // Each type is divided by its own factor: output ÷3, cache reads ÷1. A single
  // pooled factor would have divided everything by ~1.17 and overpriced output.
  const day = byDate["2026-06-01"]; // 300 of 500 window messages
  const raw = WINDOW_RAW * 0.6;
  assert.equal(day.outputTokens, (raw * 0.09) / 3);
  assert.equal(day.cacheReadTokens, raw * 0.9);
  assert.equal(day.totalTokens, (raw * 0.01) / 3 + (raw * 0.09) / 3 + raw * 0.9);
  check("each token type is divided by its own factor, spread by message counts");

  assert.equal(byDate["2026-07-22"].totalTokens, (2_400 * 0.1) / 3 + 2_400 * 0.9);
  check("an itemised day without transcripts is estimated from its exact counter total");

  const t = report.totals;
  const expectedCost = t.inputTokens * PRICE.input + t.outputTokens * PRICE.output + t.cacheReadTokens * PRICE.cacheRead;
  assert.ok(Math.abs(t.totalCost - expectedCost) < 1e-9, `cost ${t.totalCost} vs ${expectedCost}`);
  check("each model is priced per token type");

  assert.equal(report.provenance.estimated, true);
  const normalized = normalizeCcData(report);
  validateCcData(normalized);
  assert.deepEqual(normalized.tools, ["claude"]);
  check("the report passes the server's normaliser and validator as Claude-only");

  const bedrock = structuredClone(cache);
  bedrock.modelUsage["us.anthropic.claude-opus-4-8"] = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 5_000, cacheCreationInputTokens: 0 };
  const withBedrock = buildBackfill(bedrock, scan, measureFactor(bedrock, scan), PRICING);
  assert.deepEqual(withBedrock.provenance.nonClaudeModels, ["us.anthropic.claude-opus-4-8"]);
  assert.equal(withBedrock.totals.totalTokens, report.totals.totalTokens);
  check("a model the server wouldn't count as Claude is left out instead of sinking the estimate");

  const unpriced = buildBackfill(cache, scan, measureFactor(cache, scan), {});
  assert.equal(unpriced.daily.length, 0);
  assert.deepEqual(unpriced.provenance.unpricedModels, [MODEL]);
  check("a model with no price is left out and named, not submitted at $0");
}

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} passed, 0 failed`);
