/**
 * Leaderboard filter-reset tests.
 *
 * The board empties its list when the filters change and relies on a hook
 * fetch to refill it. These replay the sequences that left it blank on the
 * live site: a lone custom date on the tokens board, and pressing All with
 * only one end of a range set.
 */
import assert from "node:assert/strict";
import type { BoardFilters } from "../src/lib/leaderboard-query.ts";

// Dynamic import: tsx transpiles the source to CJS, so a static named import
// fails to bind at instantiation time.
const { boardQueryKey, leaderboardQuery } = await import("../src/lib/leaderboard-query.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

const DEFAULT: BoardFilters = { sortBy: "cost", tool: null, verifiedOnly: false, dateFrom: "", dateTo: "" };

/**
 * Replays Leaderboard.tsx's two halves against a filter sequence: the reset
 * effect empties the list whenever `boardQueryKey` changes, and a hook only
 * fetches (and so refills the list) when its params change. Returns whether
 * the board has rows after each step.
 */
function replay(steps: Array<Partial<BoardFilters>>): boolean[] {
  let filters = DEFAULT;
  let key = boardQueryKey(filters);
  let fetched = JSON.stringify(leaderboardQuery(filters, 0));
  let hasRows = true; // the server-seeded first page

  return steps.map((step) => {
    filters = { ...filters, ...step };
    const nextKey = boardQueryKey(filters);
    const nextFetch = JSON.stringify(leaderboardQuery(filters, 0));
    if (nextKey !== key) hasRows = false;
    if (nextFetch !== fetched) hasRows = true; // the response lands
    key = nextKey;
    fetched = nextFetch;
    return hasRows;
  });
}

// ---------------------------------------------------------------------------
// The reported bug
// ---------------------------------------------------------------------------

{
  // Tokens, then the first date of a custom range. No range yet, so no new
  // fetch; the board must keep its rows rather than read "No submissions yet".
  const rows = replay([{ sortBy: "tokens" }, { dateFrom: "2026-09-01" }]);
  assert.deepEqual(rows, [true, true], "one date on the tokens board blanked it");
  check("picking one end of a custom range keeps the tokens board");
}

{
  // Going back: complete the range, clear its end, then press All. The last
  // two steps change the inputs but never the query.
  const rows = replay([
    { sortBy: "tokens" },
    { dateFrom: "2026-09-01" },
    { dateTo: "2026-09-20" },
    { dateTo: "" },
    { dateFrom: "" },
  ]);
  assert.deepEqual(rows, [true, true, true, true, true], `board went blank: ${JSON.stringify(rows)}`);
  check("clearing a range one end at a time, then All, restores the board");
}

{
  // Same thing started from To instead of From, and via the cost board.
  const rows = replay([{ dateTo: "2026-09-20" }, { dateFrom: "2026-09-01" }, { dateFrom: "" }, { dateTo: "" }]);
  assert.deepEqual(rows, [true, true, true, true]);
  check("either end on its own leaves the board populated");
}

// ---------------------------------------------------------------------------
// The query itself
// ---------------------------------------------------------------------------

{
  // A real filter change must still reset, or the previous view's rows would
  // sit under the new toggle.
  const base = boardQueryKey({ ...DEFAULT, sortBy: "tokens" });
  assert.notEqual(boardQueryKey({ ...DEFAULT, sortBy: "tokens", dateFrom: "2026-09-18", dateTo: "2026-09-25" }), base);
  assert.notEqual(boardQueryKey({ ...DEFAULT, sortBy: "cost" }), base);
  assert.notEqual(boardQueryKey({ ...DEFAULT, sortBy: "tokens", tool: "codex" }), base);
  assert.notEqual(boardQueryKey({ ...DEFAULT, sortBy: "tokens", verifiedOnly: true }), base);
  check("sort, a complete range, tool and verified each start a new query");
}

{
  const lone = leaderboardQuery({ ...DEFAULT, sortBy: "tokens", dateFrom: "2026-09-01" }, 2);
  assert.equal(lone.kind, "all-time", "a single date is not a range");
  assert.equal(lone.params.sortBy, "tokens");

  const ranged = leaderboardQuery({ ...DEFAULT, sortBy: "tokens", dateFrom: "2026-09-18", dateTo: "2026-09-25" }, 2);
  assert.equal(ranged.kind, "date-range");
  assert.equal(ranged.params.sortBy, "tokens", "the range must rank on the period's tokens");
  check("only a complete range switches to the date-range query");
}

{
  // The date-range board has no efficiency ordering and fetches by cost, so
  // efficiency and cost are the same query there: no reset, no blank.
  const range = { dateFrom: "2026-09-18", dateTo: "2026-09-25" };
  assert.equal(
    boardQueryKey({ ...DEFAULT, ...range, sortBy: "efficiency" }),
    boardQueryKey({ ...DEFAULT, ...range, sortBy: "cost" })
  );
  check("efficiency under a date filter is the cost query it actually runs");
}

{
  // Returning to the defaults must produce the default query again, which is
  // what lets the page-0 fetch run instead of matching nothing.
  const rows = replay([{ sortBy: "tokens" }, { dateFrom: "2026-09-18", dateTo: "2026-09-25" }, { dateFrom: "", dateTo: "" }, { sortBy: "cost" }]);
  assert.deepEqual(rows, [true, true, true, true]);
  assert.equal(boardQueryKey({ ...DEFAULT }), boardQueryKey({ ...DEFAULT, dateFrom: "2026-09-18" }));
  check("tokens, 7d, All, Cost ends on the default board");
}

console.log(`\n${passed} passed, 0 failed`);
