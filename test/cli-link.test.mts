/**
 * CLI side of the one-step sign-in: login/logout flags, when a submit offers
 * to verify, and the start/poll client and browser opener (no network).
 */
import assert from "node:assert/strict";

const { parseArgs, linkOffer, helpText, blockedMessage } = await import("../packages/viberank-cli/lib/args.js");
const { startLink, waitForApproval, safeVerifyUrl, browserCommand, openBrowser, LINK_HINT } = await import(
  "../packages/viberank-cli/lib/link.js"
);

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };
const SITE = "https://www.viberank.app";

{
  const login = parseArgs(["login"]);
  assert.equal(login.command, "login");
  assert.equal(login.flags.noBrowser, false);
  assert.equal(login.flags.paste, false);
  assert.equal(login.flags.token, null);
  assert.deepEqual(login.unknown, []);

  const noBrowser = parseArgs(["login", "--no-browser"]);
  assert.equal(noBrowser.flags.noBrowser, true);
  assert.deepEqual(noBrowser.unknown, [], "--no-browser is a flag, not an unknown option");
  assert.equal(parseArgs(["login", "--paste"]).flags.paste, true);
  const token = `vbr_${"a".repeat(43)}`;
  assert.equal(parseArgs(["login", "--token", token, "--no-browser"]).flags.token, token);

  const logout = parseArgs(["logout"]);
  assert.equal(logout.command, "logout");
  assert.deepEqual(logout.unknown, []);
  assert.deepEqual(parseArgs(["logout", "--force"]).unknown, ["--force"]);

  const help = helpText();
  assert.match(help, /--no-browser/);
  assert.match(help, /--paste/);
  assert.match(help, /login\s+Verify with GitHub/);
  check("login takes --no-browser, --paste and --token; logout takes nothing new");
}

{
  assert.equal(linkOffer({ quiet: false, interactive: true, hasToken: false, yes: false }), "ask");
  assert.equal(linkOffer({ quiet: false, interactive: true, hasToken: false, yes: true }), "hint", "--yes means no questions");
  assert.equal(linkOffer({ quiet: false, interactive: false, hasToken: false, yes: true }), "hint", "an agent's shell gets one line");
  assert.equal(linkOffer({ quiet: false, interactive: true, hasToken: true, yes: false }), "none", "already verified");
  assert.equal(linkOffer({ quiet: true, interactive: false, hasToken: false, yes: false }), "none", "scheduled runs say nothing");
  assert.match(LINK_HINT, /npx viberank-cli login/);
  assert.ok(!LINK_HINT.includes("\n"), "one line");
  assert.match(blockedMessage().join("\n"), /npx viberank-cli login` once/);
  check("a submit asks only at a terminal without a token, else prints one line");
}

{
  assert.equal(safeVerifyUrl(SITE, `${SITE}/link?code=HXKT-4Q2M`, "HXKT-4Q2M"), `${SITE}/link?code=HXKT-4Q2M`);
  assert.equal(safeVerifyUrl(SITE, "https://evil.example/link?code=X", "HXKT-4Q2M"), `${SITE}/link?code=HXKT-4Q2M`);
  assert.equal(safeVerifyUrl(SITE, `${SITE}.evil.example/link?code=X`, "HXKT-4Q2M"), `${SITE}/link?code=HXKT-4Q2M`);
  assert.equal(safeVerifyUrl(SITE, undefined, "HXKT-4Q2M"), `${SITE}/link?code=HXKT-4Q2M`);
  check("only our own /link URL is ever opened");

  assert.deepEqual(browserCommand("darwin", "u"), { command: "open", args: ["u"] });
  assert.deepEqual(browserCommand("linux", "u"), { command: "xdg-open", args: ["u"] });
  assert.equal(browserCommand("win32", "u").args.at(-1), "u");
  const spawned: unknown[] = [];
  assert.equal(openBrowser("u", { platform: "linux", spawn: (c: string, a: string[]) => { spawned.push([c, a]); return { on() {}, unref() {} }; } }), true);
  assert.deepEqual(spawned, [["xdg-open", ["u"]]]);
  assert.equal(openBrowser("u", { platform: "linux", spawn: () => { throw new Error("ENOENT"); } }), false, "never throws");
  check("the browser opener uses no shell and never throws");
}

{
  const res = (status: number, body: unknown) => ({ status, ok: status < 400, json: async () => body });
  assert.deepEqual(await startLink(SITE, { fetch: async () => res(404, null), version: "1.14.0" }), { ok: false, reason: "unsupported" });
  assert.equal((await startLink(SITE, { fetch: async () => { throw new Error("offline"); }, version: "1.14.0" })).reason, "unreachable");
  const rate = await startLink(SITE, { fetch: async () => res(429, { retryAfter: 120, error: "slow" }), version: "1.14.0" });
  assert.equal(rate.reason, "rate");
  assert.equal(rate.retryAfter, 120);
  const ok = await startLink(SITE, {
    fetch: async () => res(200, { userCode: "HXKT-4Q2M", deviceCode: "vbd_x", verifyUrl: "https://evil/", interval: 5, expiresIn: 600 }),
    version: "1.14.0",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.verifyUrl, `${SITE}/link?code=HXKT-4Q2M`);
  check("startLink reports unsupported, unreachable and rate limits");
}

{
  // A fake clock: sleep advances it, so the loop's timing is checked exactly.
  const run = async (replies: Array<number | Record<string, unknown> | Error>, expiresIn = 600) => {
    let t = 0;
    const waits: number[] = [];
    const bodies: string[] = [];
    let i = 0;
    const result = await waitForApproval(SITE, { deviceCode: "vbd_x", interval: 5, expiresIn }, {
      now: () => t,
      sleep: async (ms: number) => { waits.push(ms); t += ms; },
      fetch: async (_url: string, init: { body: string }) => {
        bodies.push(init.body);
        const r = replies[Math.min(i++, replies.length - 1)];
        if (r instanceof Error) throw r;
        if (typeof r === "number") return { status: r, ok: false, json: async () => ({}) };
        return { status: 200, ok: true, json: async () => r };
      },
    });
    return { result, waits, bodies };
  };

  const a = await run([{ status: "pending" }, new Error("offline"), 503, { status: "slow_down" }, { status: "approved", token: "vbr_t", username: "octo" }]);
  assert.deepEqual(a.result, { ok: true, token: "vbr_t", username: "octo" });
  assert.deepEqual(a.waits, [5000, 5000, 5000, 5000, 10000], "slow_down adds 5 s; errors keep the pace");
  assert.deepEqual(JSON.parse(a.bodies[0]), { deviceCode: "vbd_x" });

  assert.deepEqual((await run([{ status: "expired", reason: "expired" }])).result, { ok: false, reason: "expired" });
  assert.deepEqual((await run([{ status: "expired", reason: "used" }])).result, { ok: false, reason: "used" });
  assert.deepEqual((await run([{ status: "weird" }])).result, { ok: false, reason: "error" });
  const timeout = await run([{ status: "pending" }], 20);
  assert.deepEqual(timeout.result, { ok: false, reason: "expired" }, "gives up at expiresIn");
  assert.equal(timeout.waits.length, 4);
  check("the poll loop: pending, offline, 5xx, slow_down, approved, expired, used, timeout");
}

console.log(`\n${passed} passed`);
