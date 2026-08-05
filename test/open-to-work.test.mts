/**
 * Focused tests for open-to-work contact settings.
 * Run: node test/open-to-work.test.mts
 */

const { buildWorkEmailHref, normalizeWorkEmail } = await import("../src/lib/open-to-work.ts");

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

console.log("\n[1] Work email normalization");
{
  ok("trims valid email", normalizeWorkEmail("  hire@b-etter.digital  ") === "hire@b-etter.digital");
  ok("turns empty input into null", normalizeWorkEmail("   ") === null);
  ok("turns null input into null", normalizeWorkEmail(null) === null);
}

console.log("\n[2] Work email validation");
{
  for (const value of [
    "not an email",
    "hire@example.com?bcc=lead%40competitor.com",
    "hire@example.com&body=pre-filled",
    "hire@example.com%0D%0ABcc:lead%40competitor.com",
  ]) {
    try {
      normalizeWorkEmail(value);
      ok(`rejects ${value}`, false, "did not throw");
    } catch (error) {
      ok(`rejects ${value}`, error instanceof Error && error.message === "Enter a valid contact email.");
    }
  }
}

console.log("\n[3] Work email links are encoded");
{
  const href = buildWorkEmailHref("hire@b-etter.digital");
  ok("builds mailto link", href.startsWith("mailto:hire%40b-etter.digital?"), href);
  ok("encodes subject separately", href.includes("subject=Viberank%20work%20inquiry"), href);
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
