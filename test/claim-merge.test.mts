import assert from "node:assert/strict";

const { shouldReplaceClaimDay } = await import(
  "../src/lib/data/supabase/claim-merge.ts"
);

const day = (totalCost: number | string, totalTokens: number) => ({
  total_cost: totalCost,
  total_tokens: totalTokens,
});

assert.equal(
  shouldReplaceClaimDay(day(100, 1_000), day(60, 2_000)),
  false,
  "a lower-cost OAuth day must not replace a stronger CLI observation"
);

assert.equal(
  shouldReplaceClaimDay(day(60, 2_000), day(100, 1_000)),
  true,
  "a genuinely stronger observation should replace the prior day"
);

assert.equal(
  shouldReplaceClaimDay(day("0", 1_000), day(0, 2_000)),
  true,
  "tokens break cost ties for unpriced models"
);

assert.equal(
  shouldReplaceClaimDay(day(100, 2_000), day(100, 2_000)),
  false,
  "equal observations keep the existing row"
);

console.log("\n4 checks passed");
