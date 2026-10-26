/**
 * The compact token formatter behind share cards and badges. The profile
 * card had its own that stopped at billions and printed "1167.3B tokens".
 */
import assert from "node:assert/strict";

const { formatTokensCompact } = await import("../src/lib/utils.ts");
const { badgeTokens } = await import("../src/lib/badge.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

{
  assert.equal(formatTokensCompact(1_167_300_000_000), "1.2T", "trillions, not 1167.3B");
  assert.equal(formatTokensCompact(26_100_000_000), "26.1B");
  assert.equal(formatTokensCompact(940_000_000), "940M");
  assert.equal(formatTokensCompact(12_400), "12K");
  assert.equal(formatTokensCompact(512), "512");
  check("each magnitude gets its own unit");
}

{
  assert.equal(formatTokensCompact(0), "0");
  assert.equal(formatTokensCompact(-5), "0");
  assert.equal(formatTokensCompact(Number.NaN), "0");
  check("nonsense input reads as zero");
}

{
  for (const n of [512, 940_000_000, 26_100_000_000, 1_167_300_000_000]) {
    assert.equal(badgeTokens(n), formatTokensCompact(n));
  }
  check("badges and share cards print the same number");
}

console.log(`\n${passed} passed`);
