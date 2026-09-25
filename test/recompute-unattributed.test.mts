/**
 * recomputeUnattributedDays: brings stored days in line with the per-model
 * aggregation rule. Days are aggregated when submitted, so without it the
 * rule only reaches days a user re-submits.
 */
import assert from "node:assert/strict";

const { recomputeUnattributedDays } = await import("../src/lib/data/supabase/client.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

type Row = Record<string, unknown>;

/** Just enough PostgREST: eq / in / not-null on a JSON key, paging, updates. */
class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: ((r: Row) => boolean)[] = [];
  private update_: Row | null = null;
  private from_ = 0;
  private to_ = Infinity;

  constructor(private readonly db: Record<string, Row[]>, private readonly table: string, private readonly log: string[]) {}

  select(): this { return this; }
  update(values: Row): this { this.update_ = values; return this; }
  eq(col: string, v: unknown): this { this.filters.push((r) => r[col] === v); return this; }
  in(col: string, vs: unknown[]): this { this.filters.push((r) => vs.includes(r[col])); return this; }
  not(path: string, op: string, v: unknown): this {
    assert.equal(op, "is");
    assert.equal(v, null);
    const [col, key] = path.split("->");
    this.filters.push((r) => {
      const json = r[col] as Record<string, unknown> | null;
      return !!json && json[key] != null;
    });
    return this;
  }
  order(): this { return this; }
  range(from: number, to: number): this { this.from_ = from; this.to_ = to; return this; }

  then<T1, T2 = never>(
    ok?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
    bad?: ((r: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    const rows = (this.db[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.update_) {
      rows.forEach((r) => Object.assign(r, this.update_));
      this.log.push(`${this.table}:update`);
      return Promise.resolve({ data: rows, error: null }).then(ok, bad);
    }
    return Promise.resolve({ data: rows.slice(this.from_, this.to_ + 1), error: null }).then(ok, bad);
  }
}

const fakeClient = (db: Record<string, Row[]>, log: string[] = []) => ({
  from: (t: string) => new FakeQuery(db, t, log),
});

const model = (modelName: string, cost: number) => ({
  modelName, inputTokens: cost * 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, cost,
});
const slice = (name: string, cost: number, agents = ["claude"]) => ({
  inputTokens: cost * 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
  totalTokens: cost * 100, totalCost: cost, modelsUsed: [name], agents, modelBreakdowns: [model(name, cost)],
});
const day = (id: string, submissionId: string, date: string, contributions: Row | null, cost: number) => ({
  id, submission_id: submissionId, date,
  input_tokens: cost * 100, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0,
  total_tokens: cost * 100, total_cost: cost, models_used: [], agents: [], model_breakdowns: null,
  machine_contributions: contributions,
});

const seed = (): Record<string, Row[]> => ({
  submissions: [
    { id: "s-retired", username: "has-retired-machine", total_cost: 160 },
    { id: "s-copy", username: "same-machine-twice", total_cost: 30 },
  ],
  daily_breakdowns: [
    // Stored under the old whole-day max: $60, the $20 codex day hidden.
    day("d1", "s-retired", "2026-05-01", { default: slice("claude-opus-4-8", 60), m1: slice("gpt-6-astra", 20, ["codex"]) }, 60),
    // Default-only and legacy days never change.
    day("d2", "s-retired", "2026-05-02", { default: slice("claude-opus-4-8", 50) }, 50),
    day("d3", "s-retired", "2026-05-03", null, 50),
    // #81: the same machine's day with and without an id — must stay $30.
    day("d4", "s-copy", "2026-05-01", { default: slice("claude-opus-4-8", 30), m2: slice("claude-opus-4-8", 30) }, 30),
  ],
});

{
  const db = seed();
  const log: string[] = [];
  const report = await recomputeUnattributedDays(fakeClient(db, log) as never, { apply: false });
  assert.deepEqual(report, [
    { submissionId: "s-retired", username: "has-retired-machine", days: 1, costBefore: 160, costAfter: 180, applied: false },
  ]);
  assert.deepEqual(log, [], "a dry run writes nothing");
  check("dry run reports only the mixed day that changes, and writes nothing");
}

{
  const db = seed();
  await recomputeUnattributedDays(fakeClient(db) as never, { apply: true });
  const d1 = db.daily_breakdowns.find((d) => d.id === "d1")!;
  assert.equal(d1.total_cost, 80);
  assert.deepEqual((d1.agents as string[]).sort(), ["claude", "codex"]);
  const retired = db.submissions.find((s) => s.id === "s-retired")!;
  assert.equal(retired.total_cost, 180, "parent totals are re-summed from its days");
  assert.equal(retired.total_tokens, 18_000);
  assert.equal(db.daily_breakdowns.find((d) => d.id === "d4")!.total_cost, 30);
  assert.equal(db.submissions.find((s) => s.id === "s-copy")!.total_cost, 30, "#81 copies stay single");
  check("apply rewrites the day and re-sums the parent; a copy of one machine is untouched");
}

{
  const db = seed();
  await recomputeUnattributedDays(fakeClient(db) as never, { apply: true });
  assert.deepEqual(await recomputeUnattributedDays(fakeClient(db) as never, { apply: false }), []);
  check("a second run finds nothing left to change");
}

{
  // Two users to fix, one per call: the larger change goes first, and the
  // next call picks up where the last stopped.
  const db = seed();
  db.submissions.push({ id: "s-small", username: "small-change", total_cost: 10 });
  db.daily_breakdowns.push(
    day("d5", "s-small", "2026-05-01", { default: slice("claude-opus-4-8", 10), m3: slice("gpt-6-astra", 2, ["codex"]) }, 10)
  );
  const first = await recomputeUnattributedDays(fakeClient(db) as never, { apply: true, limit: 1 });
  assert.deepEqual(first.map((r) => [r.username, r.applied]), [["has-retired-machine", true], ["small-change", false]]);
  const second = await recomputeUnattributedDays(fakeClient(db) as never, { apply: true, limit: 1 });
  assert.deepEqual(second.map((r) => [r.username, r.applied]), [["small-change", true]]);
  assert.equal(db.submissions.find((s) => s.id === "s-small")!.total_cost, 12);
  check("limit applies the largest change first and repeated calls converge");
}

console.log(`\n${passed} passed, 0 failed`);
