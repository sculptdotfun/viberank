import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { statusLine, readStandingFile, writeStandingFile, weekNumber, money, compactTokens, movementMark, weekIsOver, STANDING_VERSION } =
  await import("../packages/viberank-cli/lib/statusline.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const now = new Date("2026-11-25T15:00:00Z");
const record = {
  version: 1, username: "you", weekId: "2026-W48", weekDay: 3, weekClosesAt: "2026-11-30T00:00:00Z",
  cls: "ranked", heldReason: null, rank: 41, of: 126, movement: 6, cost: 835.4, tokens: 1_120_000_000,
  planEq: 0.64, gap: 26.2, above: "palewave", streakWeeks: 4, updatedAt: "2026-11-25T14:00:00.000Z",
};

{
  assert.equal(statusLine(record, { now }), "vr #41/126 ▲6 · $27 to @palewave");
  assert.equal(statusLine(record, { now, format: "compact" }), "#41 ▲6");
  assert.equal(statusLine(record, { now, format: "long" }), "viberank wk48 d3 · #41/126 Ranked ▲6 · $835 · $27 to @palewave · 4w streak");
  assert.deepEqual(JSON.parse(statusLine(record, { now, format: "json" })), record);
  assert.equal(statusLine(record, { now, format: "{rank}/{of} {move} wk{week} {nope}" }), "41/126 ▲6 wk48 {nope}", "unknown keys are left alone");
  check("short, compact, long, json and template formats");
}

{
  assert.equal(statusLine({ ...record, rank: 1, gap: null, above: null, movement: 0 }, { now }), "vr #1/126 = · top");
  assert.equal(statusLine({ ...record, movement: -2 }, { now }), "vr #41/126 ▼2 · $27 to @palewave");
  assert.equal(statusLine({ ...record, movement: null }, { now }), "vr #41/126 new · $27 to @palewave");
  assert.equal(statusLine({ ...record, cls: "open", rank: 12, of: 40, heldReason: "unverified" }, { now }), "vr open #12/40 ▲6 · $27 to @palewave");
  assert.equal(statusLine({ ...record, gap: null, above: null }, { now }), "vr #41/126 ▲6");
  assert.equal(statusLine({ ...record, rank: null }, { now }), "vr wk48 · no usage yet");
  assert.equal(statusLine({ ...record, rank: null }, { now, format: "compact" }), "");
  check("top, down, new, off the Ranked board, no gap and no usage");
}

{
  const monday = new Date("2026-11-30T08:00:00Z");
  assert.equal(weekIsOver(record, monday), true);
  assert.equal(weekIsOver(record, now), false);
  assert.equal(statusLine(record, { now: monday }), "vr wk48 final #41/126", "a closed week says final until the next sync");
  assert.equal(statusLine(record, { now: monday, format: "long" }), "viberank wk48 final · #41/126 Ranked ▲6 · $835 · $27 to @palewave · 4w streak");
  check("after Monday 00:00 UTC the line says the week is final");
}

{
  assert.equal(statusLine(null), "vr · run npx viberank-cli");
  assert.equal(statusLine(null, { format: "compact" }), "");
  assert.equal(statusLine(null, { format: "json" }), "{}");
  check("no saved standing: a hint, or nothing in compact");
}

{
  assert.equal(statusLine(record, { now, color: true }), "vr #41/126 \u001b[32m▲6\u001b[39m · $27 to @palewave");
  assert.equal(movementMark(-1, true), "\u001b[31m▼1\u001b[39m");
  check("colour only when asked, on the movement");
}

{
  assert.equal(weekNumber("2026-W08"), "8");
  assert.equal(weekNumber("odd"), "odd");
  assert.equal(money(26.01, { up: true }), "$27");
  assert.equal(money(1240.4), "$1,240");
  assert.equal(money(12_400), "$12.4K");
  assert.equal(money(20_000), "$20K");
  assert.equal(compactTokens(1_120_000_000), "1.1B");
  assert.equal(compactTokens(340_000_000), "340M");
  assert.equal(compactTokens(12_000), "12K");
  assert.equal(compactTokens(950), "950");
  check("weeks, dollars and tokens print short");
}

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viberank-standing-"));
  const file = path.join(dir, "nested", "standing.json");
  try {
    assert.equal(readStandingFile(file), null, "missing file");
    writeStandingFile(file, record);
    assert.deepEqual(readStandingFile(file), record);
    assert.equal(fs.readdirSync(path.dirname(file)).length, 1, "no temp file left behind");
    if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600);

    writeStandingFile(file, { ...record, rank: 40 });
    assert.equal(readStandingFile(file)?.rank, 40, "overwritten in place");

    fs.writeFileSync(file, "{ half");
    assert.equal(readStandingFile(file), null, "unreadable");
    fs.writeFileSync(file, JSON.stringify({ ...record, version: STANDING_VERSION + 1 }));
    assert.equal(readStandingFile(file), null, "another version is not guessed at");
    fs.writeFileSync(file, JSON.stringify({ version: 1 }));
    assert.equal(readStandingFile(file), null, "missing fields");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  check("the standing file round-trips and anything off is read as none");
}

console.log(`\n${passed} checks passed`);
