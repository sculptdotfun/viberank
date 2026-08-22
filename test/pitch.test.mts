import assert from "node:assert/strict";

const { autosubmitPitch, historyWindow, looksTruncated, DEFAULT_CLEANUP_DAYS } =
  await import("../packages/viberank-cli/lib/pitch.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };
const TODAY = new Date("2026-08-22T12:00:00Z");
const days = (from: string, to: string, key: "date" | "period" = "date") => {
  const out: Record<string, string>[] = [];
  for (const d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
    out.push({ [key]: d.toISOString().slice(0, 10) });
  }
  return { daily: out };
};

{
  // ccusage's aggregate report keys days as `period`. Reading only `date` made
  // historyWindow return null on every real report while passing every fixture
  // that used `date` — caught by rendering against a real cc.json, not by a test.
  const w = historyWindow(days("2026-06-01", "2026-08-22", "period"), TODAY);
  assert.ok(w, "a period-keyed report must be understood");
  assert.equal(w!.oldest, "2026-06-01");
  assert.equal(historyWindow(days("2026-06-01", "2026-08-22", "date"), TODAY)!.oldest, "2026-06-01");
  check("both `date` and `period` day keys are read");
}

{
  const w = historyWindow(days("2026-07-24", "2026-08-22"), TODAY)!;
  assert.equal(w.reachDays, 29);
  assert.equal(looksTruncated(w), true);
  check("a report reaching back ~30 days reads as possibly truncated");
}

{
  assert.equal(looksTruncated(historyWindow(days("2025-10-03", "2026-08-22"), TODAY)!), false);
  assert.equal(looksTruncated(historyWindow(days("2026-08-19", "2026-08-22"), TODAY)!), false,
    "a new install is not a deletion");
  check("long histories and brand-new installs are not flagged");
}

{
  // The claim must never be asserted as fact — a five-week-old install is
  // indistinguishable from a pruned one, and telling someone their data was
  // deleted when it never existed is worse than saying nothing.
  const text = autosubmitPitch(days("2026-07-24", "2026-08-22"), TODAY).join(" ");
  assert.match(text, /you may/, "hedged, not asserted");
  assert.ok(!/your data was deleted|we lost/i.test(text));
  check("truncation is offered as a suspicion, never stated as fact");
}

{
  const text = autosubmitPitch(days("2026-06-01", "2026-08-22"), TODAY).join(" ");
  assert.match(text, new RegExp(`${DEFAULT_CLEANUP_DAYS} days by default`));
  assert.match(text, /What you send here is kept/);
  assert.ok(!/rank/i.test(text), "the pitch is about the data, not the leaderboard");
  check("the pitch leads with data loss and never mentions rank");
}

{
  assert.deepEqual(historyWindow({ daily: [] }, TODAY), null);
  assert.deepEqual(historyWindow(undefined as never, TODAY), null);
  assert.deepEqual(historyWindow({ daily: [{ date: "not-a-date" }] } as never, TODAY), null);
  const text = autosubmitPitch({ daily: [] }, TODAY).join(" ");
  assert.match(text, /deletes session history/, "still says the useful part");
  assert.ok(!/reaches back/.test(text), "but claims nothing about a report it cannot read");
  check("a missing or malformed report degrades to the general message");
}

console.log(`\n${passed} checks passed`);
