/**
 * Device link (/api/v2/link): code format, the poll state machine, and the
 * whole start → approve → poll flow over the in-memory store.
 */
import assert from "node:assert/strict";

const {
  USER_CODE_ALPHABET,
  generateUserCode,
  normalizeUserCode,
  generateDeviceCode,
  hashDeviceCode,
  looksLikeDeviceCode,
  decidePoll,
  decideApprove,
  pageState,
  linkTokenLabel,
  clientIp,
  verifyUrl,
  LINK_TTL_MS,
} = await import("../src/lib/link.ts");
const { createMemoryLinkStore, startLink, pollLink, approveLink, lookupLink } = await import("../src/lib/link-flow.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

{
  for (const ch of "0O1IL") assert.ok(!USER_CODE_ALPHABET.includes(ch), `${ch} is not in the alphabet`);
  for (let i = 0; i < 500; i++) {
    const code = generateUserCode();
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    for (const ch of code.replace("-", "")) assert.ok(USER_CODE_ALPHABET.includes(ch));
  }
  let n = 0;
  assert.equal(generateUserCode(() => n++ % 31), "ABCD-EFGH", "picks index into the alphabet");
  check("user codes are XXXX-XXXX from the unambiguous alphabet");
}

{
  assert.equal(normalizeUserCode("HXKT-4Q2M"), "HXKT-4Q2M");
  assert.equal(normalizeUserCode("hxkt-4q2m"), "HXKT-4Q2M", "case");
  assert.equal(normalizeUserCode("hxkt4q2m"), "HXKT-4Q2M", "no dash");
  assert.equal(normalizeUserCode(" HX KT_4Q-2M "), "HXKT-4Q2M", "spaces, underscores, stray dashes");
  assert.equal(normalizeUserCode("HXKT--4Q2M"), "HXKT-4Q2M");
  assert.equal(normalizeUserCode("HXKT-4Q20"), null, "0 is ambiguous, refused not guessed");
  assert.equal(normalizeUserCode("HXKO-4Q2M"), null, "O refused");
  assert.equal(normalizeUserCode("HXK1-4Q2M"), null, "1 refused");
  assert.equal(normalizeUserCode("HXKI-4Q2M"), null, "I refused");
  assert.equal(normalizeUserCode("hxkl-4q2m"), null, "l refused");
  assert.equal(normalizeUserCode("HXKT-4Q2"), null, "too short");
  assert.equal(normalizeUserCode("HXKT-4Q2MM"), null, "too long");
  assert.equal(normalizeUserCode(""), null);
  assert.equal(normalizeUserCode(null), null);
  assert.equal(normalizeUserCode("HXKT-4Q2M;drop"), null);
  check("normalization forgives case and separators, refuses ambiguous or foreign characters");
}

{
  const a = generateDeviceCode();
  const b = generateDeviceCode();
  assert.notEqual(a.plaintext, b.plaintext);
  assert.ok(looksLikeDeviceCode(a.plaintext));
  assert.equal(a.hash, hashDeviceCode(a.plaintext));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.ok(!a.hash.includes(a.plaintext.slice(4, 12)), "stored value is a hash, not the code");
  assert.ok(!looksLikeDeviceCode("vbd_short"));
  assert.ok(!looksLikeDeviceCode(`vbr_${"a".repeat(43)}`), "an API token is not a device code");
  assert.ok(!looksLikeDeviceCode(undefined));
  check("device codes are 256-bit, prefixed, and stored as SHA-256");
}

{
  assert.equal(linkTokenLabel(new Date("2026-11-25T23:59:00Z")), "CLI (linked 2026-11-25)");
  assert.equal(verifyUrl("https://www.viberank.app", "HXKT-4Q2M"), "https://www.viberank.app/link?code=HXKT-4Q2M");
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIp(h({})), "unknown");
  check("token label, verify URL and client IP");
}

// ---------------------------------------------------------------------------
// Poll state machine
// ---------------------------------------------------------------------------
{
  const now = 1_000_000_000;
  const row = (over: Record<string, unknown> = {}) => ({
    id: "1", userCode: "HXKT-4Q2M", deviceHash: "h", status: "pending", username: null, githubUsername: null,
    createdAt: now - 1000, expiresAt: now + LINK_TTL_MS, lastPolledAt: null, tokenId: null, ...over,
  }) as never;

  assert.deepEqual(decidePoll(null, now), { kind: "expired", reason: "unknown" });
  assert.deepEqual(decidePoll(row(), now), { kind: "pending" });
  assert.deepEqual(decidePoll(row({ lastPolledAt: now - 5000 }), now), { kind: "pending" });
  assert.deepEqual(decidePoll(row({ lastPolledAt: now - 4200 }), now), { kind: "pending" }, "a second of jitter is fine");
  assert.deepEqual(decidePoll(row({ lastPolledAt: now - 1000 }), now), { kind: "slow_down" });
  assert.deepEqual(decidePoll(row({ lastPolledAt: now - 1000 }), now, 1), { kind: "pending" }, "interval is a parameter");
  assert.deepEqual(decidePoll(row({ expiresAt: now }), now), { kind: "expired", reason: "expired" });
  assert.deepEqual(decidePoll(row({ status: "expired" }), now), { kind: "expired", reason: "expired" });
  assert.deepEqual(decidePoll(row({ status: "consumed", username: "a", githubUsername: "a" }), now), { kind: "expired", reason: "used" });
  assert.deepEqual(
    decidePoll(row({ status: "approved", username: "octo", githubUsername: "octo" }), now),
    { kind: "issue", username: "octo", githubUsername: "octo" }
  );
  assert.deepEqual(
    decidePoll(row({ status: "approved", username: "octo", githubUsername: "octo", lastPolledAt: now - 500 }), now),
    { kind: "slow_down" },
    "even approved, a fast poll waits"
  );
  assert.deepEqual(
    decidePoll(row({ status: "approved", username: "octo", githubUsername: "octo", expiresAt: now - 1 }), now),
    { kind: "expired", reason: "expired" },
    "an approval not collected in time expires"
  );
  check("decidePoll: unknown, pending, slow_down, expired, used, issue");

  assert.equal(pageState(null, null, now), "invalid");
  assert.equal(pageState("HXKT-4Q2M", null, now), "unknown");
  assert.equal(pageState("HXKT-4Q2M", row(), now), "pending");
  assert.equal(pageState("HXKT-4Q2M", row({ status: "approved" }), now), "used");
  assert.equal(pageState("HXKT-4Q2M", row({ expiresAt: now - 1 }), now), "expired");
  assert.deepEqual(decideApprove("HXKT-4Q2M", row(), now), { kind: "approve" });
  const used = decideApprove("HXKT-4Q2M", row({ status: "consumed" }), now);
  assert.equal(used.kind === "error" && used.status, 409);
  const gone = decideApprove("HXKT-4Q2M", row({ expiresAt: now - 1 }), now);
  assert.equal(gone.kind === "error" && gone.status, 410);
  check("page and approve states");
}

// ---------------------------------------------------------------------------
// The whole flow, in memory
// ---------------------------------------------------------------------------
{
  const store = createMemoryLinkStore();
  let clock = 2_000_000_000;
  const issued: string[] = [];
  const issueToken = async (username: string, github: string, label: string) => {
    issued.push(`${username}|${github}|${label}`);
    return { plaintext: `vbr_${"x".repeat(43)}`, id: `tok-${issued.length}` };
  };
  const claimed: string[] = [];
  const claim = async (u: string) => { claimed.push(u); return 2; };

  const start = await startLink(store, { now: clock, site: "https://www.viberank.app" });
  assert.equal(start.interval, 5);
  assert.equal(start.expiresIn, 600);
  assert.equal(start.verifyUrl, `https://www.viberank.app/link?code=${start.userCode}`);
  const [row] = [...store.rows.values()];
  assert.notEqual(row.deviceHash, start.deviceCode, "the device code is not stored");
  assert.equal(row.deviceHash, hashDeviceCode(start.deviceCode));

  assert.deepEqual(await pollLink(store, start.deviceCode, { now: clock, issueToken }), { status: "pending" });
  clock += 1000;
  assert.deepEqual(await pollLink(store, start.deviceCode, { now: clock, issueToken }), { status: "slow_down" });
  assert.deepEqual(await pollLink(store, "vbd_nope", { now: clock, issueToken }), { status: "expired", reason: "unknown" });

  assert.equal((await lookupLink(store, start.userCode.toLowerCase(), clock)).state, "pending", "page accepts lowercase");
  const bad = await approveLink(store, "ZZZZ-ZZZZ", "octo", { now: clock, claim });
  assert.equal(!bad.ok && bad.status, 404);

  const ok = await approveLink(store, start.userCode.toLowerCase().replace("-", ""), "octo", { now: clock, claim });
  assert.deepEqual(ok, { ok: true, username: "octo", claimed: 2 });
  assert.deepEqual(claimed, ["octo"], "earlier unverified rows are claimed on approve");
  const again = await approveLink(store, start.userCode, "mallory", { now: clock, claim });
  assert.equal(!again.ok && again.status, 409, "a code is approved once");

  clock += 5000;
  const got = await pollLink(store, start.deviceCode, { now: clock, issueToken });
  assert.equal(got.status, "approved");
  assert.equal(got.status === "approved" && got.username, "octo");
  assert.deepEqual(issued, [`octo|octo|CLI (linked ${new Date(clock).toISOString().slice(0, 10)})`]);
  assert.equal(store.rows.get(row.id)?.tokenId, "tok-1", "the token id is kept, not the token");

  clock += 5000;
  assert.deepEqual(await pollLink(store, start.deviceCode, { now: clock, issueToken }), { status: "expired", reason: "used" });
  assert.equal(issued.length, 1, "the token is issued exactly once");
  check("start → slow_down → approve (claims) → token once → used");
}

{
  // A failed mint puts the link back so the next poll can collect it.
  const store = createMemoryLinkStore();
  let clock = 3_000_000_000;
  const start = await startLink(store, { now: clock, site: "https://x" });
  await approveLink(store, start.userCode, "octo", { now: clock, claim: async () => { throw new Error("db down"); } });
  let fail = true;
  const issueToken = async () => {
    if (fail) throw new Error("insert failed");
    return { plaintext: "vbr_t", id: "t" };
  };
  await assert.rejects(pollLink(store, start.deviceCode, { now: clock, issueToken }));
  fail = false;
  clock += 5000;
  const got = await pollLink(store, start.deviceCode, { now: clock, issueToken });
  assert.equal(got.status, "approved", "retry succeeds");
  check("a claim failure doesn't block approval; a mint failure is retryable");
}

{
  const store = createMemoryLinkStore();
  const clock = 4_000_000_000;
  const start = await startLink(store, { now: clock, site: "https://x" });
  const late = clock + LINK_TTL_MS;
  const res = await approveLink(store, start.userCode, "octo", { now: late, claim: async () => 0 });
  assert.equal(!res.ok && res.status, 410);
  assert.deepEqual(await pollLink(store, start.deviceCode, { now: late, issueToken: async () => ({ plaintext: "", id: "" }) }), {
    status: "expired",
    reason: "expired",
  });
  check("after 10 minutes neither approve nor poll works");
}

console.log(`\n${passed} passed`);
