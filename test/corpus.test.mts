import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { listTranscripts, collectCorpus } = await import(
  "../packages/viberank-cli/lib/corpus.js"
);

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const root = fs.mkdtempSync(path.join(os.tmpdir(), "vb-corpus-"));
const write = (rel: string, stamps: string[]) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, stamps.map((t) => JSON.stringify({ timestamp: t, type: "assistant" })).join("\n"));
};

// A real session tree: transcripts at the top, subagent transcripts nested.
write("proj-a/session1.jsonl", ["2026-07-02T10:00:00Z", "2026-07-02T11:00:00Z"]);
write("proj-a/session2.jsonl", ["2026-07-15T09:00:00Z"]);
write("proj-a/session1/subagents/sub1.jsonl", ["2026-07-02T10:30:00Z"]);
write("proj-a/session1/subagents/sub2.jsonl", ["2026-07-02T10:40:00Z"]);
write("proj-b/deep/nested/session3.jsonl", ["2026-06-20T08:00:00Z"]);
fs.writeFileSync(path.join(root, "proj-a", "notes.txt"), "not a transcript");

{
  // THE regression test. A flat glob has been measured seeing 75 files where
  // the truth was 1,398 — an undercount that makes the discriminator
  // confidently wrong rather than merely noisy.
  const flat = fs.readdirSync(path.join(root, "proj-a")).filter((f) => f.endsWith(".jsonl")).length;
  const recursive = listTranscripts(root).length;

  assert.equal(flat, 2, "a flat read of one project sees only its top level");
  assert.equal(recursive, 5, "the recursive walk finds subagent transcripts too");
  assert.ok(recursive > flat, "recursion must find strictly more");
  check("subagent transcripts are counted — a flat glob undercounts badly");
}

{
  const files = listTranscripts(root);
  assert.ok(!files.some((f) => f.endsWith("notes.txt")), "non-jsonl files excluded");
  assert.ok(files.every((f) => path.isAbsolute(f)), "paths are absolute");
  check("only .jsonl transcripts are collected");
}

{
  const corpus = collectCorpus(root)!;
  assert.deepEqual(Object.keys(corpus).sort(), ["2026-06", "2026-07"]);
  assert.equal(corpus["2026-07"].files, 4, "three July sessions plus two subagents minus…");
  assert.equal(corpus["2026-06"].files, 1);
  assert.ok(corpus["2026-07"].bytes > 0 && corpus["2026-06"].bytes > 0);
  check("corpus is grouped by month, not reported as one global count");
}

{
  // The case a global counter gets wrong: deleting an old month while the
  // current month grows. Per-month scoping must still show June dropping.
  fs.rmSync(path.join(root, "proj-b"), { recursive: true });
  write("proj-a/session4.jsonl", ["2026-07-20T09:00:00Z"]);
  write("proj-a/session5.jsonl", ["2026-07-21T09:00:00Z"]);

  const after = collectCorpus(root)!;
  assert.equal(after["2026-06"], undefined, "June is gone, and says so");
  assert.ok(after["2026-07"].files > 4, "July grew at the same time");
  check("a deleted month stays visible even as the current month grows");
}

{
  // A session running across a month boundary is counted in both. Harmless,
  // because every comparison is against the same client's earlier count.
  const spanRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vb-span-"));
  fs.writeFileSync(
    path.join(spanRoot, "s.jsonl"),
    [
      JSON.stringify({ timestamp: "2026-06-30T23:00:00Z" }),
      JSON.stringify({ timestamp: "2026-07-01T01:00:00Z" }),
    ].join("\n")
  );
  const c = collectCorpus(spanRoot)!;
  assert.deepEqual(Object.keys(c).sort(), ["2026-06", "2026-07"]);
  assert.equal(c["2026-06"].files, 1);
  assert.equal(c["2026-07"].files, 1);
  fs.rmSync(spanRoot, { recursive: true });
  check("a month-spanning session counts in both months");
}

{
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "vb-empty-"));
  assert.equal(collectCorpus(empty), null, "nothing to report → omit the block");
  assert.equal(collectCorpus(path.join(empty, "does-not-exist")), null);
  assert.deepEqual(listTranscripts(path.join(empty, "nope")), []);
  fs.rmSync(empty, { recursive: true });
  check("an absent or empty tree reports nothing rather than an empty object");
}

{
  // Junk must not abort a scan or invent months.
  const junkRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vb-junk-"));
  fs.writeFileSync(path.join(junkRoot, "a.jsonl"), "not json at all\n\n");
  fs.writeFileSync(path.join(junkRoot, "b.jsonl"), JSON.stringify({ timestamp: "nonsense" }));
  fs.writeFileSync(path.join(junkRoot, "c.jsonl"), JSON.stringify({ timestamp: "2026-07-05T00:00:00Z" }));
  const c = collectCorpus(junkRoot)!;
  assert.deepEqual(Object.keys(c), ["2026-07"], "only the datable file counts");
  assert.equal(c["2026-07"].files, 1);
  fs.rmSync(junkRoot, { recursive: true });
  check("unparseable transcripts are skipped, not fatal");
}

fs.rmSync(root, { recursive: true });
console.log(`\n${passed} passed, 0 failed`);
