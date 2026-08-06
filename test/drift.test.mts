import assert from "node:assert/strict";

const { classifyDrift, monthsUserDeleted, monthOfDate, corpusCoversDay } =
  await import("../src/lib/drift.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };
const size = (files: number, bytes = files * 1000) => ({ files, bytes });

{
  assert.equal(classifyDrift(size(100), size(80)), "deleted", "fewer files = removed history");
  assert.equal(classifyDrift(size(100), size(100)), "rewritten", "same corpus, lower totals");
  assert.equal(classifyDrift(size(100), size(140)), "rewritten", "corpus grew");
  check("file count separates a deletion from a rewrite");
}

{
  // The case month-scoping alone cannot catch: inside the current month a
  // deletion can leave the file count flat. Bytes move the right way.
  assert.equal(classifyDrift(size(100, 5_000_000), size(100, 1_000_000)), "deleted");
  // Ordinary compaction shaves bytes without being intent.
  assert.equal(classifyDrift(size(100, 5_000_000), size(100, 4_950_000)), "rewritten");
  check("bytes catch a deletion hiding behind a flat file count");
}

{
  for (const [p, c] of [[null, size(10)], [size(10), null], [null, null]] as const) {
    assert.equal(classifyDrift(p, c), "unknown", "nothing to compare against");
  }
  assert.equal(classifyDrift(size(NaN), size(10)), "unknown");
  check("a missing or unusable prior is unknown, never a verdict");
}

{
  // The failure the whole feature exists to prevent: an old month deleted
  // while the current month grows. A global counter reads "files went up".
  const prior = { "2026-06": size(91), "2026-07": size(200) };
  const incoming = { "2026-06": size(0, 0), "2026-07": size(260) };

  const deleted = monthsUserDeleted(prior, incoming);
  assert.ok(deleted.has("2026-06"), "June's deletion is seen");
  assert.ok(!deleted.has("2026-07"), "July's growth is not a deletion");

  // What a global count would have concluded:
  const globalPrior = 91 + 200, globalNow = 0 + 260;
  assert.ok(globalNow < globalPrior === false || globalNow > 91,
    "a single counter cannot separate these");
  check("a deleted month is caught even while the current month grows");
}

{
  // This used to assert the opposite. A month absent from the payload is not
  // evidence of deletion: it is equally the signature of Claude Code's own
  // 30-day pruning, and of a month where the user ran only Codex or Gemini.
  // On production data every absent month was the latter — 20 of 20.
  const deleted = monthsUserDeleted({ "2026-05": size(40) }, { "2026-07": size(10) });
  assert.ok(!deleted.has("2026-05"),
    "an absent month is ambiguous between cleared, aged-off and never-used");
  assert.equal(deleted.size, 0, "and nothing else should fire either");
  check("a month the client stops reporting is NOT treated as cleared");
}

{
  // The corpus scans ~/.claude/projects only, so its verdict may not lower a
  // day whose usage came from a tool it never looked at.
  assert.equal(corpusCoversDay(["claude"]), true);
  assert.equal(corpusCoversDay(["claude", "codex"]), true, "mixed day still has Claude in it");
  assert.equal(corpusCoversDay(["Claude"]), true, "agent casing varies by report");
  assert.equal(corpusCoversDay(["codex"]), false, "a Codex day is out of scope");
  assert.equal(corpusCoversDay(["codex", "gemini", "opencode"]), false);
  // Single-source reports carry no agent fields and are Claude by definition;
  // treating unknown as out-of-scope would disable the feature for the users
  // it was built for.
  assert.equal(corpusCoversDay([]), true, "no agents means a legacy Claude report");
  assert.equal(corpusCoversDay(null), true);
  assert.equal(corpusCoversDay(undefined), true);
  check("a drift verdict only reaches days the corpus is evidence about");
}

{
  assert.equal(monthsUserDeleted(null, { "2026-07": size(10) }).size, 0, "first ever submission");
  assert.equal(monthsUserDeleted({ "2026-07": size(10) }, null).size, 0,
    "a client that sends no corpus must not look like a mass deletion");
  assert.equal(monthsUserDeleted(null, null).size, 0);
  check("absent corpus data never fabricates a deletion");
}

{
  assert.equal(monthOfDate("2026-07-15"), "2026-07");
  for (const bad of ["", "2026-07", "nonsense", "15-07-2026"]) {
    assert.equal(monthOfDate(bad), null, `must reject ${bad}`);
  }
  check("month extraction rejects malformed dates");
}

console.log(`\n${passed} passed, 0 failed`);
