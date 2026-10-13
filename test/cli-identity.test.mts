import assert from "node:assert/strict";

const { remoteOwnerKind, whoami, resolveTokenOwner } = await import("../packages/viberank-cli/lib/identity.js");
const { whoamiFor, generateToken } = await import("../src/lib/tokens.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

type FakeInit = { headers?: Record<string, string>; signal?: AbortSignal };
const respond = (status: number, body: unknown) => async () =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body });

{
  // THE regression for #181: an organization-owned remote must not pre-fill.
  const calls: string[] = [];
  const fetch = async (url: string, init: FakeInit) => {
    calls.push(url);
    assert.equal(init.headers?.Authorization, undefined, "never authenticated");
    return respond(200, { login: "WulfhavenStudios", type: "Organization" })();
  };
  assert.equal(await remoteOwnerKind("WulfhavenStudios", { fetch }), "organization");
  assert.deepEqual(calls, ["https://api.github.com/users/WulfhavenStudios"], "only the owner name is sent");
  check("an organization remote is reported as an organization");
}

{
  assert.equal(await remoteOwnerKind("octocat", { fetch: respond(200, { type: "User" }) }), "user");
  check("a user remote is reported as a user");
}

{
  assert.equal(await remoteOwnerKind("x", { fetch: respond(403, { message: "rate limited" }) }), "unknown");
  assert.equal(await remoteOwnerKind("x", { fetch: respond(404, {}) }), "unknown");
  assert.equal(await remoteOwnerKind("x", { fetch: async () => { throw new Error("offline"); } }), "unknown");
  check("rate limits, 404s and network errors are unknown, never a user");
}

{
  // A hung request must give up at the timeout instead of holding the prompt.
  const hang = (_url: string, init: FakeInit) => new Promise((_, reject) => {
    init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
  const started = Date.now();
  assert.equal(await remoteOwnerKind("x", { fetch: hang, timeoutMs: 50 }), "unknown");
  assert.ok(Date.now() - started < 1000, "aborted promptly");
  check("a slow GitHub lookup times out as unknown");
}

{
  const token = generateToken().plaintext;
  let auth: string | undefined;
  const fetch = async (url: string, init: FakeInit) => {
    assert.equal(url, "https://site.test/api/token/whoami");
    auth = init.headers?.Authorization;
    return respond(200, { username: "owner" })();
  };
  assert.deepEqual(await whoami("https://site.test", token, { fetch }), { status: "ok", username: "owner" });
  assert.equal(auth, `Bearer ${token}`);
  assert.equal((await whoami("s", token, { fetch: respond(401, {}) })).status, "rejected");
  assert.equal((await whoami("s", token, { fetch: respond(404, {}) })).status, "unsupported");
  assert.equal((await whoami("s", token, { fetch: respond(503, {}) })).status, "unreachable");
  check("whoami maps the server's answers");
}

{
  const deps = (status: number, body: unknown = {}) => ({ fetch: respond(status, body) });
  assert.deepEqual(await resolveTokenOwner("s", "t", "saved", deps(200, { username: "fresh" })),
    { username: "fresh", rejected: false, fresh: true }, "the server's answer beats the saved one");
  assert.deepEqual(await resolveTokenOwner("s", "t", "saved", deps(503)),
    { username: "saved", rejected: false, fresh: false }, "offline falls back to the saved owner");
  assert.deepEqual(await resolveTokenOwner("s", "t", null, deps(404)),
    { username: null, rejected: false, fresh: false }, "an old server with nothing saved has no owner");
  assert.equal((await resolveTokenOwner("s", "t", "saved", deps(401))).rejected, true,
    "a revoked token is not papered over with the saved owner");
  check("the token owner prefers the server, then the saved value");
}

{
  // Server side: the route resolves exactly what /api/submit resolves.
  const token = generateToken().plaintext;
  const resolve = async (t: string) => (t === token ? { githubUsername: "michael-huffaker" } : null);

  assert.deepEqual(await whoamiFor(`Bearer ${token}`, resolve),
    { status: 200, body: { username: "michael-huffaker" } });
  assert.equal((await whoamiFor(`Bearer ${generateToken().plaintext}`, resolve)).status, 401, "unknown token");
  assert.equal((await whoamiFor(null, resolve)).status, 401, "no header");

  let called = false;
  const spy = async () => { called = true; return null; };
  assert.equal((await whoamiFor("Bearer nope", spy)).status, 401);
  assert.equal(called, false, "a malformed token never reaches the database");
  check("whoamiFor returns the token owner or 401");
}

console.log(`\n${passed} passed`);
