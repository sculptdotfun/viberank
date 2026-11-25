/**
 * Tests for the invite loop's pure helpers: handle parsing, /vs links and
 * post text, head-to-head math and league re-ranking.
 * Run: node --import tsx test/v2-invite.test.mts
 */
const inv = await import("../src/lib/v2/invite.ts");

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

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `(got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

console.log("parseHandle");
eq("bare handle", inv.parseHandle("octocat"), "octocat");
eq("leading @ and spaces", inv.parseHandle("  @octo-cat "), "octo-cat");
eq("github URL", inv.parseHandle("https://github.com/octocat/"), "octocat");
eq("github without scheme", inv.parseHandle("github.com/octocat?tab=repos"), "octocat");
eq("viberank profile URL", inv.parseHandle("https://www.viberank.app/profile/B-etter.Digital"), "B-etter.Digital");
eq("empty", inv.parseHandle(""), null);
eq("only @", inv.parseHandle("@"), null);
eq("space inside", inv.parseHandle("octo cat"), null);
eq("leading hyphen", inv.parseHandle("-octo"), null);
eq("trailing hyphen", inv.parseHandle("octo-"), null);
eq("double hyphen", inv.parseHandle("octo--cat"), null);
eq("39 chars ok", inv.parseHandle("a".repeat(39)), "a".repeat(39));
eq("40 chars too long", inv.parseHandle("a".repeat(40)), null);
eq("script-ish rejected", inv.parseHandle("<script>"), null);

console.log("links and text");
eq("vsPath encodes", inv.vsPath("a b", "c/d"), "/vs/a%20b/c%2Fd");
eq("vsUrl", inv.vsUrl("me", "you"), "https://www.viberank.app/vs/me/you");
eq("challenge with rank", inv.challengeText("friend", 41), "I'm #41 on viberank this week. @friend, beat me:");
eq("challenge without rank", inv.challengeText("friend", null), "I'm on viberank this week. @friend, beat me:");
ok("invite names both and the command", /@bob.*@alice.*npx viberank-cli/.test(inv.inviteText("alice", "bob")));
ok("sameHandle ignores case", inv.sameHandle("Octo", "octo"));

console.log("compareWeek");
const z = [0, 0, 0, 0, 0, 0, 0];
{
  const c = inv.compareWeek({ cost: 300, tokens: 10, days: [100, 0, 200, 0, 0, 0, 0] }, { cost: 250, tokens: 20, days: [0, 150, 50, 50, 0, 0, 0] });
  eq("leader a", c.leader, "a");
  eq("gap", c.gap, 50);
  eq("ratio", c.ratio, 1.2);
  eq("day wins", c.dayWins, { a: 2, b: 2, tie: 0 });
  // running a-b: +100, -50, +100, +50 → a, b, a, a: two changes
  eq("lead changes", c.leadChanges, 2);
  eq("token leader b", c.tokenLeader, "b");
}
{
  const c = inv.compareWeek({ cost: 0, tokens: 0, days: z }, { cost: 0, tokens: 0, days: z });
  eq("nobody", c.leader, "none");
  eq("nobody gap", c.gap, 0);
  eq("nobody ratio", c.ratio, null);
}
{
  const c = inv.compareWeek({ cost: 0, tokens: 0, days: z }, { cost: 80, tokens: 5, days: [80, 0, 0, 0, 0, 0, 0] });
  eq("b leads alone", c.leader, "b");
  eq("ratio null when trailer has none", c.ratio, null);
  eq("no lead change from a first lead", c.leadChanges, 0);
}
eq("tie", inv.compareWeek({ cost: 10, tokens: 1, days: z }, { cost: 10.001, tokens: 1, days: z }).leader, "tie");

console.log("tallyWeeks");
{
  const t = inv.tallyWeeks([
    { weekId: "2026-W41", a: 0, b: 0 },
    { weekId: "2026-W42", a: 10, b: 5 },
    { weekId: "2026-W43", a: 3, b: 9 },
    { weekId: "2026-W44", a: 0, b: 4 },
    { weekId: "2026-W45", a: 7, b: 7 },
    { weekId: "2026-W46", a: 9, b: 1 },
    { weekId: "2026-W47", a: 8, b: 2 },
  ]);
  eq("wins", [t.a, t.b, t.tie], [3, 2, 1]);
  eq("played skips empty weeks", t.played, 6);
  eq("current streak", t.streak, { side: "a", weeks: 2 });
}
eq("empty tally", inv.tallyWeeks([]), { a: 0, b: 0, tie: 0, played: 0, streak: null });

console.log("pairedHeights");
{
  const h = inv.pairedHeights([100, 50, 0, 1, 0, 0, 0], [200, 0, 0, 0, 0, 0, 0]);
  eq("shared scale", h.a.slice(0, 2), [50, 25]);
  eq("max is 100", h.b[0], 100);
  eq("zero stays zero", h.a[2], 0);
  eq("tiny gets a floor", h.a[3], 6);
}

console.log("leagueRanks");
{
  const rows = inv.leagueRanks([
    { username: "c", cost: 10, tokens: 1, rank: 90, gap: 1 },
    { username: "a", cost: 50, tokens: 1, rank: 3, gap: 2 },
    { username: "b", cost: 50, tokens: 9, rank: 2, gap: null },
  ]);
  eq("order by cost then tokens", rows.map((r) => r.username), ["b", "a", "c"]);
  eq("re-ranked", rows.map((r) => r.rank), [1, 2, 3]);
  eq("gaps inside the league", rows.map((r) => r.gap), [null, 0.01, 40.01]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
