import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { formatLogLine, trimLines, appendLog, readLog, lastSuccess, timeAgo, isOverdue, MAX_LOG_LINES } =
  await import("../packages/viberank-cli/lib/runlog.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };
const at = new Date("2026-10-26T09:37:02.114Z");

{
  assert.equal(formatLogLine({ outcome: "ok", status: 200, detail: "submitted 41 days as @me", time: at }),
    "2026-10-26T09:37:02.114Z ok HTTP 200 — submitted 41 days as @me");
  assert.equal(formatLogLine({ outcome: "fail", status: 429, detail: "Rate limit exceeded", time: at }),
    "2026-10-26T09:37:02.114Z fail HTTP 429 — Rate limit exceeded");
  assert.equal(formatLogLine({ outcome: "fail", detail: "ccusage: timed out\nafter 180 s", time: at }),
    "2026-10-26T09:37:02.114Z fail error — ccusage: timed out after 180 s", "one line, even for a multi-line error");
  assert.equal(formatLogLine({ outcome: "skip", detail: "already submitted", time: at }),
    "2026-10-26T09:37:02.114Z skip — already submitted");
  check("each run is one dated line: time, outcome, HTTP status or error");
}

{
  const lines = Array.from({ length: 250 }, (_, i) => `line ${i}`).join("\n");
  const kept = trimLines(lines);
  assert.equal(kept.length, MAX_LOG_LINES);
  assert.equal(kept[0], "line 50");
  assert.equal(kept.at(-1), "line 249");
  assert.deepEqual(trimLines("a\n\n  \nb\n", 5), ["a", "b"], "blank lines are dropped");
  check("the log is trimmed to its last 200 lines");
}

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viberank-log-"));
  const file = path.join(dir, "nested", "autosubmit.log");
  try {
    for (let i = 0; i < 205; i++) appendLog(file, `run ${i}`);
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text.split("\n").filter(Boolean).length, MAX_LOG_LINES);
    assert.ok(text.endsWith("run 204\n"));
    assert.deepEqual(readLog(file, 2), ["run 203", "run 204"]);

    // launchd holds the log open in append mode as the job's stdout, so the
    // trim must keep the same file rather than swap in a new one.
    const before = fs.statSync(file).ino;
    appendLog(file, "one more");
    assert.equal(fs.statSync(file).ino, before, "rewritten in place, not replaced");
    assert.deepEqual(readLog(path.join(dir, "missing.log")), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  check("appendLog keeps the file bounded and in place");
}

{
  assert.equal(lastSuccess({}), null);
  assert.equal(lastSuccess({ lastAutosubmit: "2026-10-20T09:00:00Z", lastSubmit: "2026-10-25T18:00:00Z" })?.toISOString(),
    "2026-10-25T18:00:00.000Z", "a manual submission counts as well as a scheduled one");
  assert.equal(lastSuccess({ lastAutosubmit: "nonsense" }), null);
  check("the last success is the latest of either kind");
}

{
  const now = new Date("2026-10-26T12:00:00Z");
  assert.equal(timeAgo(new Date("2026-10-26T11:59:40Z"), now), "just now");
  assert.equal(timeAgo(new Date("2026-10-26T11:35:00Z"), now), "25 min ago");
  assert.equal(timeAgo(new Date("2026-10-26T07:00:00Z"), now), "5 h ago");
  assert.equal(timeAgo(new Date("2026-10-23T12:00:00Z"), now), "3 days ago");
  check("ages read the way a person says them");
}

{
  const now = new Date("2026-10-26T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  assert.equal(isOverdue({ enabled: true, last: hoursAgo(49), now }), true);
  assert.equal(isOverdue({ enabled: true, last: hoursAgo(30), now }), false, "one missed day is not an alarm");
  assert.equal(isOverdue({ enabled: false, last: hoursAgo(500), now }), false);
  assert.equal(isOverdue({ enabled: true, last: null, enabledAt: hoursAgo(1).toISOString(), now }), false, "a new job is not overdue");
  assert.equal(isOverdue({ enabled: true, last: null, enabledAt: hoursAgo(72).toISOString(), now }), true);
  assert.equal(isOverdue({ enabled: true, last: hoursAgo(300), enabledAt: hoursAgo(2).toISOString(), now }), false,
    "an old manual submit does not make a job switched on today overdue");
  check("status warns after 48 hours on without a success");
}

console.log(`\n${passed} checks passed`);
