/**
 * The tier ladder, and the SQL copy of its thresholds that buckets /stats.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const { TIERS, getTier, getNextTier, getTierProgress } = await import("../src/lib/tiers.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

{
  assert.equal(TIERS[0].min, 0, "everyone holds a tier");
  for (let i = 1; i < TIERS.length; i++) assert.ok(TIERS[i].min > TIERS[i - 1].min, "ascending");
  assert.equal(new Set(TIERS.map((t) => t.key)).size, TIERS.length);
  // The lower rungs are deliberately unchanged by the 2026-09 recalibration.
  assert.deepEqual(TIERS.slice(0, 4).map((t) => t.min), [0, 100, 1_000, 5_000]);
  assert.deepEqual(TIERS.slice(4).map((t) => [t.key, t.min]), [
    ["inferno", 25_000],
    ["supernova", 100_000],
    ["hypernova", 250_000],
  ]);
  check("ladder ascends; lower rungs unchanged, top re-spaced");
}

{
  assert.equal(getTier(99.99).key, "spark");
  assert.equal(getTier(100).key, "ember");
  assert.equal(getTier(24_999).key, "blaze");
  assert.equal(getTier(25_000).key, "inferno");
  assert.equal(getTier(99_999).key, "inferno");
  assert.equal(getTier(100_000).key, "supernova");
  assert.equal(getTier(250_000).key, "hypernova");
  assert.equal(getNextTier(250_000), null);
  assert.equal(getNextTier(120_000)?.key, "hypernova");
  check("boundaries are inclusive at each minimum");
}

{
  const mid = getTierProgress(175_000);
  assert.equal(mid.tier.key, "supernova");
  assert.equal(mid.next?.key, "hypernova");
  assert.equal(mid.remaining, 75_000);
  assert.equal(mid.progress, 0.5);
  const top = getTierProgress(440_000);
  assert.deepEqual([top.next, top.progress, top.remaining], [null, 1, 0]);
  check("progress to the next tier, and the top tier is complete");
}

{
  // /stats counts tiers in SQL. The newest migration that defines
  // get_site_stats() must bucket on exactly these thresholds, or the ladder
  // on /stats disagrees with every badge on the site.
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && readFileSync(new URL(f, dir), "utf8").includes("FUNCTION get_site_stats()"))
    .sort()
    .at(-1)!;
  const sql = readFileSync(new URL(latest, dir), "utf8");
  const buckets = [...sql.matchAll(/WHEN best >= (\d+)\s+THEN '(\w+)'/g)].map((m) => [m[2], Number(m[1])]);
  const expected = TIERS.slice(1).map((t) => [t.key, t.min]).reverse();
  assert.deepEqual(buckets, expected, `${latest} buckets`);
  assert.ok(sql.includes("ELSE 'spark'"));
  check(`SQL tier buckets (${latest}) match src/lib/tiers.ts`);
}

console.log(`\n${passed} passed, 0 failed`);
