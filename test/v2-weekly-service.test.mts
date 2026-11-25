/**
 * Tests for the v2 WeeklyService: the demo backend's shapes, the grace
 * freeze over a fake source, and the /api/v2 query parsers.
 * Run: node --import tsx test/v2-weekly-service.test.mts
 */
const { createDemoWeeklyService } = await import("../src/lib/data/demo/client.ts");
const { createWeeklyService } = await import("../src/lib/v2/service.ts");
const { parseBoardQuery, parseUsername, parseYear, parseWeekParam } = await import("../src/lib/v2/query.ts");
const { BRACKET_SIZE, FLEET_PLAN_EQ } = await import("../src/lib/v2/contract.ts");
import type { FrozenWeek, WeeklySource, WindowEntry } from "../src/lib/v2/service.ts";

let passed = 0;
let failed = 0;

function ok(name: string, cond: unknown, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

const NOW = new Date("2026-11-25T15:30:00Z"); // Wednesday of 2026-W48
const demo = createDemoWeeklyService(() => NOW);

console.log("[1] Demo board: this week, Ranked");
const board = await demo.getBoard({ window: "week", cls: "ranked", limit: 200 });
{
  ok("window and class echo back", board.window === "week" && board.cls === "ranked" && board.sort === "cost");
  ok("the week is the current ISO week", board.week.id === "2026-W48" && board.week.day === 3 && !board.week.closed);
  ok(`about 120 ranked (${board.counts.ranked})`, board.counts.ranked >= 100 && board.counts.ranked <= 150);
  ok(`some on Open (${board.counts.open})`, board.counts.open >= 10);
  ok(`a few fleets (${board.counts.fleets})`, board.counts.fleets >= 2 && board.counts.fleets <= 10);
  ok("total matches the class count", board.total === board.counts.ranked && board.rows.length === board.total);
  ok("totals count every class", board.totals.developers === board.counts.ranked + board.counts.open + board.counts.fleets);
  ok("ranks run 1..n", board.rows.every((row, index) => row.rank === index + 1));
  ok("sorted by cost", board.rows.every((row, index) => index === 0 || board.rows[index - 1].cost >= row.cost));
  ok("rank 1 has no gap; others a positive one", board.rows[0].gap === null && board.rows.slice(1).every((row) => (row.gap ?? 0) > 0));
  ok("seven days, Monday first, nothing after today", board.rows.every((row) => row.days.length === 7 && row.days.slice(3).every((cost) => cost === 0)));
  ok("ranked rows are GitHub-backed, clean, under the ceiling", board.rows.every((row) => row.trust !== "unverified" && !row.underReview && !row.heldReason && row.planEq <= FLEET_PLAN_EQ));
  ok("some rows moved since last week", board.rows.some((row) => typeof row.movement === "number" && row.movement !== 0));
  ok("some rows are new this week", board.rows.some((row) => row.movement === null));
  ok("streaks vary", new Set(board.rows.map((row) => row.streakWeeks)).size > 4);
  ok("every active row's streak includes this week", board.rows.every((row) => row.streakWeeks >= 1));
}

console.log("[2] Demo Open and Fleets");
{
  const open = await demo.getBoard({ window: "week", cls: "open" });
  ok("open rows say why they are held", open.rows.length > 0 && open.rows.every((row) => typeof row.heldReason === "string"));
  ok("open has unverified rows", open.rows.some((row) => row.heldReason === "Not verified with GitHub"));
  const allOpen = await demo.getBoard({ window: "week", cls: "open", limit: 200 });
  ok("open has rows under review", allOpen.rows.some((row) => row.underReview && row.heldReason?.startsWith("Under review")));
  const fleets = await demo.getBoard({ window: "week", cls: "fleets" });
  ok("fleets are above the ceiling", fleets.rows.every((row) => row.planEq > FLEET_PLAN_EQ && row.heldReason === "Above 10 plans a week"));
}

console.log("[3] Demo sorts, tools, paging, other windows");
{
  const tokens = await demo.getBoard({ window: "week", cls: "ranked", sort: "tokens", limit: 20 });
  ok("tokens sort is descending", tokens.rows.every((row, index) => index === 0 || tokens.rows[index - 1].tokens >= row.tokens));
  const efficiency = await demo.getBoard({ window: "week", cls: "ranked", sort: "efficiency", limit: 200 });
  ok("efficiency leaves out rows under $100", efficiency.rows.every((row) => row.cost >= 100));
  const codex = await demo.getBoard({ window: "week", cls: "ranked", tool: "codex", limit: 200 });
  ok("a tool board only lists that tool", codex.rows.length > 0 && codex.rows.every((row) => row.tools.includes("codex")));
  const page2 = await demo.getBoard({ window: "week", cls: "ranked", limit: 10, offset: 10 });
  ok("offset pages keep global ranks", page2.rows[0].rank === 11 && page2.rows.length === 10);
  const month = await demo.getBoard({ window: "month", cls: "ranked", limit: 5 });
  ok("month board has no day series or movement", month.rows.every((row) => row.days.length === 0 && row.movement === null));
  const all = await demo.getBoard({ window: "all", cls: "ranked", limit: 5 });
  ok("lifetime board ranks more developers than this week", all.totals.developers >= board.totals.developers);
  const last = await demo.getBoard({ window: "week", cls: "ranked", weekId: "2026-W47", limit: 5 });
  ok("a closed week reports day 7 and closed", last.week.closed && last.week.day === 7);
  ok("a closed week's days fill Saturday and Sunday", last.rows.some((row) => row.days[5] > 0 || row.days[6] > 0));
}

console.log("[4] Demo standing, recap, Wrapped");
{
  const middle = board.rows[60];
  const standing = await demo.getStanding(middle.username);
  ok("standing finds the user's rank", standing?.rank === middle.rank && standing.cls === "ranked");
  ok("of is the class size", standing?.of === board.counts.ranked);
  ok("above and below are the neighbours", standing?.above?.username === board.rows[59].username && standing?.below?.username === board.rows[61].username);
  ok(`bracket is ${BRACKET_SIZE} rows around the user`, standing?.bracket.length === BRACKET_SIZE && standing.bracket.some((row) => row.username === middle.username));
  ok("standing carries days and a best week", standing?.days.length === 7 && standing.bestWeek !== null);
  ok("handle lookup ignores case", (await demo.getStanding(middle.username.toUpperCase()))?.rank === middle.rank);
  ok("an unknown handle is null", (await demo.getStanding("nobody-here-xyz")) === null);
  const top = await demo.getStanding(board.rows[0].username);
  ok("rank 1 has nobody above", top?.above === null && top?.rank === 1);

  const recap = await demo.getRecap(middle.username, "2026-W48");
  ok("recap extends the standing", recap?.rank === middle.rank && (recap?.activeDays ?? 0) >= 1);
  ok("recap model shares sum to about 1", Math.abs((recap?.topModels ?? []).reduce((sum, model) => sum + model.share, 0) - 1) < 0.05);
  ok("recap tools are listed", (recap?.tools.length ?? 0) >= 1);
  ok("percentile is between 0 and 100", (recap?.percentile ?? -1) >= 0 && (recap?.percentile ?? 101) <= 100);

  const wrapped = await demo.getYear(middle.username, 2026);
  ok("Wrapped has twelve months", wrapped?.months.length === 12);
  ok("Wrapped months add up to the year", Math.abs((wrapped?.months ?? []).reduce((a, b) => a + b, 0) - (wrapped?.cost ?? 0)) < 1);
  ok("Wrapped daily cost is one entry per active day", wrapped?.dailyCost.length === wrapped?.activeDays);
  ok("no Wrapped for a year without usage", (await demo.getYear(middle.username, 2025)) === null);
  const windowRank = await demo.getWindowRank(middle.username, "2026-11-19", "2026-11-25", "cost");
  ok("window rank for the badge", (windowRank?.rank ?? 0) >= 1 && (windowRank?.of ?? 0) >= (windowRank?.rank ?? 0));
}

console.log("[5] Grace freeze over a fake source");
{
  const entry = (userKey: string, cost: number, verified = true): WindowEntry => ({
    userKey,
    username: userKey,
    verified,
    source: "oauth",
    reviewReasons: [],
    tools: ["claude"],
    cost,
    tokens: cost * 1_000_000,
    activeDays: 1,
    firstDate: "2026-11-16",
    lastDate: "2026-11-16",
    days: [{ date: "2026-11-16", cost, tokens: cost * 1_000_000 }],
    activeWeeks: ["2026-11-16"],
  });
  let live = [entry("alice", 500), entry("bob", 300), entry("carol", 900, false)];
  const stored: FrozenWeek[] = [];
  const source: WeeklySource = {
    async windowEntries(query) {
      return query.from === "2026-11-16" ? live : [];
    },
    async userHistory() {
      return null;
    },
    async frozenWeek(weekStart) {
      return stored.find((week) => week.weekStart === weekStart) ?? null;
    },
    async storeWeek(week) {
      stored.push(week);
    },
  };

  let clock = new Date("2026-11-23T06:00:00Z"); // inside W47's grace period
  const service = createWeeklyService(source, { now: () => clock });
  const during = await service.getBoard({ window: "week", cls: "ranked", weekId: "2026-W47" });
  const w47 = () => stored.filter((week) => week.weekStart === "2026-11-16");
  ok("inside the grace period W47 is not stored", w47().length === 0);
  ok("the frozen week before it is stored on the way (for movement)", stored.some((week) => week.weekStart === "2026-11-09"));
  ok("the week is still computed live", during.rows.map((row) => row.username).join() === "alice,bob");

  clock = new Date("2026-11-23T12:00:00Z"); // grace over
  await service.getBoard({ window: "week", cls: "ranked", weekId: "2026-W47" });
  ok("the first read after the grace period stores the week", w47().length === 1);
  ok("stored rows carry class and final rank", w47()[0].entries.find((e) => e.userKey === "alice")?.rank === 1 && w47()[0].entries.find((e) => e.userKey === "carol")?.cls === "open");

  live = [entry("bob", 5_000), ...live]; // a late day after the freeze
  const after = await service.getBoard({ window: "week", cls: "ranked", weekId: "2026-W47" });
  ok("late days no longer change a frozen week", after.rows[0].username === "alice" && after.rows[0].cost === 500);
  ok("the store happens once", w47().length === 1);
}

console.log("[6] Query parsing");
{
  const defaults = parseBoardQuery(new URLSearchParams(""), NOW);
  ok("defaults: week, ranked, cost", !("error" in defaults) && defaults.window === "week" && defaults.cls === "ranked" && defaults.sort === "cost" && defaults.limit === 50);
  const full = parseBoardQuery(new URLSearchParams("window=week&cls=fleets&sort=tokens&tool=Codex&week=2026-W47&limit=500&offset=20"), NOW);
  ok("reads every parameter, caps limit, lowercases tool", !("error" in full) && full.cls === "fleets" && full.tool === "codex" && full.weekId === "2026-W47" && full.limit === 200 && full.offset === 20);
  ok("rejects an unknown class", "error" in parseBoardQuery(new URLSearchParams("cls=everyone"), NOW));
  ok("rejects a malformed week", "error" in parseBoardQuery(new URLSearchParams("week=48"), NOW));
  ok("rejects a future week", "error" in parseBoardQuery(new URLSearchParams("week=2026-W50"), NOW));
  ok("rejects week with window=all", "error" in parseBoardQuery(new URLSearchParams("window=all&week=2026-W47"), NOW));
  ok("rejects a bad tool slug", "error" in parseBoardQuery(new URLSearchParams("tool=../etc"), NOW));
  ok("rejects a negative offset", "error" in parseBoardQuery(new URLSearchParams("offset=-1"), NOW));
  ok("username is decoded and trimmed", parseUsername("%20B-Etter.Digital") === "B-Etter.Digital" && parseUsername("alice") === "alice");
  ok("username with inner whitespace is refused", typeof parseUsername("Some%20One") === "object");
  ok("username with a slash is refused", typeof parseUsername("a%2Fb") === "object");
  ok("year bounds", parseYear("2026", NOW) === 2026 && typeof parseYear("2027", NOW) === "object" && typeof parseYear("26", NOW) === "object");
  ok("an absent week is undefined", parseWeekParam(null, NOW) === undefined);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
