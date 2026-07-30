import assert from "node:assert/strict";
const { SupabaseSubmissionsService } = await import("../src/lib/data/supabase/client.ts");
import type { SubmitData } from "../src/lib/data/types.ts";

interface Call {
  table: string;
  operation: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  options?: unknown;
}

interface FakeError {
  message: string;
  code?: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

class FakeQuery implements PromiseLike<FakeResult> {
  private operation: Call["operation"] = "select";
  private payload: unknown;
  private options: unknown;

  constructor(
    private readonly table: string,
    private readonly calls: Call[],
    private readonly rows: Record<string, unknown>,
    private readonly errors: Record<string, FakeError>
  ) {}

  select(): this {
    this.operation = "select";
    return this;
  }

  insert(payload: unknown): this {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown): this {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown, options?: unknown): this {
    this.operation = "upsert";
    this.payload = payload;
    this.options = options;
    return this;
  }

  delete(): this {
    this.operation = "delete";
    return this;
  }

  eq(): this { return this; }
  ilike(): this { return this; }
  or(): this { return this; }
  limit(): this { return this; }
  range(): this { return this; }
  order(): this { return this; }
  single(): this { return this; }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    this.calls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      options: this.options,
    });
    const error = this.errors[`${this.table}:${this.operation}`] ?? null;
    return Promise.resolve({ data: this.rows[this.table] ?? null, error }).then(
      onfulfilled,
      onrejected
    );
  }
}

class FakeClient {
  readonly calls: Call[] = [];

  constructor(
    private readonly rows: Record<string, unknown>,
    private readonly errors: Record<string, FakeError> = {}
  ) {}

  from(table: string): FakeQuery {
    return new FakeQuery(table, this.calls, this.rows, this.errors);
  }
}

const contribution = (n: number) => ({
  inputTokens: n,
  outputTokens: n,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: n * 2,
  totalCost: n / 100,
  modelsUsed: ["test-model"],
  agents: ["test"],
});

const daily = Array.from({ length: 270 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10);
  return { date, ...contribution(index + 1) };
});

const existingDaily = daily.map((day, index) => ({
  id: `day-${index}`,
  submission_id: "submission-1",
  date: day.date,
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_tokens: 0,
  cache_read_tokens: 0,
  total_tokens: 2,
  total_cost: 0.01,
  models_used: ["old-model"],
  agents: ["old"],
  model_breakdowns: null,
  machine_contributions: { old: contribution(1) },
}));

const rows = {
  submissions: [{
    id: "submission-1",
    models_used: ["old-model"],
    tools: ["old"],
  }],
  daily_breakdowns: existingDaily,
  profiles: {
    id: "profile-1",
    total_submissions: 1,
  },
};

const totals = daily.reduce(
  (sum, day) => ({
    inputTokens: sum.inputTokens + day.inputTokens,
    outputTokens: sum.outputTokens + day.outputTokens,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: sum.totalTokens + day.totalTokens,
    totalCost: sum.totalCost + day.totalCost,
  }),
  {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost: 0,
  }
);

const submission: SubmitData = {
  username: "long-history",
  githubUsername: "long-history",
  source: "cli",
  verified: false,
  machineId: "machine-new",
  ccData: { totals, daily, tools: ["test"] },
};

const allowedRateLimiter = {
  checkLimit: async () => ({ allowed: true, remaining: 0 }),
};

const client = new FakeClient(rows);
const service = new SupabaseSubmissionsService(client as never, allowedRateLimiter);
await service.submit(submission);

const dailyWrites = client.calls.filter(
  (call) => call.table === "daily_breakdowns" && call.operation !== "select"
);
assert.equal(
  dailyWrites.length,
  1,
  `expected one bulk daily write, got ${dailyWrites.length}: ${dailyWrites.map((c) => c.operation).join(",")}`
);
assert.equal(dailyWrites[0].operation, "upsert");
assert.deepEqual(dailyWrites[0].options, { onConflict: "submission_id,date" });
assert.equal((dailyWrites[0].payload as unknown[]).length, 270);
console.log("✓ 270-day merge uses one conflict-safe bulk daily write");

const failedUpdateClient = new FakeClient(
  rows,
  { "submissions:update": { message: "forced parent update failure" } }
);
const failedUpdateService = new SupabaseSubmissionsService(
  failedUpdateClient as never,
  allowedRateLimiter
);
await assert.rejects(
  () => failedUpdateService.submit(submission),
  /Failed to update existing submission: forced parent update failure/
);
console.log("✓ parent submission update errors are not silently ignored");

const failedDailyClient = new FakeClient(
  rows,
  { "daily_breakdowns:upsert": { message: "forced bulk upsert failure" } }
);
const failedDailyService = new SupabaseSubmissionsService(
  failedDailyClient as never,
  allowedRateLimiter
);
await assert.rejects(
  () => failedDailyService.submit(submission),
  /Failed to update daily breakdowns: forced bulk upsert failure/
);
console.log("✓ bulk daily write errors are not silently ignored");

const failedProfileClient = new FakeClient(
  rows,
  { "profiles:update": { message: "forced profile update failure" } }
);
const failedProfileService = new SupabaseSubmissionsService(
  failedProfileClient as never,
  allowedRateLimiter
);
const originalConsoleError = console.error;
console.error = () => undefined;
let acceptedSubmissionId: string;
try {
  acceptedSubmissionId = await failedProfileService.submit(submission);
} finally {
  console.error = originalConsoleError;
}
assert.equal(acceptedSubmissionId, "submission-1");
console.log("✓ post-commit profile errors do not turn success into failure");
