/**
 * Submission rate limits: which slots a submission is counted against.
 *
 * The limit was one submission per hour per username, so a second machine's
 * daily autosubmit and a web upload after a CLI run were both refused.
 */
import assert from "node:assert/strict";

const { submitRateLimitChecks, RateLimitError, isRateLimitError } = await import(
  "../src/lib/data/supabase/rate-limiter.ts"
);
const { SupabaseSubmissionsService } = await import("../src/lib/data/supabase/client.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

const keys = (data: Parameters<typeof submitRateLimitChecks>[0]) =>
  submitRateLimitChecks(data).map((c) => `${c.limitType}:${c.key}`);

{
  const a = keys({ username: "Alice", machineId: "mac-1", source: "cli", verified: true });
  const b = keys({ username: "alice", machineId: "linux-2", source: "cli", verified: true });
  assert.notEqual(a[0], b[0], "each machine has its own hourly slot");
  assert.equal(a[0], "submitData:alice#machine:mac-1");
  assert.equal(a[1], b[1], "both still count against one username ceiling");
  assert.equal(a[1], "submitDataPerUser:alice");
  check("a token holder's machines each get a slot, under one per-username ceiling");
}

{
  const web = keys({ username: "alice", source: "oauth", verified: true });
  const cli = keys({ username: "alice", machineId: "mac-1", source: "cli", verified: true });
  assert.equal(web[0], "submitData:alice#web");
  assert.notEqual(web[0], cli[0], "a web upload after a CLI submit has its own slot");
  check("web uploads have their own slot");
}

{
  const noMachine = keys({ username: "alice", source: "cli", verified: true });
  assert.equal(noMachine[0], "submitData:alice#cli");
  check("a token submission without a machine id (MCP, old CLIs) shares one slot");
}

{
  // The X-GitHub-User header is a claim, so its machine id is too. Letting it
  // buy a fresh slot would leave an anonymous flood against one username
  // limited by nothing.
  const one = keys({ username: "Victim", machineId: "random-1", source: "cli", verified: false });
  const two = keys({ username: "victim", machineId: "random-2", source: "cli", verified: false });
  assert.deepEqual(one, ["submitData:victim"]);
  assert.deepEqual(one, two, "rotating machine ids doesn't escape the limit");
  check("unverified submissions keep one slot per username, whatever the machine id");
}

{
  const error = new RateLimitError("This machine already submitted", 2520.4);
  assert.equal(error.retryAfterSeconds, 2521, "rounded up, never zero");
  assert.match(error.message, /^Rate limit exceeded\./);
  assert.match(error.message, /in 43 minutes/);
  assert.equal(new RateLimitError("x", 12).message.includes("12 seconds"), true);
  assert.equal(new RateLimitError("x", -5).retryAfterSeconds, 1, "a clock skew can't produce Retry-After: 0");
  assert.ok(isRateLimitError(error));
  const lookalike = Object.assign(new Error("Rate limit exceeded."), { name: "RateLimitError", retryAfterSeconds: 9 });
  assert.ok(isRateLimitError(lookalike), "recognised by name across module copies");
  assert.ok(!isRateLimitError(new Error("Rate limit exceeded.")), "not by message");
  check("RateLimitError carries the wait in whole seconds");
}

// ---------------------------------------------------------------------------
// Through the real service: the limiter is asked about the right keys, and a
// refusal surfaces as a RateLimitError before anything is written.
// ---------------------------------------------------------------------------

/** A PostgREST stand-in where every query finds no rows and writes are recorded. */
function emptyClient(writes: string[]) {
  const query = (table: string) => {
    const result = { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "ilike", "eq", "order", "limit", "range", "in", "or", "single"]) {
      builder[method] = () => builder;
    }
    for (const method of ["insert", "update", "upsert", "delete"]) {
      builder[method] = () => {
        writes.push(`${method}:${table}`);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return builder;
  };
  return { from: query, rpc: () => Promise.resolve({ data: null, error: null }) };
}

const day = {
  date: "2026-10-20",
  inputTokens: 1000,
  outputTokens: 1000,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 2000,
  totalCost: 0.05,
  modelsUsed: ["claude-sonnet-4"],
};
const ccData = {
  totals: {
    inputTokens: 1000,
    outputTokens: 1000,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 2000,
    totalCost: 0.05,
  },
  daily: [day],
};

{
  const asked: string[] = [];
  const writes: string[] = [];
  const limiter = {
    checkLimit: async (limitType: string, key: string) => {
      asked.push(`${limitType}:${key}`);
      // The machine slot is free; the username ceiling is spent.
      return limitType === "submitDataPerUser"
        ? { allowed: false, remaining: 0, retryAfter: Date.now() + 600_000 }
        : { allowed: true, remaining: 0 };
    },
  };
  const service = new SupabaseSubmissionsService(emptyClient(writes) as never, limiter as never);

  await assert.rejects(
    service.submit({
      username: "Alice",
      githubUsername: "Alice",
      source: "cli",
      verified: true,
      machineId: "mac-2",
      ccData: ccData as never,
    }),
    (error: unknown) => {
      assert.ok(error instanceof RateLimitError);
      assert.ok(error.retryAfterSeconds > 590 && error.retryAfterSeconds <= 600);
      assert.match(error.message, /@Alice already submitted 6 times/);
      return true;
    }
  );
  assert.deepEqual(asked, ["submitData:alice#machine:mac-2", "submitDataPerUser:alice"]);
  assert.deepEqual(writes, [], "a refused submission writes nothing");
  check("the service checks the machine slot, then the ceiling, and refuses before writing");
}

{
  const asked: string[] = [];
  const limiter = {
    checkLimit: async (limitType: string, key: string) => {
      asked.push(`${limitType}:${key}`);
      return { allowed: true, remaining: 0 };
    },
  };
  const service = new SupabaseSubmissionsService(emptyClient([]) as never, limiter as never);
  // A report the validators reject must not spend a slot (#150).
  await assert.rejects(
    service.submit({
      username: "alice",
      source: "oauth",
      verified: true,
      ccData: { ...ccData, daily: [{ ...day, date: "2999-01-01" }] } as never,
    }),
    /Future date detected/
  );
  assert.deepEqual(asked, [], "validation runs before the limiter");
  check("a rejected report doesn't touch the limiter");
}

console.log(`\n${passed} passed`);
