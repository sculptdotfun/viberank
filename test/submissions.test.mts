/**
 * Submission data-layer tests.
 *
 * These drive the real SupabaseSubmissionsService against a fake PostgREST
 * client. Dependencies are injected rather than module-mocked: `mock.module`
 * does not compose with tsx's CJS interop, so an alias-mocked route test
 * silently exercises nothing.
 */
import assert from "node:assert/strict";
import type { SubmitData } from "../src/lib/data/types.ts";

// Dynamic import: tsx transpiles the source to CJS, so a static named import
// fails to bind at instantiation time.
const { SupabaseSubmissionsService } = await import("../src/lib/data/supabase/client.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

// ---------------------------------------------------------------------------
// Fake PostgREST client
// ---------------------------------------------------------------------------

interface Call {
  table: string;
  operation: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  options?: unknown;
  range?: [number, number];
}

interface FakeError {
  message: string;
  code?: string;
}

type Rows = Record<string, unknown>;
type Errors = Record<string, FakeError>;

/**
 * Mimics the parts of PostgREST that matter here: a chainable builder that
 * resolves to { data, error }, and — critically — a server-side row cap that
 * silently truncates responses, which is the bug class these tests guard.
 */
class FakeQuery implements PromiseLike<{ data: unknown; error: FakeError | null }> {
  private operation: Call["operation"] = "select";
  private payload: unknown;
  private options: unknown;
  private rangeFrom = 0;
  private rangeTo = Infinity;
  private isSingle = false;

  constructor(
    private readonly table: string,
    private readonly calls: Call[],
    private readonly rows: Rows,
    private readonly errors: Errors,
    private readonly maxRows: number
  ) {}

  select(): this { this.operation = "select"; return this; }
  insert(payload: unknown): this { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: unknown): this { this.operation = "update"; this.payload = payload; return this; }
  upsert(payload: unknown, options?: unknown): this {
    this.operation = "upsert";
    this.payload = payload;
    this.options = options;
    return this;
  }
  delete(): this { this.operation = "delete"; return this; }

  range(from: number, to: number): this { this.rangeFrom = from; this.rangeTo = to; return this; }
  single(): this { this.isSingle = true; return this; }

  eq(): this { return this; }
  ilike(): this { return this; }
  or(): this { return this; }
  in(): this { return this; }
  gte(): this { return this; }
  lte(): this { return this; }
  limit(): this { return this; }
  order(): this { return this; }
  contains(): this { return this; }

  then<T1 = { data: unknown; error: FakeError | null }, T2 = never>(
    onfulfilled?: ((v: { data: unknown; error: FakeError | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    this.calls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      options: this.options,
      range: this.rangeTo === Infinity ? undefined : [this.rangeFrom, this.rangeTo],
    });

    const error = this.errors[`${this.table}:${this.operation}`] ?? null;
    let data = this.rows[this.table] ?? null;

    if (!error && Array.isArray(data)) {
      // Apply the requested window, then the server cap — the cap applies even
      // when the client asked for more, which is exactly why paging is needed.
      const windowed = data.slice(this.rangeFrom, this.rangeTo + 1);
      data = windowed.slice(0, this.maxRows);
    }
    if (!error && this.isSingle && Array.isArray(data)) {
      data = data[0] ?? null;
    }

    return Promise.resolve({ data, error }).then(onfulfilled, onrejected);
  }
}

class FakeClient {
  readonly calls: Call[] = [];

  constructor(
    private readonly rows: Rows,
    private readonly errors: Errors = {},
    private readonly maxRows = 1000
  ) {}

  from(table: string): FakeQuery {
    return new FakeQuery(table, this.calls, this.rows, this.errors, this.maxRows);
  }
}

const allowRateLimit = { checkLimit: async () => ({ allowed: true, remaining: 1 }) };

const makeService = (rows: Rows, errors: Errors = {}, maxRows = 1000) => {
  const client = new FakeClient(rows, errors, maxRows);
  return { client, service: new SupabaseSubmissionsService(client as never, allowRateLimit) };
};

// ---------------------------------------------------------------------------
// Fixtures: a 270-day history, the shape from issue #93
// ---------------------------------------------------------------------------

const DAY_COUNT = 270;

const daily = Array.from({ length: DAY_COUNT }, (_, i) => ({
  date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
  inputTokens: 1000,
  outputTokens: 500,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 1500,
  totalCost: 1.25,
  modelsUsed: ["claude-opus-4"],
  agents: ["claude"],
}));

const totals = daily.reduce(
  (acc, d) => ({
    inputTokens: acc.inputTokens + d.inputTokens,
    outputTokens: acc.outputTokens + d.outputTokens,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: acc.totalTokens + d.totalTokens,
    totalCost: acc.totalCost + d.totalCost,
  }),
  { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, totalCost: 0 }
);

const submission: SubmitData = {
  username: "long-history",
  githubUsername: "long-history",
  source: "cli",
  verified: false,
  machineId: "machine-a",
  ccData: { totals, daily, tools: ["claude"] },
};

const existingDailyRows = daily.map((d, i) => ({
  id: `day-${i}`,
  submission_id: "submission-1",
  date: d.date,
  input_tokens: 10,
  output_tokens: 5,
  cache_creation_tokens: 0,
  cache_read_tokens: 0,
  total_tokens: 15,
  total_cost: 0.01,
  models_used: ["claude-opus-4"],
  agents: ["claude"],
  model_breakdowns: null,
  machine_contributions: null,
}));

const mergeRows = () => ({
  submissions: [{ id: "submission-1", models_used: ["claude-opus-4"], tools: ["claude"] }],
  daily_breakdowns: existingDailyRows,
  profiles: [{ id: "profile-1", total_submissions: 1 }],
});

// ---------------------------------------------------------------------------
// #93 — a long history must not need a round-trip per day
// ---------------------------------------------------------------------------

{
  const { client, service } = makeService(mergeRows());
  await service.submit(submission);

  const dailyWrites = client.calls.filter(
    (c) => c.table === "daily_breakdowns" && c.operation !== "select"
  );

  assert.equal(
    dailyWrites.length,
    1,
    `expected a single bulk write, got ${dailyWrites.length}`
  );
  assert.equal(dailyWrites[0].operation, "upsert");
  assert.deepEqual(dailyWrites[0].options, { onConflict: "submission_id,date" });
  assert.equal((dailyWrites[0].payload as unknown[]).length, DAY_COUNT);
  check(`${DAY_COUNT}-day merge writes once instead of ${DAY_COUNT} times`);
}

// ---------------------------------------------------------------------------
// Truncation guards — the silent-cap bug class (#97)
// ---------------------------------------------------------------------------

{
  // A one-day re-submit against a 270-day stored history, under a 100-row
  // server cap. Totals are recomputed from the rows the merge reads and
  // written back to the parent, so the days it fails to read are days the
  // user loses. The incoming payload must be *smaller* than the stored
  // history for this to discriminate — if it covered all 270 days it would
  // repopulate the map itself and pass even with a truncated read.
  const oneDay = daily[0];
  const resubmit: SubmitData = {
    ...submission,
    ccData: {
      totals: {
        inputTokens: oneDay.inputTokens,
        outputTokens: oneDay.outputTokens,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: oneDay.totalTokens,
        totalCost: oneDay.totalCost,
      },
      daily: [oneDay],
      tools: ["claude"],
    },
  };

  // 269 untouched stored days, plus the one day this submission replaces.
  const expectedCost = (DAY_COUNT - 1) * 0.01 + oneDay.totalCost;
  const expectedTokens = (DAY_COUNT - 1) * 15 + oneDay.totalTokens;

  const { client, service } = makeService(mergeRows(), {}, 100);
  await service.submit(resubmit);

  const parentUpdate = client.calls.find(
    (c) => c.table === "submissions" && c.operation === "update"
  );
  const written = parentUpdate!.payload as { total_cost: number; total_tokens: number };

  assert.ok(
    Math.abs(written.total_cost - expectedCost) < 1e-9,
    `totals came from a truncated read: got ${written.total_cost}, expected ${expectedCost}`
  );
  assert.equal(written.total_tokens, expectedTokens);
  check("merge pages past the server row cap instead of shrinking totals");
}

{
  // A failing page must not look like the end of the data.
  const { service } = makeService(mergeRows(), {
    "daily_breakdowns:select": { message: "connection reset" },
  });
  await assert.rejects(
    () => service.submit(submission),
    /Failed to query existing daily breakdowns: connection reset/
  );
  check("a failed page raises instead of silently truncating");
}

// ---------------------------------------------------------------------------
// Error propagation — writes must not fail silently
// ---------------------------------------------------------------------------

{
  const { service } = makeService(mergeRows(), {
    "daily_breakdowns:upsert": { message: "constraint violation" },
  });
  await assert.rejects(
    () => service.submit(submission),
    /Failed to update daily breakdowns: constraint violation/
  );
  check("bulk daily write errors surface");
}

{
  const { service } = makeService(mergeRows(), {
    "submissions:update": { message: "deadlock detected" },
  });
  await assert.rejects(
    () => service.submit(submission),
    /Failed to update existing submission: deadlock detected/
  );
  check("parent submission update errors surface");
}

// ---------------------------------------------------------------------------
// #93 — a post-commit projection failure must not report failure
// ---------------------------------------------------------------------------

{
  const { service } = makeService(mergeRows(), {
    "profiles:update": { message: "profiles table unavailable" },
  });

  const originalError = console.error;
  console.error = () => undefined;
  let id: string;
  try {
    id = await service.submit(submission);
  } finally {
    console.error = originalError;
  }

  assert.equal(
    id,
    "submission-1",
    "a profile failure after the submission committed must not fail the request"
  );
  check("post-commit profile errors do not turn success into failure");
}

// ---------------------------------------------------------------------------
// Deleting an account must remove it from the board, not just its profile row
// ---------------------------------------------------------------------------

const { SupabaseProfilesService } = await import("../src/lib/data/supabase/client.ts");

const deletionRows = () => ({
  profiles: [{ id: "profile-1", username: "spammer", github_username: "spammer", created_at: "2026-01-01T00:00:00Z" }],
  submissions: [{ id: "submission-1", username: "spammer" }],
  daily_breakdowns: [{ id: "day-1", submission_id: "submission-1" }, { id: "day-2", submission_id: "submission-1" }],
  raw_submissions: [{ id: "raw-1" }, { id: "raw-2" }],
});

{
  const client = new FakeClient(deletionRows());
  const profiles = new SupabaseProfilesService(client as never);
  const result = await profiles.deleteByPattern(["spammer"], { searchField: "username" });

  const deletedTables = client.calls
    .filter((c) => c.operation === "delete")
    .map((c) => c.table);

  assert.ok(
    deletedTables.includes("submissions"),
    "deleting an account must delete its submissions — the leaderboard reads that table, not profiles"
  );
  assert.ok(deletedTables.includes("raw_submissions"), "the archived payload must go too");
  assert.ok(deletedTables.includes("profiles"), "the profile row must go");

  assert.deepEqual(result.deletedRows, {
    profiles: 1,
    submissions: 1,
    dailyBreakdowns: 2,
    rawSubmissions: 2,
  });
  check("account delete removes submissions and archive, not just the profile");
}

{
  const client = new FakeClient(deletionRows());
  const profiles = new SupabaseProfilesService(client as never);
  const result = await profiles.deleteByPattern(["spammer"], { searchField: "username", dryRun: true });

  assert.equal(
    client.calls.filter((c) => c.operation === "delete").length,
    0,
    "a dry run must not delete anything"
  );
  assert.equal(result.matchedCount, 1);
  assert.match(result.message, /would delete 1 profiles, 1 submissions, 2 daily rows, 2 archived payloads/);
  check("dry run reports the full blast radius without deleting");
}

console.log(`\n${passed} passed, 0 failed`);
