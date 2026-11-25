/**
 * Tests for the VIBERANK_HOME release switch.
 * Run: node --import tsx test/home-flag.test.mts
 */
const flag = await import("../src/lib/home-flag.ts");

let passed = 0;
let failed = 0;

function eq(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Silence the expected typo warnings, but count them.
const realError = console.error;
let warnings = 0;
console.error = () => {
  warnings++;
};

console.log("parseHomeVariant");
eq("unset is legacy", flag.parseHomeVariant(undefined), "legacy");
eq("null is legacy", flag.parseHomeVariant(null), "legacy");
eq("blank is legacy", flag.parseHomeVariant("   "), "legacy");
eq("v2", flag.parseHomeVariant("v2"), "v2");
eq("legacy", flag.parseHomeVariant("legacy"), "legacy");
eq("case and spaces are forgiven", flag.parseHomeVariant(" V2 "), "v2");
const before = warnings;
eq("a typo falls back to legacy", flag.parseHomeVariant("v3"), "legacy");
eq("'true' is not v2", flag.parseHomeVariant("true"), "legacy");
eq("typos are reported", warnings - before, 2);
eq("valid values are not reported", (flag.parseHomeVariant("v2"), warnings - before), 2);

console.log("homeVariant");
eq("reads VIBERANK_HOME", flag.homeVariant({ VIBERANK_HOME: "v2" }), "v2");
eq("empty env is legacy", flag.homeVariant({}), "legacy");

console.log("boardHref");
eq("v2 board is the home", flag.boardHref("v2"), "/");
eq("legacy board is /week", flag.boardHref("legacy"), "/week");

console.error = realError;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
