import assert from "node:assert/strict";

const {
  postReport, submitHeaders, retryAfterSeconds, isVerifiedRefusal, failureMessage, networkErrorCode,
  describeWait, SCHEDULED_WAIT_LIMIT_S,
} = await import("../packages/viberank-cli/lib/submit.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error;
/** A fetch that plays back `replies` in order and records what it was sent. */
const scripted = (replies: Reply[]) => {
  const sent: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
  const fetch = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    sent.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error("no more replies");
    if (reply instanceof Error) throw reply;
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      headers: { get: (name: string) => reply.headers?.[name.toLowerCase()] ?? null },
      json: async () => { if (reply.body === undefined) throw new SyntaxError("not json"); return reply.body; },
    };
  };
  return { fetch, sent };
};
const sleeps: number[] = [];
const sleep = async (ms: number) => { sleeps.push(ms); };
const fetchFailed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });

{
  const headers = submitHeaders({ version: "1.13.0", machineId: "m-1", githubUser: "octocat", token: "vbr_x" });
  assert.equal(headers["X-Viberank-Client"], "cli/1.13.0");
  assert.equal(headers["X-CLI-Version"], "1.13.0", "the existing header stays");
  assert.equal(headers["X-Machine-Id"], "m-1");
  assert.equal(headers.Authorization, "Bearer vbr_x");
  assert.equal("Authorization" in submitHeaders({ version: "1", machineId: "m", githubUser: "u", token: null }), false);
  check("every submit names its client and version");
}

{
  assert.equal(retryAfterSeconds({ header: "120" }), 120);
  assert.equal(retryAfterSeconds({ header: "Mon, 26 Oct 2026 12:05:00 GMT", now: Date.parse("2026-10-26T12:00:00Z") }), 300);
  assert.equal(retryAfterSeconds({ header: null, body: { retryAfter: 45 } }), 45);
  assert.equal(retryAfterSeconds({ header: null, body: { error: "Rate limit exceeded. Please wait 2400 seconds before submitting again." } }), 2400);
  assert.equal(retryAfterSeconds({ header: null, body: {} }), null);
  check("Retry-After is read from the header, the body, or the message");
}

{
  sleeps.length = 0;
  const { fetch, sent } = scripted([
    { status: 429, headers: { "retry-after": "240" }, body: { error: "Rate limit exceeded. Please wait 240 seconds before submitting again." } },
    { status: 200, body: { success: true, profileUrl: "https://www.viberank.app/profile/octocat" } },
  ]);
  const outcome = await postReport({ fetch, headers: {}, payload: { daily: [] }, scheduled: true, sleep });
  assert.equal(outcome.ok, true);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].init.body, sent[1].init.body, "the same payload is sent again");
  assert.deepEqual(sleeps, [241_000], "waits the asked-for time, plus a second");
  assert.equal(outcome.waitedSeconds, 241);
  check("a scheduled run sits out a short rate limit and retries once");
}

{
  sleeps.length = 0;
  const wait = SCHEDULED_WAIT_LIMIT_S + 1;
  const { fetch, sent } = scripted([{ status: 429, headers: { "retry-after": String(wait) }, body: { error: "Rate limit exceeded" } }]);
  const outcome = await postReport({ fetch, headers: {}, payload: {}, scheduled: true, sleep });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 429);
  assert.equal(outcome.retryAfter, wait);
  assert.equal(sent.length, 1);
  assert.deepEqual(sleeps, [], "more than ten minutes is not worth holding the job for");
  check("a long rate limit fails at once with how long to wait");
}

{
  sleeps.length = 0;
  const { fetch, sent } = scripted([
    { status: 429, headers: { "retry-after": "60" }, body: {} },
    { status: 429, headers: { "retry-after": "60" }, body: {} },
  ]);
  const outcome = await postReport({ fetch, headers: {}, payload: {}, scheduled: true, sleep });
  assert.equal(outcome.status, 429);
  assert.equal(sent.length, 2, "waits once, not forever");
  check("a scheduled run waits out a rate limit only once");
}

{
  sleeps.length = 0;
  const { fetch, sent } = scripted([{ status: 429, headers: { "retry-after": "60" }, body: {} }]);
  const outcome = await postReport({ fetch, headers: {}, payload: {}, scheduled: false, sleep });
  assert.equal(outcome.retryAfter, 60);
  assert.equal(sent.length, 1);
  assert.deepEqual(sleeps, [], "a person is told, not made to wait");
  check("an interactive 429 returns at once");
}

{
  sleeps.length = 0;
  const { fetch, sent } = scripted([
    fetchFailed("ECONNRESET"),
    { status: 503, body: { error: "Database temporarily unavailable" } },
    { status: 200, body: { success: true } },
  ]);
  const outcome = await postReport({ fetch, headers: {}, payload: {}, sleep });
  assert.equal(outcome.ok, true);
  assert.equal(sent.length, 3);
  assert.deepEqual(sleeps, [5000, 10000]);
  check("dropped connections and 503s are retried, with Node's own fetch errors understood");
}

{
  const { fetch, sent } = scripted([{ status: 400, body: { error: "Invalid date format" } }]);
  const outcome = await postReport({ fetch, headers: {}, payload: {}, sleep });
  assert.equal(outcome.ok, false);
  assert.equal(sent.length, 1, "a 4xx is not retried");
  assert.equal(failureMessage(outcome), "Invalid date format");

  const bad = await postReport({ fetch: scripted([new Error("boom")]).fetch, headers: {}, payload: {}, sleep });
  assert.equal(bad.error?.message, "boom");
  assert.equal(failureMessage({ error: fetchFailed("ENOTFOUND") }), "could not reach viberank.app (ENOTFOUND)");
  assert.equal(networkErrorCode(fetchFailed("ECONNREFUSED")), "ECONNREFUSED");
  assert.equal(networkErrorCode(new Error("x")), null);
  check("other failures come back once, with a readable message");
}

{
  const refusal = {
    status: 403,
    body: { error: "@octocat is verified, so submissions to it need to be signed. Run `npx viberank-cli login`, then submit again." },
  };
  assert.equal(isVerifiedRefusal(refusal), true);
  assert.equal(isVerifiedRefusal({ status: 403, body: { error: "Forbidden" } }), false);
  assert.equal(isVerifiedRefusal({ status: 400, body: refusal.body }), false);
  check("the verified-profile refusal is recognised, so login can be offered inline");
}

{
  assert.equal(describeWait(45), "45 s");
  assert.equal(describeWait(2400), "40 min");
  assert.equal(describeWait(7200), "2 h");
  check("waits read the way a person says them");
}

console.log(`\n${passed} checks passed`);
