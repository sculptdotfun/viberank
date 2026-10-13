/**
 * Profile lookup tests: a handle that owns one profile row per casing.
 *
 * `profiles.username` is unique case-sensitively, so `Name` and `name` can
 * both exist. getProfile read them with ilike + .single(), which errors on
 * two rows, so every casing of such a profile 404'd while the leaderboard
 * still listed it. The fake below applies ilike the way Postgres does.
 */
import assert from "node:assert/strict";

const { SupabaseProfilesService, SupabaseSubmissionsService, likeLiteral, pickCanonicalProfile } =
  await import("../src/lib/data/supabase/client.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

type Row = Record<string, unknown>;

/** Postgres ILIKE with the default `\` escape, plus PostgREST's `*` → `%`. */
function ilikeMatches(value: unknown, pattern: string): boolean {
  if (typeof value !== "string") return false;
  let re = "";
  const p = pattern.replace(/(?<!\\)\*/g, "%").replace(/\\\*/g, "\\%");
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) re += p[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%") re += ".*";
    else if (c === "_") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "is").test(value);
}

class FakeQuery implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> {
  private filters: ((row: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" = "select";
  private payload: Row | undefined;
  private isSingle = false;
  private max = Infinity;

  constructor(private readonly db: Record<string, Row[]>, private readonly table: string) {}

  select(): this { return this; }
  insert(payload: Row): this { this.op = "insert"; this.payload = payload; return this; }
  update(payload: Row): this { this.op = "update"; this.payload = payload; return this; }
  eq(col: string, v: unknown): this { this.filters.push((r) => r[col] === v); return this; }
  ilike(col: string, p: string): this { this.filters.push((r) => ilikeMatches(r[col], p)); return this; }
  in(col: string, vs: unknown[]): this { this.filters.push((r) => vs.includes(r[col])); return this; }
  order(): this { return this; }
  range(): this { return this; }
  limit(n: number): this { this.max = n; return this; }
  single(): this { this.isSingle = true; return this; }

  then<T1, T2 = never>(
    onfulfilled?: ((v: { data: unknown; error: { message: string; code?: string } | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    const rows = (this.db[this.table] ??= []);
    let result: { data: unknown; error: { message: string; code?: string } | null };
    if (this.op === "insert") {
      rows.push({ id: `row-${rows.length + 1}`, created_at: new Date().toISOString(), ...this.payload });
      result = { data: null, error: null };
    } else {
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") {
        matched.forEach((r) => Object.assign(r, this.payload));
        result = { data: matched, error: null };
      } else if (this.isSingle) {
        // PostgREST: .single() is an error unless exactly one row matches.
        result = matched.length === 1
          ? { data: matched[0], error: null }
          : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      } else {
        result = { data: matched.slice(0, this.max), error: null };
      }
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

const fakeClient = (db: Record<string, Row[]>) => ({ from: (t: string) => new FakeQuery(db, t) });

const profileRow = (id: string, username: string, total: number, created: string): Row => ({
  id,
  username,
  github_username: username,
  github_name: null,
  bio: null,
  avatar: null,
  total_submissions: total,
  best_submission_id: null,
  open_to_work: false,
  open_to_work_email: null,
  created_at: created,
  updated_at: created,
});

const seed = (): Record<string, Row[]> => ({
  profiles: [
    // The original profile, and a second one a mistyped X-GitHub-User made.
    profileRow("p-original", "Some-Dev", 40, "2025-06-22T00:00:00Z"),
    profileRow("p-typo", "Some-dev", 1, "2026-09-01T00:00:00Z"),
    profileRow("p-other", "someone-else", 3, "2025-07-01T00:00:00Z"),
  ],
  submissions: [
    { id: "s-1", username: "Some-Dev", submitted_at: "2026-09-25T00:00:00Z", total_cost: 100, total_tokens: 1000 },
  ],
  daily_breakdowns: [],
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

{
  const service = new SupabaseProfilesService(fakeClient(seed()) as never);
  for (const casing of ["Some-Dev", "Some-dev", "some-dev", "SOME-DEV"]) {
    const profile = await service.getProfile(casing);
    assert.ok(profile, `${casing} should resolve`);
    assert.equal(profile.id, "p-original", `${casing} should land on the original profile`);
    assert.equal(profile.submissions.length, 1);
  }
  check("every casing of a handle with two profile rows resolves to the same profile");
}

{
  const service = new SupabaseProfilesService(fakeClient(seed()) as never);
  assert.equal(await service.getProfile("%"), null);
  assert.equal(await service.getProfile("*"), null);
  assert.equal(await service.getProfile("Some_Dev"), null);
  assert.equal(await service.getProfile("nobody"), null);
  check("wildcards in the URL match nothing instead of an arbitrary profile");
}

// ---------------------------------------------------------------------------
// Submitting under a new casing must not create another profile row
// ---------------------------------------------------------------------------

{
  const db = seed();
  db.profiles = db.profiles.filter((p) => p.id !== "p-typo");
  const service = new SupabaseSubmissionsService(fakeClient(db) as never, {
    checkLimit: async () => ({ allowed: true, remaining: 1 }),
  });
  // updateProfile is private; drive it directly rather than the whole submit.
  await (service as unknown as {
    updateProfile(d: unknown, id: string, isNew: boolean): Promise<void>;
  }).updateProfile(
    { username: "some-DEV", githubUsername: "some-DEV", source: "cli", verified: false },
    "s-2",
    false
  );

  const rows = db.profiles.filter((p) => ilikeMatches(p.username, "some-dev"));
  assert.equal(rows.length, 1, "no second profile row for a new casing");
  assert.equal(rows[0].best_submission_id, "s-2");
  assert.equal(rows[0].github_username, "Some-Dev", "stored casing is kept");
  check("a submission under a different casing updates the existing profile");
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

{
  assert.equal(likeLiteral("B-Etter.Digital"), "B-Etter.Digital");
  assert.equal(likeLiteral("a%b_c*d\\e"), "a\\%b\\_c\\*d\\\\e");
  assert.equal(pickCanonicalProfile([]), null);
  assert.equal(pickCanonicalProfile(null), null);
  const tie = pickCanonicalProfile([
    { id: "newer", total_submissions: 2, created_at: "2026-01-02T00:00:00Z" },
    { id: "older", total_submissions: 2, created_at: "2026-01-01T00:00:00Z" },
  ]);
  assert.equal(tie?.id, "older");
  check("likeLiteral escapes wildcards; ties go to the oldest profile");
}

console.log(`\n${passed} profile lookup checks passed`);
