import assert from "node:assert/strict";

const {
  COMPARE_MATCHUPS,
  MIN_COHORT,
  buildMatchupStats,
  costSentence,
  matchupMetaTitle,
  matchupTitle,
  resolveMatchup,
  reversedTitle,
  whichToUse,
} = await import("../src/lib/compare.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

const matchup = (slug: string) => {
  const m = COMPARE_MATCHUPS.find((x) => x.slug === slug);
  assert.ok(m, `missing matchup ${slug}`);
  return m;
};

// A 30-day row: totalCost is then exactly the monthly burn.
const row = (username: string, totalCost: number, tools: string[], totalTokens = 3_000_000) => ({
  username,
  totalCost,
  tools,
  totalTokens,
  start: "2026-09-01",
  end: "2026-09-30",
});

{
  for (const tool of ["codex", "cursor", "opencode", "copilot", "gemini", "antigravity"]) {
    assert.ok(resolveMatchup(`claude-vs-${tool}`)?.canonical, `claude-vs-${tool} should be canonical`);
    const reversed = resolveMatchup(`${tool}-vs-claude`);
    assert.equal(reversed?.canonical, false);
    assert.equal(reversed?.matchup.slug, `claude-vs-${tool}`);
  }
  check("every Claude Code matchup exists, and its reversed slug resolves to it");
}

{
  // Existing URLs keep their equity: none of the original ten slugs moved.
  for (const slug of [
    "claude-vs-codex", "claude-vs-gemini", "claude-vs-copilot", "claude-vs-opencode",
    "codex-vs-gemini", "codex-vs-copilot", "codex-vs-opencode",
    "gemini-vs-copilot", "gemini-vs-opencode", "copilot-vs-opencode",
  ]) {
    assert.ok(resolveMatchup(slug)?.canonical, slug);
  }
  assert.equal(resolveMatchup("claude-vs-kiro"), null, "kiro has no data, so no page");
  assert.equal(resolveMatchup("codex-vs-cursor"), null, "cursor is only paired with Claude Code");
  check("original slugs stay canonical; tools without data get no page");
}

{
  assert.equal(matchupTitle(matchup("claude-vs-codex")), "Codex vs Claude Code");
  assert.equal(reversedTitle(matchup("claude-vs-codex")), "Claude Code vs Codex");
  assert.equal(matchupTitle(matchup("claude-vs-cursor")), "Cursor vs Claude Code");
  assert.equal(matchupTitle(matchup("codex-vs-gemini")), "Codex vs Gemini CLI");
  check("titles follow search order, Claude Code second");
}

{
  for (const m of COMPARE_MATCHUPS) {
    const title = matchupMetaTitle(m, 1_412);
    assert.ok(title.startsWith(matchupTitle(m)), `${title} should lead with the query`);
    if (m.slug !== "claude-vs-copilot") assert.ok(title.length <= 60, `${title} is ${title.length} chars`);
  }
  assert.equal(
    matchupMetaTitle(matchup("claude-vs-codex"), 1_412),
    "Codex vs Claude Code (2026): Measured Cost From 1,412 Devs"
  );
  assert.ok(!matchupMetaTitle(matchup("claude-vs-codex"), 0).includes(" 0 "), "no 'from 0 devs'");
  check("meta titles lead with the query and fit ~60 chars");
}

{
  const rows = [
    // 12 Claude-only devs at $1,000…$1,110
    ...Array.from({ length: 12 }, (_, i) => row(`c${i}`, 1000 + i * 10, ["claude"])),
    // 10 Codex-only devs at $200…$290
    ...Array.from({ length: 10 }, (_, i) => row(`x${i}`, 200 + i * 10, ["codex"])),
    // 4 who use both
    ...Array.from({ length: 4 }, (_, i) => row(`b${i}`, 5000, ["claude", "codex"])),
    // A resubmitter: only their larger submission counts
    row("c0", 10, ["claude"]),
    // Pre-tool-tracking row: no tools means Claude Code
    row("legacy", 1200, []),
    // Too short to extrapolate
    { username: "short", totalCost: 99999, tools: ["codex"], totalTokens: 1, start: "2026-09-01", end: "2026-09-03" },
  ];
  const s = buildMatchupStats(rows, "claude", "codex");
  assert.equal(s.a.developers, 17); // 12 + 4 + legacy
  assert.equal(s.b.developers, 14); // 10 + 4, short excluded
  assert.equal(s.both, 4);
  assert.equal(s.developers, 27);
  assert.equal(s.a.onlyDevelopers, 13);
  assert.equal(s.b.onlyDevelopers, 10);
  assert.equal(s.b.onlyMedianMonthlyUsd, 245);
  assert.ok(Math.abs(s.shareOfBUsingA - 4 / 14) < 1e-9);
  assert.equal(s.a.medianTokensPerDay, 100_000);
  check("cohorts: one row per dev, 30-day normalised, short spans and legacy rows handled");

  const sentence = costSentence(matchup("claude-vs-codex"), s);
  assert.ok(sentence?.startsWith("Developers who use only Codex run a median $245/month"), sentence ?? "null");
  assert.ok(sentence?.includes("Codex users consume less"));
  const verdict = whichToUse(matchup("claude-vs-codex"), s);
  assert.equal(verdict.length, 3);
  assert.ok(verdict[0].startsWith("Claude Code has more developers"));
  assert.ok(verdict[0].includes("29% of Codex developers also use Claude Code"));
  assert.ok(verdict[2].startsWith("Pick Codex if"));
  check("cost sentence and verdict are built from the measured cohorts");
}

{
  // Fewer than MIN_COHORT single-tool developers: no median, and the copy says so.
  const rows = [
    ...Array.from({ length: 20 }, (_, i) => row(`c${i}`, 1000, ["claude"])),
    ...Array.from({ length: MIN_COHORT - 1 }, (_, i) => row(`k${i}`, 50, ["cursor"])),
  ];
  const s = buildMatchupStats(rows, "claude", "cursor");
  assert.equal(s.b.onlyMedianMonthlyUsd, null);
  assert.equal(s.b.medianMonthlyUsd, null);
  assert.equal(costSentence(matchup("claude-vs-cursor"), s), null);
  const verdict = whichToUse(matchup("claude-vs-cursor"), s);
  assert.ok(verdict[1].includes("too few single-tool Cursor developers"), verdict[1]);
  check("small cohorts never print a median");
}

{
  const s = buildMatchupStats([], "claude", "codex");
  assert.equal(s.developers, 0);
  assert.equal(s.shareOfAUsingB, 0);
  assert.equal(whichToUse(matchup("claude-vs-codex"), s).length, 2);
  check("an empty board degrades to plan-price advice");
}

console.log(`\n${passed} compare checks passed`);
