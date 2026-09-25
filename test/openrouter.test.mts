/**
 * CLI OpenRouter aggregation (packages/viberank-cli/lib/openrouter.js).
 *
 * Never calls the real API: the network helpers are driven with a fake fetch.
 */
import assert from "node:assert/strict";

const {
  aggregateActivity,
  buildPayload,
  keyScopePayload,
  accountScopePayload,
  readOpenRouterSpend,
  looksLikeOpenRouterKey,
} = await import("../packages/viberank-cli/lib/openrouter.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const row = (over: Record<string, unknown>) => ({
  date: "2026-09-20",
  model: "openai/gpt-4.1",
  model_permaslug: "openai/gpt-4.1-2025-04-14",
  endpoint_id: "ep-1",
  provider_name: "OpenAI",
  usage: 0,
  byok_usage_inference: 0,
  requests: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  reasoning_tokens: 0,
  ...over,
});

{
  // Same model, same day, two upstream endpoints: one per-model entry.
  const days = aggregateActivity([
    row({ endpoint_id: "ep-1", provider_name: "OpenAI", usage: 1.25, requests: 10, prompt_tokens: 1000, completion_tokens: 100 }),
    row({ endpoint_id: "ep-2", provider_name: "Azure", usage: 0.75, requests: 5, prompt_tokens: 500, completion_tokens: 50 }),
  ]);
  assert.equal(days.length, 1);
  assert.equal(days[0].models.length, 1, "endpoints of one model merge");
  assert.deepEqual(days[0].models[0], {
    model: "openai/gpt-4.1", usage: 2, byok: 0, requests: 15, promptTokens: 1500, completionTokens: 150,
  });
  assert.equal(days[0].usage, 2);
  assert.equal(days[0].requests, 15);
  check("endpoints of the same model on one day merge into one entry");
}

{
  const days = aggregateActivity([
    row({ date: "2026-09-22", usage: 1 }),
    row({ date: "2026-09-18", usage: 2 }),
    row({ date: "2026-09-20", usage: 3, model: "anthropic/claude-sonnet-4.5" }),
    row({ date: "2026-09-20", usage: 4 }),
  ]);
  assert.deepEqual(days.map((d: { date: string }) => d.date), ["2026-09-18", "2026-09-20", "2026-09-22"]);
  assert.deepEqual(days[1].models.map((m: { model: string }) => m.model), ["openai/gpt-4.1", "anthropic/claude-sonnet-4.5"],
    "models within a day sort by spend");
  assert.equal(days[1].usage, 7);
  check("days sort ascending and per-day totals sum across models");
}

{
  const days = aggregateActivity([
    row({ usage: 0.5, byok_usage_inference: 3 }),
    row({ model: "x/y", usage: 1, byok_usage_inference: 0.25 }),
  ]);
  assert.equal(days[0].usage, 1.5, "credits only");
  assert.equal(days[0].byok, 3.25, "BYOK summed apart");
  assert.equal(days[0].models.find((m: { model: string }) => m.model === "openai/gpt-4.1").byok, 3);
  check("BYOK spend stays separate from credit spend");
}

{
  const days = aggregateActivity([
    row({ usage: 0.1, reasoning_tokens: 30 }),
    row({ usage: 0.2, reasoning_tokens: 12 }),
  ]);
  assert.equal(days[0].usage, 0.3, "no 0.30000000000000004");
  assert.equal(days[0].reasoningTokens, 42);
  check("money is rounded to micro-dollars and reasoning tokens are summed per day");
}

{
  assert.deepEqual(aggregateActivity([]), []);
  assert.deepEqual(aggregateActivity(undefined), []);
  assert.deepEqual(aggregateActivity([{ date: "garbage", usage: 5 }, null]), []);
  const p = accountScopePayload({ total_credits: 50, total_usage: 12.5 }, []);
  assert.deepEqual(p, { scope: "account", lifetime: { usd: 12.5, byokUsd: null }, days: [] });
  check("empty or junk input yields no days, and an idle account still reports its all-time total");
}

{
  const today = new Date("2026-09-26T15:00:00Z");
  const p = keyScopePayload({ usage: 88.4, usage_daily: 2.5, byok_usage: 4, byok_usage_daily: 0.5, is_management_key: false }, today);
  assert.equal(p.scope, "key");
  assert.deepEqual(p.lifetime, { usd: 88.4, byokUsd: 4 });
  assert.equal(p.days.length, 1);
  assert.equal(p.days[0].date, "2026-09-26", "today's usage_daily becomes today's UTC row");
  assert.equal(p.days[0].usage, 2.5);
  assert.equal(p.days[0].byok, 0.5);
  assert.deepEqual(p.days[0].models, [], "a normal key has no per-model split");

  const idle = keyScopePayload({ usage: 10, usage_daily: 0 }, today);
  assert.deepEqual(idle.days, [], "no zero row for an idle day");
  assert.equal(idle.lifetime.byokUsd, null, "unknown BYOK is null, not zero");
  check("key-scope payload: cumulative key usage plus today's row");
}

{
  assert.deepEqual(buildPayload({ scope: "account", lifetimeUsd: -3 }).lifetime, { usd: 0, byokUsd: null });
  assert.equal(looksLikeOpenRouterKey("sk-or-v1-0123456789abcdef"), true);
  assert.equal(looksLikeOpenRouterKey("vbr_nope"), false);
  assert.equal(looksLikeOpenRouterKey(undefined), false);
  check("payload clamps junk amounts and the key shape check is loose but not empty");
}

// ---------------------------------------------------------------------------
// Network flow with a fake fetch
// ---------------------------------------------------------------------------

function fakeFetch(routes: Record<string, { status: number; body: unknown }>) {
  const calls: string[] = [];
  const impl = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push(url);
    assert.equal(init?.headers?.Authorization, "Bearer sk-or-v1-testkey000000", "key goes only to OpenRouter");
    const path = url.replace("https://openrouter.ai/api/v1", "");
    const hit = routes[path] ?? { status: 404, body: {} };
    return { ok: hit.status < 400, status: hit.status, json: async () => hit.body };
  };
  return { impl, calls };
}

{
  const { impl, calls } = fakeFetch({
    "/key": { status: 200, body: { data: { is_management_key: true, label: "mgmt" } } },
    "/credits": { status: 200, body: { data: { total_credits: 500, total_usage: 321.5 } } },
    "/activity": { status: 200, body: { data: [row({ usage: 3 }), row({ usage: 1, endpoint_id: "ep-2" })] } },
  });
  const { payload } = await readOpenRouterSpend("sk-or-v1-testkey000000", impl);
  assert.equal(payload.scope, "account");
  assert.equal(payload.lifetime.usd, 321.5);
  assert.equal(payload.days[0].usage, 4);
  assert.ok(calls.every((u) => u.startsWith("https://openrouter.ai/")));
  check("a management key reads /credits for all-time spend and /activity for the days");
}

{
  const { impl, calls } = fakeFetch({
    "/key": { status: 200, body: { data: { is_management_key: false, usage: 9, usage_daily: 1 } } },
  });
  const { payload } = await readOpenRouterSpend("sk-or-v1-testkey000000", impl, new Date("2026-09-26T00:00:00Z"));
  assert.equal(payload.scope, "key");
  assert.equal(calls.length, 1, "a normal key never tries /credits or /activity");
  check("a normal key falls back to /key alone");
}

{
  const { impl, calls } = fakeFetch({
    "/key": { status: 200, body: { data: { usage: 9, usage_daily: 1 } } },
    "/credits": { status: 403, body: {} },
  });
  const { payload } = await readOpenRouterSpend("sk-or-v1-testkey000000", impl, new Date("2026-09-26T00:00:00Z"));
  assert.equal(payload.scope, "key");
  assert.equal(payload.lifetime.usd, 9);
  assert.equal(calls.length, 2);
  check("without the management flag, /credits decides the scope");
}

{
  const { impl } = fakeFetch({ "/key": { status: 401, body: {} }, "/credits": { status: 401, body: {} } });
  await assert.rejects(readOpenRouterSpend("sk-or-v1-testkey000000", impl), /rejected the key/);
  check("a rejected key fails with a readable message");
}

console.log(`\n${passed} checks passed`);
