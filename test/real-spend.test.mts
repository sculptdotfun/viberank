/**
 * Real spend: payload validation, read-side aggregates, and the data-layer
 * upsert against a fake PostgREST client (see submissions.test.mts for why
 * dependencies are injected rather than module-mocked).
 */
import assert from "node:assert/strict";

const {
  validateSpendPayload,
  summarizeRealSpend,
  aggregateRealSpendStats,
  last30Start,
  SPEND_LIMITS,
} = await import("../src/lib/real-spend.ts");
const { SupabaseSpendService } = await import("../src/lib/data/supabase/client.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const NOW = new Date("2026-09-26T12:00:00Z");

const day = (over: Record<string, unknown> = {}) => ({
  date: "2026-09-20",
  usage: 4.5,
  byok: 0,
  requests: 12,
  promptTokens: 1000,
  completionTokens: 200,
  models: [{ model: "openai/gpt-4.1", usage: 4.5, byok: 0, requests: 12, promptTokens: 1000, completionTokens: 200 }],
  ...over,
});
const payload = (over: Record<string, unknown> = {}) => ({
  scope: "account",
  lifetime: { usd: 321.5, byokUsd: null },
  days: [day()],
  ...over,
});
const rejects = (input: unknown, pattern: RegExp) => {
  const r = validateSpendPayload(input, NOW);
  assert.equal(r.ok, false, `expected rejection matching ${pattern}`);
  if (!r.ok) assert.match(r.error, pattern);
};

// ---------------------------------------------------------------------------
// validateSpendPayload: one case per rule
// ---------------------------------------------------------------------------

{
  const r = validateSpendPayload(payload(), NOW);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.days[0].usage, 4.5);
    assert.equal(r.value.lifetime.byokUsd, null);
  }
  check("a well-formed account payload is accepted");
}

{
  rejects(null, /JSON object/);
  rejects([], /JSON object/);
  check("rule: body is an object");
}

{
  rejects(payload({ scope: "team" }), /scope/);
  rejects(payload({ scope: undefined }), /scope/);
  assert.equal(validateSpendPayload(payload({ scope: "key" }), NOW).ok, true);
  check("rule: scope is 'account' or 'key'");
}

{
  rejects(payload({ lifetime: undefined }), /lifetime is required/);
  rejects(payload({ lifetime: { usd: -1, byokUsd: null } }), /lifetime.usd/);
  rejects(payload({ lifetime: { usd: SPEND_LIMITS.maxLifetimeUsd, byokUsd: null } }), /lifetime.usd/);
  rejects(payload({ lifetime: { usd: "12", byokUsd: null } }), /lifetime.usd/);
  assert.equal(validateSpendPayload(payload({ lifetime: { usd: 9_999_999.99, byokUsd: null } }), NOW).ok, true);
  check("rule: lifetime is non-negative and below $10M");
}

{
  rejects(payload({ lifetime: { usd: 1, byokUsd: -2 } }), /byokUsd/);
  assert.equal(validateSpendPayload(payload({ lifetime: { usd: 1, byokUsd: 3 } }), NOW).ok, true);
  assert.equal(validateSpendPayload(payload({ lifetime: { usd: 1 } }), NOW).ok, true, "absent BYOK reads as null");
  check("rule: lifetime BYOK is null or a non-negative amount");
}

{
  rejects(payload({ days: "nope" }), /days must be an array/);
  const many = Array.from({ length: 32 }, (_, i) =>
    day({ date: new Date(Date.UTC(2026, 8, 26) - i * 86400000).toISOString().slice(0, 10) })
  );
  rejects(payload({ days: many }), /At most 31 days/);
  assert.equal(validateSpendPayload(payload({ days: many.slice(0, 31) }), NOW).ok, true);
  check("rule: at most 31 days");
}

{
  rejects(payload({ days: [day({ date: "2026-9-20" })] }), /Invalid date/);
  rejects(payload({ days: [day({ date: "2026-02-30" })] }), /Invalid date/);
  rejects(payload({ days: [day({ date: 20260920 })] }), /Invalid date/);
  check("rule: dates are real YYYY-MM-DD dates");
}

{
  rejects(payload({ days: [day({ date: "2026-09-27" })] }), /Future date/);
  assert.equal(validateSpendPayload(payload({ days: [day({ date: "2026-09-26" })] }), NOW).ok, true, "today is fine");
  check("rule: no future dates (UTC)");
}

{
  rejects(payload({ days: [day({ date: "2026-08-16" })] }), /older than 40 days/);
  assert.equal(validateSpendPayload(payload({ days: [day({ date: "2026-08-17" })] }), NOW).ok, true, "exactly 40 days back is fine");
  check("rule: dates within the last 40 days");
}

{
  rejects(payload({ days: [day(), day()] }), /Duplicate date/);
  check("rule: one entry per date");
}

{
  rejects(payload({ days: [day({ usage: -0.01 })] }), /usage must be/);
  rejects(payload({ days: [day({ requests: Number.NaN })] }), /requests must be/);
  rejects(payload({ days: [day({ promptTokens: Infinity })] }), /promptTokens must be/);
  rejects(payload({ days: [day({ completionTokens: "5" })] }), /completionTokens must be/);
  rejects(payload({ days: [day({ models: [{ model: "a", usage: -1, byok: 0, requests: 0, promptTokens: 0, completionTokens: 0 }] })] }), /usage must be/);
  check("rule: every number is finite and non-negative, days and models alike");
}

{
  rejects(payload({ days: [day({ usage: SPEND_LIMITS.maxDayUsd })] }), /below \$100000/);
  rejects(payload({ days: [day({ byok: 100_000 })] }), /below \$100000/);
  assert.equal(validateSpendPayload(payload({ days: [day({ usage: 99_999.99, models: [] })] }), NOW).ok, true);
  check("rule: per-day cost below $100,000");
}

{
  const m = (i: number) => ({ model: `m/${i}`, usage: 0, byok: 0, requests: 0, promptTokens: 0, completionTokens: 0 });
  rejects(payload({ days: [day({ models: Array.from({ length: 201 }, (_, i) => m(i)) })] }), /at most 200 models/);
  assert.equal(validateSpendPayload(payload({ days: [day({ models: Array.from({ length: 200 }, (_, i) => m(i)) })] }), NOW).ok, true);
  check("rule: at most 200 models per day");
}

{
  const m = { usage: 0, byok: 0, requests: 0, promptTokens: 0, completionTokens: 0 };
  rejects(payload({ days: [day({ models: [{ ...m, model: "x".repeat(201) }] })] }), /model names/);
  rejects(payload({ days: [day({ models: [{ ...m, model: "" }] })] }), /model names/);
  rejects(payload({ days: [day({ models: [{ ...m, model: 7 }] })] }), /model names/);
  assert.equal(validateSpendPayload(payload({ days: [day({ models: [{ ...m, model: "x".repeat(200) }] })] }), NOW).ok, true);
  check("rule: model names are 1-200 characters");
}

{
  const r = validateSpendPayload(payload({ days: [day({ requests: 12.9, reasoningTokens: 5, extra: "dropped" })] }), NOW);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.days[0].requests, 12, "counts are truncated to integers");
    assert.ok(!("extra" in r.value.days[0]), "unknown fields are not carried through");
  }
  check("the accepted payload is normalized, not passed through");
}

// ---------------------------------------------------------------------------
// Read-side aggregates
// ---------------------------------------------------------------------------

{
  assert.equal(last30Start(NOW), "2026-08-27");
  const spend = summarizeRealSpend(
    [
      { date: "2026-09-25", cost_usd: "2.5", byok_cost_usd: 0, requests: 3, prompt_tokens: 1, completion_tokens: 1, models: [] },
      { date: "2026-07-01", cost_usd: 10, byok_cost_usd: null, requests: 1, prompt_tokens: 1, completion_tokens: 1, models: null },
      { date: "2026-08-27", cost_usd: 1, byok_cost_usd: 0, requests: 1, prompt_tokens: 1, completion_tokens: 1, models: [] },
    ],
    { scope: "key", lifetime_usd: "99.5", lifetime_byok_usd: null, observed_at: "2026-09-26T00:00:00Z" },
    NOW
  );
  assert.deepEqual(spend.days.map((d) => d.date), ["2026-07-01", "2026-08-27", "2026-09-25"]);
  assert.equal(spend.last30Usd, 3.5, "window starts 30 days before today, inclusive");
  assert.equal(spend.windowUsd, 13.5, "every stored day");
  assert.deepEqual(spend.lifetime, { usd: 99.5, byokUsd: null, scope: "key", observedAt: "2026-09-26T00:00:00Z" });
  assert.equal(summarizeRealSpend([], null, NOW).lifetime, null);
  check("summarizeRealSpend: sorted days, last-30 and stored-window sums, NUMERIC strings read as numbers");
}

{
  const stats = aggregateRealSpendStats(
    [
      { username: "a", scope: "account", lifetime_usd: 10, lifetime_byok_usd: null, observed_at: "" },
      { username: "b", scope: "account", lifetime_usd: 30, lifetime_byok_usd: null, observed_at: "" },
      { username: "c", scope: "key", lifetime_usd: "20", lifetime_byok_usd: null, observed_at: "" },
      { username: "d", scope: "account", lifetime_usd: 100, lifetime_byok_usd: null, observed_at: "" },
    ],
    [
      { date: "2026-09-20", cost_usd: 5, byok_cost_usd: 0, requests: 0, prompt_tokens: 0, completion_tokens: 0,
        models: [{ model: "x/a", usage: 3, byok: 0, requests: 0, promptTokens: 0, completionTokens: 0 },
                 { model: "x/b", usage: 2, byok: 0, requests: 0, promptTokens: 0, completionTokens: 0 }] },
      { date: "2026-09-21", cost_usd: 4, byok_cost_usd: 0, requests: 0, prompt_tokens: 0, completion_tokens: 0,
        models: [{ model: "x/b", usage: 4, byok: 0, requests: 0, promptTokens: 0, completionTokens: 0 }] },
    ]
  );
  assert.equal(stats.developers, 4);
  assert.equal(stats.lifetimeUsd, 160);
  assert.equal(stats.last30Usd, 9);
  assert.equal(stats.medianLifetimeUsd, 25, "even count averages the middle pair");
  assert.deepEqual(stats.topModels, [{ model: "x/b", usd: 6 }, { model: "x/a", usd: 3 }]);
  check("aggregateRealSpendStats: count, sums, median and top models");
}

// ---------------------------------------------------------------------------
// Data layer: SupabaseSpendService against a fake client
// ---------------------------------------------------------------------------

interface Call { table: string; op: string; payload?: unknown; options?: unknown; filters: [string, unknown][] }

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private op = "select";
  private payload: unknown;
  private options: unknown;
  private filters: [string, unknown][] = [];
  private from_ = 0;
  constructor(private table: string, private client: FakeClient) {}
  select(_cols?: string, opts?: { head?: boolean }): this { if (this.op === "select") this.options = opts; return this; }
  upsert(payload: unknown, options?: unknown): this { this.op = "upsert"; this.payload = payload; this.options = options; return this; }
  eq(col: string, v: unknown): this { this.filters.push([col, v]); return this; }
  gte(col: string, v: unknown): this { this.filters.push([`${col}>=`, v]); return this; }
  order(): this { return this; }
  limit(): this { return this; }
  range(from: number): this { this.from_ = from; return this; }
  then<T1, T2 = never>(
    ok?: ((v: { data: unknown; error: unknown; count?: number }) => T1 | PromiseLike<T1>) | null,
    bad?: ((r: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    this.client.calls.push({ table: this.table, op: this.op, payload: this.payload, options: this.options, filters: this.filters });
    const error = this.client.errors[`${this.table}:${this.op}`] ?? null;
    const rows = (this.client.rows[this.table] ?? []) as unknown[];
    // Paged reads: everything on the first page, nothing after.
    const data = this.op === "select" ? (this.from_ === 0 ? rows : []) : null;
    return Promise.resolve({ data, error, count: rows.length }).then(ok, bad);
  }
}

class FakeClient {
  calls: Call[] = [];
  constructor(public rows: Record<string, unknown[]> = {}, public errors: Record<string, unknown> = {}) {}
  from(table: string) { return new FakeQuery(table, this); }
}

const allow = { checkLimit: async () => ({ allowed: true, remaining: 1 }) };
const deny = { checkLimit: async () => ({ allowed: false, remaining: 0, retryAfter: Date.now() + 120_000 }) };

const valid = (() => {
  const r = validateSpendPayload(payload({ days: [day({ date: "2026-09-19" }), day({ date: "2026-09-20", usage: 1, models: [] })] }), NOW);
  assert.ok(r.ok);
  return r.value;
})();

{
  const client = new FakeClient();
  const service = new SupabaseSpendService(client as never, allow);
  const result = await service.upsertRealSpend("Mixed-Case", "openrouter", valid);
  assert.deepEqual(result, { days: 2 });

  const [daysCall, totalCall] = client.calls;
  assert.equal(daysCall.table, "real_spend_days");
  assert.equal(daysCall.op, "upsert");
  assert.deepEqual(daysCall.options, { onConflict: "username,source,date" }, "replace per (username, source, date)");
  const rows = daysCall.payload as Record<string, unknown>[];
  assert.equal(rows.length, 2);
  assert.equal(rows[0].username, "mixed-case", "usernames are lowercased");
  assert.equal(rows[0].source, "openrouter");
  assert.equal(rows[0].cost_usd, 4.5);
  assert.equal(rows[1].cost_usd, 1);
  assert.deepEqual(rows[1].models, []);

  assert.equal(totalCall.table, "real_spend_totals");
  assert.deepEqual(totalCall.options, { onConflict: "username,source" });
  const total = totalCall.payload as Record<string, unknown>;
  assert.equal(total.username, "mixed-case");
  assert.equal(total.scope, "account");
  assert.equal(total.lifetime_usd, 321.5);
  assert.equal(total.lifetime_byok_usd, null);

  assert.ok(
    client.calls.every((c) => c.table.startsWith("real_spend_")),
    "never touches submissions or daily_breakdowns — no double counting"
  );
  check("upsert writes days per date then the all-time snapshot, and nothing else");
}

{
  const client = new FakeClient();
  const service = new SupabaseSpendService(client as never, allow);
  const r = validateSpendPayload(payload({ days: [] }), NOW);
  assert.ok(r.ok);
  assert.deepEqual(await service.upsertRealSpend("u", "openrouter", r.value), { days: 0 });
  assert.deepEqual(client.calls.map((c) => c.table), ["real_spend_totals"], "no empty days upsert");
  check("an idle sync still refreshes the all-time snapshot");
}

{
  const client = new FakeClient();
  const service = new SupabaseSpendService(client as never, deny);
  await assert.rejects(service.upsertRealSpend("u", "openrouter", valid), /Rate limit exceeded/);
  assert.equal(client.calls.length, 0, "nothing written when rate limited");
  check("a rate-limited sync writes nothing");
}

{
  const client = new FakeClient({}, { "real_spend_days:upsert": { message: "boom" } });
  const service = new SupabaseSpendService(client as never, allow);
  await assert.rejects(service.upsertRealSpend("u", "openrouter", valid), /Failed to update real spend days/);
  assert.equal(client.calls.filter((c) => c.table === "real_spend_totals").length, 0,
    "the snapshot is not replaced when the days failed");
  check("a failed days write stops before the snapshot");
}

{
  const client = new FakeClient({
    real_spend_totals: [{ scope: "account", lifetime_usd: "50", lifetime_byok_usd: null, observed_at: "2026-09-26T00:00:00Z" }],
    real_spend_days: [{ date: "2026-09-20", cost_usd: "4.5", byok_cost_usd: 0, requests: 3, prompt_tokens: 1, completion_tokens: 1, models: [] }],
  });
  const service = new SupabaseSpendService(client as never, allow);
  const spend = await service.getRealSpend("Mixed-Case");
  assert.equal(spend.lifetime?.usd, 50);
  assert.equal(spend.days.length, 1);
  assert.ok(client.calls.every((c) => c.filters.some(([k, v]) => k === "username" && v === "mixed-case")),
    "reads by the lowercased username");

  const missing = new FakeClient({}, { "real_spend_totals:select": { code: "PGRST205", message: "no table" } });
  const empty = await new SupabaseSpendService(missing as never, allow).getRealSpend("u");
  assert.equal(empty.lifetime, null, "a deploy ahead of migration 019 reads as no spend");
  assert.equal(await new SupabaseSpendService(missing as never, allow).getRealSpendStats(), null);
  check("reads lowercase the username and degrade cleanly before the migration");
}

console.log(`\n${passed} checks passed`);
