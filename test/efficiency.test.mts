/**
 * Efficiency board: tokens per dollar, weighted by volume, so a short cheap
 * history can't outrank long ones (a 1B-token, $120 submission was #1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { efficiencyScore, EFFICIENCY_PRIOR_RATE, EFFICIENCY_PRIOR_COST } = await import("../src/lib/efficiency.ts");
const { SupabaseSubmissionsService } = await import("../src/lib/data/supabase/client.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

{
  const small = efficiencyScore(1e9, 120)!; // raw 8.3M/$
  const mid = efficiencyScore(20e9, 4_000)!; // raw 5.0M/$
  const heavy = efficiencyScore(420e9, 110_000)!; // raw 3.8M/$
  assert.ok(small < heavy && heavy < mid, `got ${small}, ${mid}, ${heavy}`);
  assert.ok(Math.abs(heavy / (420e9 / 110_000) - 1) < 0.03, "a heavy user is ranked on ~their own ratio");
  assert.ok(Math.abs(small - EFFICIENCY_PRIOR_RATE) < Math.abs(1e9 / 120 - EFFICIENCY_PRIOR_RATE), "a short history is pulled toward the median");
  check("1B tokens for $120 no longer outranks long, efficient histories");
}

{
  assert.equal(efficiencyScore(1e9, 0), null);
  assert.equal(efficiencyScore(1e9, -5), null);
  assert.equal(efficiencyScore(EFFICIENCY_PRIOR_RATE * 500, 500), EFFICIENCY_PRIOR_RATE, "a median ratio stays the median");
  check("no spend has no score; the median is a fixed point");
}

{
  const sql = readFileSync(new URL("../supabase/migrations/020_efficiency_score.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`+ ${EFFICIENCY_PRIOR_RATE * EFFICIENCY_PRIOR_COST})`), "SQL prior tokens match");
  assert.ok(sql.includes(`(total_cost + ${EFFICIENCY_PRIOR_COST})`), "SQL prior cost matches");
  check("the generated column uses the same constants as src/lib/efficiency.ts");
}

{
  // Before migration 020 the score column doesn't exist: fall back to the raw
  // ratio instead of failing the board.
  const orders: string[] = [];
  const client = {
    from: () => {
      let column = "";
      const q = {
        select: () => q,
        order: (c: string) => ((column = c), orders.push(c), q),
        range: () => q,
        or: () => q,
        contains: () => q,
        eq: () => q,
        gte: () => q,
        then: (ok: (v: unknown) => unknown) =>
          Promise.resolve(
            column === "efficiency_score"
              ? { data: null, count: null, error: { code: "42703", message: "column submissions.efficiency_score does not exist" } }
              : { data: [], count: 0, error: null }
          ).then(ok),
      };
      return q;
    },
  };
  const service = new SupabaseSubmissionsService(client as never, { checkLimit: async () => ({ allowed: true, remaining: 1 }) } as never);
  const result = await service.getLeaderboard({ sortBy: "efficiency" });
  assert.deepEqual(orders, ["efficiency_score", "tokens_per_dollar"]);
  assert.deepEqual(result.items, []);
  orders.length = 0;
  await service.getLeaderboard({ sortBy: "cost" });
  assert.deepEqual(orders, ["total_cost"], "other sorts never touch the score");
  check("before migration 020 the board falls back to the raw ratio");
}

console.log(`\n${passed} passed, 0 failed`);
