/**
 * Focused tests for profile model-list presentation.
 * Run: node test/profile-models.test.mts
 */

const { splitProfileModelRows } = await import("../src/lib/profile-models.ts");

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

console.log("\n[1] Profile model list can expand beyond the default rows");
{
  const entries = Array.from({ length: 11 }, (_, index) => [`model-${index + 1}`, 11 - index] as [string, number]);

  const collapsed = splitProfileModelRows(entries, { limit: 8, expanded: false });
  ok("shows only the default row count when collapsed", collapsed.visible.length === 8, `got ${collapsed.visible.length}`);
  ok("keeps hidden rows accessible", collapsed.hidden.length === 3, `got ${collapsed.hidden.length}`);
  ok("marks list as expandable", collapsed.canExpand);
  ok("sums hidden row values", collapsed.hiddenTotal === 6, `got ${collapsed.hiddenTotal}`);

  const expanded = splitProfileModelRows(entries, { limit: 8, expanded: true });
  ok("shows every row when expanded", expanded.visible.length === 11, `got ${expanded.visible.length}`);
  ok("hides no rows after expansion", expanded.hidden.length === 0, `got ${expanded.hidden.length}`);
  ok("still marks list as collapsible", expanded.canExpand);
}

console.log("\n[2] Short model lists do not render expansion controls");
{
  const entries: [string, number][] = [["opus", 3], ["sonnet", 2]];
  const rows = splitProfileModelRows(entries, { limit: 8, expanded: false });

  ok("shows all short-list rows", rows.visible.length === 2, `got ${rows.visible.length}`);
  ok("has no hidden rows", rows.hidden.length === 0, `got ${rows.hidden.length}`);
  ok("does not mark short list as expandable", !rows.canExpand);
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
