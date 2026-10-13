/**
 * Corpus scope: a smaller corpus counted in a different directory is not a
 * deletion.
 *
 * Production case: one machine, two submitters, one machine id. A script
 * counted a folder merged from two hosts; the CLI counted ~/.claude/projects.
 * The CLI's smaller count read as deleted history and lowered the account's
 * totals every night until the script ran again.
 */
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

const { SupabaseSubmissionsService } = await import("../src/lib/data/supabase/client.ts");
const { readCorpusScope } = await import("../src/lib/drift.ts");
const { corpusScope } = await import("../packages/viberank-cli/lib/corpus.js");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

type Row = Record<string, unknown>;

/**
 * corpus_observations only: eq/ilike filters, upsert on a conflict key, and
 * optionally a database from before migration 019 (no scope column).
 */
class FakeQuery implements PromiseLike<{ data: unknown; error: { code: string; message: string } | null }> {
  private filters: ((r: Row) => boolean)[] = [];
  private usedScope = false;
  private upsertRows: Row[] | null = null;
  private conflict = "";

  constructor(private readonly db: { rows: Row[]; hasScope: boolean; conflicts: string[] }) {}

  select(): this { return this; }
  ilike(col: string, v: string): this {
    this.filters.push((r) => String(r[col]).toLowerCase() === v.toLowerCase());
    return this;
  }
  eq(col: string, v: unknown): this {
    if (col === "scope") this.usedScope = true;
    this.filters.push((r) => (r[col] ?? "") === v);
    return this;
  }
  upsert(rows: Row[], opts: { onConflict: string }): this {
    this.upsertRows = rows;
    this.conflict = opts.onConflict;
    return this;
  }

  then<T1, T2 = never>(
    ok?: ((v: { data: unknown; error: { code: string; message: string } | null }) => T1 | PromiseLike<T1>) | null,
    bad?: ((r: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    const missing = { code: "42703", message: "column corpus_observations.scope does not exist" };
    if (this.upsertRows) {
      this.db.conflicts.push(this.conflict);
      if (!this.db.hasScope && this.conflict.includes("scope")) {
        return Promise.resolve({ data: null, error: missing }).then(ok, bad);
      }
      const keys = this.conflict.split(",");
      for (const row of this.upsertRows) {
        const at = this.db.rows.findIndex((r) => keys.every((k) => (r[k] ?? "") === (row[k] ?? "")));
        if (at >= 0) this.db.rows[at] = { ...this.db.rows[at], ...row };
        else this.db.rows.push({ ...row });
      }
      return Promise.resolve({ data: null, error: null }).then(ok, bad);
    }
    if (this.usedScope && !this.db.hasScope) {
      return Promise.resolve({ data: null, error: missing }).then(ok, bad);
    }
    const rows = this.db.rows.filter((r) => this.filters.every((f) => f(r)));
    return Promise.resolve({ data: rows, error: null }).then(ok, bad);
  }
}

const service = (db: { rows: Row[]; hasScope: boolean; conflicts: string[] }) =>
  new SupabaseSubmissionsService(
    { from: () => new FakeQuery(db) } as never,
    { checkLimit: async () => ({ allowed: true, remaining: 1 }) } as never
  ) as unknown as {
    classifyCorpusDrift(data: unknown, machineId: string): Promise<Set<string>>;
  };

const merged = "aaaaaaaaaaaaaaaa"; // the script's merged folder
const local = "bbbbbbbbbbbbbbbb"; // the CLI's ~/.claude/projects
const submission = (scope: string | undefined, files: number) => ({
  username: "dev",
  corpusScope: scope,
  corpus: { "2026-09": { files, bytes: files * 1000 } },
});

{
  const db = { rows: [] as Row[], hasScope: true, conflicts: [] as string[] };
  const s = service(db);
  assert.deepEqual([...(await s.classifyCorpusDrift(submission(merged, 3919), "m1"))], []);
  const deleted = await s.classifyCorpusDrift(submission(local, 3588), "m1");
  assert.deepEqual([...deleted], [], "a smaller count from another folder is not a deletion");
  assert.equal(db.rows.length, 2, "each scope keeps its own observation");
  check("different scope, smaller corpus: no deletion verdict");
}

{
  const db = { rows: [] as Row[], hasScope: true, conflicts: [] as string[] };
  const s = service(db);
  await s.classifyCorpusDrift(submission(local, 3588), "m1");
  const deleted = await s.classifyCorpusDrift(submission(local, 3000), "m1");
  assert.deepEqual([...deleted], ["2026-09"], "the same folder shrinking is still a deletion");
  check("same scope, smaller corpus: still a deletion (#112 unchanged)");
}

{
  const db = { rows: [] as Row[], hasScope: true, conflicts: [] as string[] };
  const s = service(db);
  await s.classifyCorpusDrift(submission(undefined, 100), "m1");
  assert.deepEqual([...(await s.classifyCorpusDrift(submission(undefined, 90), "m1"))], ["2026-09"]);
  assert.equal(db.rows[0].scope, "", "older clients share the empty scope");
  check("clients without a scope compare exactly as before");
}

{
  // Deployed before migration 019: the scoped read fails with 42703 and the
  // classifier must fall back to the old comparison, not throw or skip.
  const db = {
    rows: [{ username: "dev", machine_id: "m1", month: "2026-09", files: 100, bytes: 100_000 }] as Row[],
    hasScope: false,
    conflicts: [] as string[],
  };
  const deleted = await service(db).classifyCorpusDrift(submission(local, 90), "m1");
  assert.deepEqual([...deleted], ["2026-09"], "falls back to the unscoped comparison");
  assert.deepEqual(db.conflicts, ["username,machine_id,month"], "and upserts on the old key");
  assert.equal(db.rows[0].files, 90);
  check("missing scope column: falls back without throwing");
}

{
  assert.equal(readCorpusScope({ drift: { scope: merged } }), merged);
  for (const bad of [undefined, null, {}, { drift: {} }, { drift: { scope: "ABCDEF0123456789" } }, { drift: { scope: "abc" } }, { drift: { scope: 42 } }, { drift: { scope: `${merged}0` } }]) {
    assert.equal(readCorpusScope(bad), "", JSON.stringify(bad));
  }
  check("server accepts only a 16-hex scope; anything else is the shared scope");
}

{
  const home = path.join(os.homedir(), ".claude", "projects");
  const a = corpusScope(home);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(corpusScope(home), a, "stable");
  assert.equal(corpusScope(`${home}/`), a, "trailing slash is the same folder");
  assert.notEqual(corpusScope("/tmp/merged/projects"), a, "different folders differ");
  assert.ok(!a.includes("claude") && !a.includes(os.userInfo().username), "the path never leaves the machine");
  check("CLI scope: stable 16-hex hash of the resolved folder");
}

console.log(`\n${passed} passed, 0 failed`);
