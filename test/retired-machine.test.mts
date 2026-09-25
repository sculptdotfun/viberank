import assert from "node:assert/strict";

const { SupabaseSubmissionsService } = await import("../src/lib/data/supabase/client.ts");

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

class Query implements PromiseLike<{ data: Row[]; error: null }> {
  private filters: Array<(row: Row) => boolean> = [];
  private start = 0;
  private end = Infinity;
  private operation: "select" | "update" | "upsert" = "select";
  private payload: Row | Row[] = {};
  constructor(private table: string, private tables: Tables, private writes: Array<{ table: string; ids: string[] }>) {}
  select(): this { return this; }
  update(payload: Row): this { this.operation = "update"; this.payload = payload; return this; }
  upsert(payload: Row[]): this { this.operation = "upsert"; this.payload = payload; return this; }
  eq(column: string, value: unknown): this { this.filters.push((row) => row[column] === value); return this; }
  in(column: string, values: unknown[]): this { this.filters.push((row) => values.includes(row[column])); return this; }
  gte(column: string, value: string): this { this.filters.push((row) => row[column] >= value); return this; }
  lte(column: string, value: string): this { this.filters.push((row) => row[column] <= value); return this; }
  or(expression: string): this {
    const parts = expression.split(",").map((part) => {
      const [column, op, ...rest] = part.split(".");
      assert.equal(op, "eq");
      const value = rest.join(".");
      return (row: Row) => row[column] === value;
    });
    this.filters.push((row) => parts.some((part) => part(row)));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this {
    this.sort = (rows) => rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (options?.ascending === false ? -1 : 1));
    return this;
  }
  private sort: (rows: Row[]) => Row[] = (rows) => rows;
  range(from: number, to: number): this { this.start = from; this.end = to; return this; }
  then<T1 = { data: Row[]; error: null }, T2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    const rows = this.sort(this.tables[this.table].filter((row) => this.filters.every((filter) => filter(row))));
    if (this.operation === "update") {
      for (const row of rows) Object.assign(row, this.payload);
      this.writes.push({ table: this.table, ids: rows.map((row) => row.id) });
    } else if (this.operation === "upsert") {
      const changed: string[] = [];
      for (const payload of this.payload as Row[]) {
        const row = this.tables[this.table].find((candidate) => candidate.id === payload.id);
        assert.ok(row);
        Object.assign(row, payload);
        changed.push(row.id);
      }
      this.writes.push({ table: this.table, ids: changed });
    }
    return Promise.resolve({ data: structuredClone(rows.slice(this.start, this.end + 1).slice(0, 2)), error: null })
      .then(onfulfilled, onrejected);
  }
}

class Client {
  writes: Array<{ table: string; ids: string[] }> = [];
  constructor(public tables: Tables) {}
  from(table: string) { return new Query(table, this.tables, this.writes); }
}

const slice = (cost: number) => ({
  inputTokens: cost * 10, outputTokens: cost * 2, cacheCreationTokens: 0,
  cacheReadTokens: 0, totalTokens: cost * 12, totalCost: cost,
  modelsUsed: ["model"], agents: ["claude"],
});
const day = (id: string, submission_id: string, date: string, cost: number,
  machine_contributions: Row | null) => ({
  id, submission_id, date, input_tokens: cost * 10, output_tokens: cost * 2,
  cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: cost * 12,
  total_cost: cost, models_used: ["model"], agents: ["claude"],
  model_breakdowns: null, machine_contributions,
});

const tables: Tables = {
  submissions: [
    { id: "owned", username: "alice", claimed_by: null, total_cost: 16, total_tokens: 192,
      input_tokens: 160, output_tokens: 32, cache_creation_tokens: 0, cache_read_tokens: 0 },
    { id: "claimed", username: "old-name", claimed_by: "alice", total_cost: 4, total_tokens: 48,
      input_tokens: 40, output_tokens: 8, cache_creation_tokens: 0, cache_read_tokens: 0 },
    { id: "foreign", username: "bob", claimed_by: null, total_cost: 5, total_tokens: 60,
      input_tokens: 50, output_tokens: 10, cache_creation_tokens: 0, cache_read_tokens: 0 },
  ],
  daily_breakdowns: [
    day("a", "owned", "2025-01-01", 10, { default: slice(8), machine: slice(10) }),
    day("b", "owned", "2025-01-02", 6, { default: slice(2), machine: slice(6) }),
    day("c", "claimed", "2025-01-01", 4, null),
    day("d", "foreign", "2025-01-01", 5, { default: slice(4), machine: slice(5) }),
  ],
};
const original = structuredClone(tables);
const client = new Client(tables);
const service = new SupabaseSubmissionsService(client as never, { checkLimit: async () => ({ allowed: true, remaining: 1 }) } as never);

const preview = await service.previewRetiredMachine("alice", "2025-01-01", "2025-01-01");
assert.deepEqual(preview, {
  days: 1, unattributedCost: 12, currentTotalCost: 20, newTotalCost: 28,
  unattributedSpan: { first: "2025-01-01", last: "2025-01-02" }, retiredDays: 0,
});
assert.deepEqual(tables, original, "preview must be read only");

const applied = await service.retireUnattributed("alice", "2025-01-01", "2025-01-01");
assert.deepEqual(applied, { ...preview, retiredDays: 1 }, "an undo is offered for the day just moved");
assert.equal(tables.daily_breakdowns[0].total_cost, 18, "default plus named machine sum");
assert.equal(tables.daily_breakdowns[1].total_cost, 6, "outside range stays unchanged");
assert.equal(tables.daily_breakdowns[2].total_cost, 4, "legacy null row is retained as default");
assert.equal(tables.submissions[0].total_cost, 24, "parent includes every daily row");
assert.equal(tables.submissions[0].total_tokens, 24 * 12);
assert.deepEqual(tables.daily_breakdowns[3], original.daily_breakdowns[3], "other user stays untouched");
const retiredKeys = [tables.daily_breakdowns[0], tables.daily_breakdowns[2]]
  .map((row) => Object.keys(row.machine_contributions).find((key) => key.startsWith("retired:")));
assert.match(retiredKeys[0], /^retired:[0-9a-f]{8}$/);
assert.equal(retiredKeys[0], retiredKeys[1], "one key per call");
assert.equal(client.writes.filter((write) => write.table === "daily_breakdowns").length, 1);

const noOp = await service.retireUnattributed("alice", "2025-01-01", "2025-01-01");
assert.equal(noOp.days, 0);
assert.equal(noOp.currentTotalCost, 28);
assert.equal(client.writes.filter((write) => write.table === "daily_breakdowns").length, 1);

const restored = await service.restoreUnattributed("alice");
assert.equal(restored.retiredDays, 0, "nothing left to undo");
for (const [index, row] of tables.daily_breakdowns.entries()) {
  for (const field of ["input_tokens", "output_tokens", "cache_creation_tokens", "cache_read_tokens", "total_tokens", "total_cost"]) {
    assert.equal(row[field], original.daily_breakdowns[index][field], `undo restores ${field}`);
  }
}
assert.deepEqual(tables.daily_breakdowns[0].machine_contributions, original.daily_breakdowns[0].machine_contributions);
assert.deepEqual(tables.daily_breakdowns[2].machine_contributions.default.totalCost, 4, "legacy row becomes a default map");
assert.deepEqual(tables.submissions, original.submissions, "undo restores parent totals");
console.log("✓ retired machine preview, ownership, range, legacy rows, pagination, undo, and no-op");
