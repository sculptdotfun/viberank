import assert from "node:assert/strict";

const { isStanding, fetchStanding, gapAbove, toRecord, timeLeft, recapUrl, meUrl, standingLines, usernameFromProfileUrl } =
  await import("../packages/viberank-cli/lib/standing.js");
const { parseArgs, skipWithinMs, wantsStatusLine } = await import("../packages/viberank-cli/lib/args.js");
const { autosubmitOneLine } = await import("../packages/viberank-cli/lib/pitch.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const now = new Date("2026-11-25T15:00:00Z"); // Wednesday of 2026-W48
const week = { id: "2026-W48", start: "2026-11-23", end: "2026-11-29", day: 3, closesAt: "2026-11-30T00:00:00Z", closed: false };
const base = {
  username: "you", week, cls: "ranked", rank: 41, of: 126, cost: 835.4, tokens: 1_120_000_000, planEq: 0.64,
  movement: 6, above: { username: "palewave", cost: 861.6 }, below: { username: "x", cost: 800 }, bracket: [],
  streakWeeks: 4, bestWeek: null, days: [300, 400, 135, 0, 0, 0, 0], trust: "verified",
};
const SITE = "https://www.viberank.app";

{
  assert.equal(isStanding(base), true);
  assert.equal(isStanding({ ...base, rank: null }), true, "no usage this week is still a standing");
  assert.equal(isStanding({ ...base, cls: "gold" }), false);
  assert.equal(isStanding({ ...base, week: { id: "2026-W48" } }), false);
  assert.equal(isStanding({ error: "Not found" }), false);
  assert.equal(isStanding(null), false);
  check("isStanding accepts the contract's shape and nothing else");
}

{
  const lines = standingLines(base, { now });
  assert.deepEqual(lines, [
    "Week 48 · day 3 of 7 · 4d 9h left",
    "#41 of 126 Ranked   ▲6 since last week",
    "$835 this week · 1.1B tokens · ≈ 0.6 plans",
    "$27 behind @palewave · 4-week streak",
  ]);
  check("the weekly block: week, rank and movement, spend, the gap above and streak");
}

{
  const held = standingLines({ ...base, cls: "open", rank: 12, of: 40, movement: -3, heldReason: "not GitHub-verified", streakWeeks: 1 }, { now });
  assert.equal(held[1], "#12 of 40 Open   ▼3 since last week");
  assert.equal(held[2], "Not ranked: not GitHub-verified");
  assert.equal(held.at(-1), "$27 behind @palewave", "a one-week streak is not worth a mention");

  const top = standingLines({ ...base, rank: 1, above: null, movement: 0 }, { now });
  assert.equal(top[1], "#1 of 126 Ranked   no change since last week");
  assert.equal(top.at(-1), "top of the board · 4-week streak");

  const fresh = standingLines({ ...base, rank: null, movement: null, above: null, cost: 0, tokens: 0, planEq: 0, streakWeeks: 0 }, { now });
  assert.equal(fresh[1], "No usage counted this week yet · 126 on Ranked");
  assert.equal(fresh.length, 3, "no gap line without a rank");

  const newcomer = standingLines({ ...base, movement: null }, { now });
  assert.equal(newcomer[1], "#41 of 126 Ranked   new this week");

  const closed = standingLines({ ...base, week: { ...week, day: 7, closed: true } }, { now: new Date("2026-11-30T03:00:00Z") });
  assert.equal(closed[0], "Week 48 · final");
  check("held, top, new, empty and closed weeks each read correctly");
}

{
  const painted = standingLines(base, { now, paint: { accent: (s: string) => `<${s}>`, green: (s: string) => `[${s}]` } });
  assert.equal(painted[1], "<#41> of 126 Ranked   [▲6] since last week");
  check("paint is applied to the parts that carry colour");
}

{
  assert.equal(gapAbove(base), 861.6 - 835.4);
  assert.equal(gapAbove({ ...base, rank: 1 }), null);
  assert.equal(gapAbove({ ...base, above: null }), null);
  assert.equal(gapAbove({ ...base, above: { username: "tie", cost: 800 } }), 0, "never negative");

  const record = toRecord(base, now);
  assert.deepEqual(record, {
    version: 1, username: "you", weekId: "2026-W48", weekDay: 3, weekClosesAt: "2026-11-30T00:00:00Z",
    cls: "ranked", heldReason: null, rank: 41, of: 126, movement: 6, cost: 835.4, tokens: 1_120_000_000,
    planEq: 0.64, gap: 861.6 - 835.4, above: "palewave", streakWeeks: 4, updatedAt: "2026-11-25T15:00:00.000Z",
  });
  check("toRecord keeps what a status line needs, with the gap worked out");
}

{
  assert.equal(timeLeft("2026-11-30T00:00:00Z", now), "4d 9h left");
  assert.equal(timeLeft("2026-11-25T20:30:00Z", now), "5h left");
  assert.equal(timeLeft("2026-11-25T15:20:00Z", now), "closing");
  assert.equal(timeLeft("2026-11-25T14:00:00Z", now), "final");
  assert.equal(recapUrl(SITE, "2026-W48", "you"), "https://www.viberank.app/recap/2026-W48/you");
  assert.equal(meUrl("https://www.viberank.app/profile/you", "you"), "https://www.viberank.app/profile/you?me=you");
  assert.equal(meUrl("https://www.viberank.app/profile/you?ref=cli", "you"), "https://www.viberank.app/profile/you?ref=cli&me=you");
  assert.equal(usernameFromProfileUrl("https://www.viberank.app/profile/Pale-Wave?x=1"), "Pale-Wave");
  assert.equal(usernameFromProfileUrl(undefined), null);
  check("time left, recap link, ?me= profile link, and the account from a profile URL");
}

{
  const respond = (status: number, body: unknown) => async () =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
  const calls: string[] = [];
  const spy = async (url: string) => { calls.push(url); return respond(200, base)(); };
  assert.deepEqual(await fetchStanding(SITE, "you", { fetch: spy }), base);
  assert.equal(calls[0], "https://www.viberank.app/api/v2/standing/you");

  assert.equal(await fetchStanding(SITE, "you", { fetch: respond(404, { error: "Not found" }) }), null, "old server: fall back");
  assert.equal(await fetchStanding(SITE, "you", { fetch: respond(200, { leaderboard: [] }) }), null, "wrong shape: fall back");
  assert.equal(await fetchStanding(SITE, "you", { fetch: async () => { throw new Error("ENOTFOUND"); } }), null);
  assert.equal(await fetchStanding(SITE, "you", {
    fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("html"); } }) as unknown as Response,
  }), null);
  assert.equal(await fetchStanding(SITE, null, { fetch: spy }), null, "no username, no request");
  assert.equal(calls.length, 1);

  const hang = (_url: string, init: { signal: AbortSignal }) => new Promise<Response>((_, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")));
  });
  assert.equal(await fetchStanding(SITE, "you", { fetch: hang, timeoutMs: 20 }), null, "a slow server is no answer");
  check("fetchStanding returns the standing or null, and never throws");
}

{
  assert.equal(parseArgs(["status", "--format", "compact"]).flags.format, "compact");
  assert.equal(parseArgs(["status", "--format={rank}/{of}"]).flags.format, "{rank}/{of}");
  assert.equal(parseArgs(["submit", "--quiet", "--every", "1"]).flags.every, "1");
  assert.equal(skipWithinMs(null), 20 * 3600_000);
  assert.equal(skipWithinMs("1"), 3600_000);
  assert.equal(skipWithinMs("0.5"), 1800_000);
  assert.equal(skipWithinMs("soon"), 20 * 3600_000);
  assert.equal(skipWithinMs("-3"), 20 * 3600_000);
  assert.equal(wantsStatusLine({ format: null, stdoutIsTTY: true }), false, "a person gets the full report");
  assert.equal(wantsStatusLine({ format: null, stdoutIsTTY: false }), true, "a status line gets one line");
  assert.equal(wantsStatusLine({ format: "long", stdoutIsTTY: true }), true);
  check("--format and --every parse; status picks the one-liner off a terminal");
}

{
  const line = autosubmitOneLine({ daily: [{ date: "2026-10-01" }] }, new Date("2026-11-25T12:00:00Z"));
  assert.ok(!line.includes("\n"));
  assert.match(line, /weekly rank stays live/);
  const truncated = autosubmitOneLine({ daily: [{ date: "2026-10-27" }] }, new Date("2026-11-25T12:00:00Z"));
  assert.match(truncated, /reaches back 29 days/);
  check("the autosubmit offer is one line");
}

console.log(`\n${passed} checks passed`);
