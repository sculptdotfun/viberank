/**
 * What POST /api/submit tells the caller: status codes for failures, the
 * client label for analytics, and the notice the CLI prints after a success.
 */
import assert from "node:assert/strict";

const {
  submitErrorResponse,
  readClient,
  isVersionBelow,
  submitNotice,
  AUTOSUBMIT_RERUN_NOTICE,
} = await import("../src/lib/submit-api.ts");
const { validateCcData, normalizeCcData, SubmissionValidationError, NO_USAGE_MESSAGE } = await import(
  "../src/lib/ccusage.ts"
);
const { RateLimitError } = await import("../src/lib/data/supabase/rate-limiter.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

/** The error a validator throws for `run`, or a failure if it throws none. */
function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the validator to throw");
}

const day = (date: string, totalCost: number, tokens = 1_000_000, extra: Record<string, unknown> = {}) => ({
  date,
  inputTokens: tokens / 2,
  outputTokens: tokens / 2,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: tokens,
  totalCost,
  modelsUsed: ["claude-opus-4"],
  agents: ["claude"],
  ...extra,
});
const totalsOf = (days: ReturnType<typeof day>[]) => ({
  inputTokens: days.reduce((s, d) => s + d.inputTokens, 0),
  outputTokens: days.reduce((s, d) => s + d.outputTokens, 0),
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: days.reduce((s, d) => s + d.totalTokens, 0),
  totalCost: days.reduce((s, d) => s + d.totalCost, 0),
});
const validate = (days: ReturnType<typeof day>[]) =>
  validateCcData({ totals: totalsOf(days), daily: days } as never, new Date("2026-10-26T12:00:00Z"));

// ---------------------------------------------------------------------------
// Validation errors are a 400 with their own message
// ---------------------------------------------------------------------------

{
  // Each of these reached people as a generic 500 asking them to check their
  // cc.json and contact support: the route's substring list said "exceed
  // realistic limits" and the validators say "exceeds".
  const cases: [string, () => unknown, RegExp][] = [
    ["total cost over the yearly ceiling", () => validate(Array.from({ length: 30 }, (_, i) => day(`2026-09-${String(i + 1).padStart(2, "0")}`, 100_000, 1e12))), /Total cost exceeds realistic limits/],
    ["one day over the single-day ceiling", () => validate([day("2026-10-08", 160_000, 1e10)]), /Cost for 2026-10-08 exceeds realistic limits/],
    ["a large day whose per-model split doesn't add up", () => validate([day("2026-10-08", 20_000, 1e9, { modelBreakdowns: [{ modelName: "claude-opus-4", inputTokens: 1, outputTokens: 1, cacheCreationTokens: 0, cacheReadTokens: 0, cost: 2_000 }] })]), /per-model costs for 2026-10-08 don't add up/],
    ["a future date", () => validate([day("2026-10-29", 5)]), /Future date detected/],
    ["an empty report", () => normalizeCcData({ totals: {}, daily: [] } as never), /No usage found on this machine/],
    ["a malformed date", () => validate([day("10/20/2026", 5)]), /Invalid date format/],
  ];

  for (const [label, run, message] of cases) {
    const error = thrownBy(run);
    assert.ok(error instanceof SubmissionValidationError, `${label}: typed`);
    const response = submitErrorResponse(error);
    assert.equal(response.status, 400, `${label}: 400, not 500`);
    assert.match(String(response.body.error), message, `${label}: its own message reaches the user`);
  }
  check("every validator rejection maps to a 400 carrying its message");
}

{
  // Recognised by type, not by wording: a message that happens to contain a
  // validator's words is still ours.
  const response = submitErrorResponse(new Error("Future date detected in the cron table"));
  assert.equal(response.status, 500);
  assert.doesNotMatch(String(response.body.error), /cc\.json/, "an unexpected error doesn't blame the file");
  check("an untyped error is a 500 that doesn't send the user to their cc.json");
}

{
  const future = String(submitErrorResponse(thrownBy(() => validate([day("2026-10-30", 5)]))).body.error);
  assert.match(future, /clock/);
  assert.match(future, /timezone/);
  assert.match(NO_USAGE_MESSAGE, /no usage found on this machine/i);
  check("the common rejections say how to fix them");
}

// ---------------------------------------------------------------------------
// Rate limits and the rest
// ---------------------------------------------------------------------------

{
  const response = submitErrorResponse(new RateLimitError("This machine already submitted", 1800));
  assert.equal(response.status, 429);
  assert.equal(response.headers?.["Retry-After"], "1800");
  assert.equal(response.body.retryAfter, 1800);
  check("a rate limit is a 429 with Retry-After in seconds");
}

{
  assert.equal(submitErrorResponse(new Error("@alice is verified, so submissions to it need to be signed.")).status, 403);
  assert.equal(submitErrorResponse(new Error("Failed to query existing submissions: boom")).status, 503);
  assert.equal(submitErrorResponse(new Error("canceling statement due to statement timeout")).status, 504);
  const leaked = submitErrorResponse(new Error("Failed to create submission: relation \"submissions\" violates"));
  assert.doesNotMatch(String(leaked.body.error), /relation/, "database text is never echoed");
  check("verified-profile, database and timeout errors keep their status codes");
}

// ---------------------------------------------------------------------------
// X-Viberank-Client
// ---------------------------------------------------------------------------

{
  assert.equal(readClient("cli/1.13.0"), "cli/1.13.0");
  assert.equal(readClient("MCP/1.2.0"), "mcp/1.2.0");
  assert.equal(readClient("web"), "web");
  assert.equal(readClient(null), "unknown");
  assert.equal(readClient(""), "unknown");
  assert.equal(readClient("<script>alert(1)</script>"), "other");
  assert.equal(readClient("cli/" + "1".repeat(80)), "other", "length-capped");
  check("the client header is kept when well-formed and bucketed otherwise");
}

// ---------------------------------------------------------------------------
// The autosubmit re-run notice
// ---------------------------------------------------------------------------

{
  assert.ok(isVersionBelow("1.12.0", "1.13.0"));
  assert.ok(isVersionBelow("1.9.4", "1.13.0"), "compared numerically, not as text");
  assert.ok(isVersionBelow("0.20.0", "1.13.0"));
  assert.ok(!isVersionBelow("1.13.0", "1.13.0"));
  assert.ok(!isVersionBelow("1.13.1", "1.13.0"));
  assert.ok(!isVersionBelow("2.0.0", "1.13.0"));
  assert.ok(!isVersionBelow(null, "1.13.0"), "no header is not an old CLI");
  assert.ok(!isVersionBelow("dev", "1.13.0"));
  check("CLI versions compare numerically and unknown versions never match");
}

{
  const house = "Tako line";
  const base = { paidNotice: null, houseNotice: house };

  assert.equal(
    submitNotice({ ...base, cliVersion: "1.12.0", tokenVerified: true }),
    AUTOSUBMIT_RERUN_NOTICE,
    "an old CLI with a token is told to re-run autosubmit, in place of the house promo"
  );
  assert.match(AUTOSUBMIT_RERUN_NOTICE, /npx viberank-cli autosubmit/);

  assert.equal(submitNotice({ ...base, cliVersion: "1.12.0", tokenVerified: false }), house, "no token, no autosubmit to fix");
  assert.equal(submitNotice({ ...base, cliVersion: "1.13.0", tokenVerified: true }), house, "fixed versions aren't nagged");
  assert.equal(submitNotice({ ...base, cliVersion: null, tokenVerified: true }), house, "MCP and web send no CLI version");

  const paid = submitNotice({ cliVersion: "1.11.2", tokenVerified: true, paidNotice: "Sponsored by Acme", houseNotice: house });
  assert.ok(paid.startsWith(AUTOSUBMIT_RERUN_NOTICE), "the fix comes first");
  assert.ok(paid.endsWith("Sponsored by Acme"), "a paid sponsor's line is kept, not overridden");
  assert.equal(submitNotice({ cliVersion: "1.13.0", tokenVerified: true, paidNotice: "Sponsored by Acme", houseNotice: house }), "Sponsored by Acme");
  check("the re-run notice reaches old token-holding CLIs without displacing a paid sponsor");
}

console.log(`\n${passed} passed`);
