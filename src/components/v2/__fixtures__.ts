// Example data shaped like the v2 contract, for the dev-only /v2-preview
// route. Never imported by a production page. Handles are invented; the
// curve follows the mockup (a top week near $5K falling to a few dollars).
import { PLAN_EQ_USD_PER_WEEK, type BoardClass, type BoardResult, type BoardRow, type BoardSort, type BoardWindow, type Standing, type WeekRef } from "@/lib/v2/contract";
import type { MonthStrip } from "./landing/Sections";
import type { SiteFacts } from "./landing/Hero";

const POOL = ["kestrel", "mwojcik", "tanaka-r", "faye0x", "lindqvist", "amara-o", "noor-builds", "pdelgado", "hyunwoo-k", "sato-dev", "brightwell", "okafor-c", "juniper-lab", "rmehta", "vasquez-io", "tobias-k", "ines-m", "quillfeather", "darko-p", "yilmaz-e", "harborline", "nkem-a", "luca-b", "wren-codes", "ostrander", "mirela-s", "theo-park", "zofia-n", "calder-j", "anouk-v", "bexley", "ravi-s", "halvorsen", "mina-t", "ptak", "oduya", "sorrel-dev", "kimura-h", "fenwick", "lior-z"];
const FLEET_NOTES = ["team, 9 seats", "agency, 14 seats", "pipeline", "team, 6 seats", "undeclared", "relay, declared", "team, 22 seats", "lab, 12 seats"];
const OPEN_NOTES = ["unclaimed CLI submission", "under review: one-day spike", "unclaimed CLI submission", "claimed, token not linked"];

export const FIXTURE_WEEK: WeekRef = {
  id: "2026-W48",
  start: "2026-11-23",
  end: "2026-11-29",
  day: 3,
  closesAt: "2026-11-30T00:00:00.000Z",
  closed: false,
};

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function handle(i: number, cls: BoardClass): string {
  const base = POOL[(i * 7 + (cls === "ranked" ? 0 : cls === "open" ? 3 : 5)) % POOL.length];
  return i < POOL.length ? base : `${base}-${Math.floor(i / POOL.length)}`;
}

const SPANS: Record<BoardClass, { n: number; hi: number; lo: number }> = {
  ranked: { n: 219, hi: 5200, lo: 6 },
  open: { n: 64, hi: 9800, lo: 12 },
  fleets: { n: 11, hi: 41000, lo: 13500 },
};

const WINDOW_SCALE: Record<BoardWindow, number> = { week: 1, month: 3.6, all: 38 };

function buildRows(cls: BoardClass, window: BoardWindow, tool: string | null): BoardRow[] {
  const span = SPANS[cls];
  const r = rng(cls.length * 7919 + span.n * 31 + window.length);
  const scale = WINDOW_SCALE[window];
  const rows: BoardRow[] = [];
  for (let i = 0; i < span.n; i++) {
    const cost = span.hi * Math.pow(span.lo / span.hi, i / (span.n - 1)) * (0.985 + r() * 0.03) * scale;
    const split = [0.6 + r(), 0.6 + r(), 0.4 + r() * 0.9];
    const sum = split[0] + split[1] + split[2];
    const tools = ["claude"];
    if (r() > 0.35) tools.push("codex");
    if (r() > 0.78) tools.push(r() > 0.5 ? "opencode" : "antigravity");
    const tokPerUsd = 0.9e6 + r() * 1.1e6;
    const weeks = window === "week" ? 1 : window === "month" ? 30 / 7 : 52;
    rows.push({
      rank: 0,
      username: handle(i, cls),
      tools,
      cost,
      tokens: cost * tokPerUsd,
      days: window === "week" ? [...split.map((x) => (x / sum) * cost), 0, 0, 0, 0] : [],
      movement: r() > 0.12 ? Math.round(r() * 9 - 3) : null,
      gap: null,
      planEq: cost / PLAN_EQ_USD_PER_WEEK / weeks,
      trust: cls === "ranked" ? "verified" : r() > 0.5 ? "claimed" : "unverified",
      underReview: cls === "open" && i % 4 === 1,
      heldReason: cls === "fleets" ? FLEET_NOTES[i % FLEET_NOTES.length] : cls === "open" ? OPEN_NOTES[i % OPEN_NOTES.length] : undefined,
      streakWeeks: 1 + Math.floor(r() * 13),
    });
  }
  const filtered = tool ? rows.filter((x) => x.tools.includes(tool)) : rows;
  return filtered;
}

function sortRows(rows: BoardRow[], sort: BoardSort): BoardRow[] {
  const key = (x: BoardRow) => (sort === "tokens" ? x.tokens : sort === "efficiency" ? x.tokens / Math.max(1, x.cost) : x.cost);
  const sorted = [...rows].sort((a, b) => key(b) - key(a));
  return sorted.map((x, i) => ({
    ...x,
    rank: i + 1,
    gap: i === 0 ? null : Math.max(1, sorted[i - 1].cost - x.cost),
    movement: i < 3 && x.movement !== null && x.movement < 0 ? 0 : x.movement,
  }));
}

/** Marks one ranked row as the visitor, at a chosen rank. */
function withMe(rows: BoardRow[], me: string | null, rank: number): BoardRow[] {
  if (!me || !rows[rank - 1]) return rows;
  const copy = [...rows];
  copy[rank - 1] = { ...copy[rank - 1], username: me, movement: 4, streakWeeks: 4, tools: ["claude", "codex"] };
  return copy;
}

export interface FixtureQuery {
  window: BoardWindow;
  cls: BoardClass;
  sort: BoardSort;
  tool: string | null;
}

export function fixtureBoard(q: FixtureQuery, limit = 50, offset = 0, me: string | null = null, meRank = 7): BoardResult {
  let all = sortRows(buildRows(q.cls, q.window, q.tool), q.sort);
  if (q.cls === "ranked" && q.window === "week" && !q.tool && q.sort === "cost") all = withMe(all, me, meRank);
  const totals = all.reduce((acc, x) => ({ developers: acc.developers + 1, tokens: acc.tokens + x.tokens, cost: acc.cost + x.cost }), { developers: 0, tokens: 0, cost: 0 });
  return {
    window: q.window,
    cls: q.cls,
    sort: q.sort,
    week: FIXTURE_WEEK,
    rows: all.slice(offset, offset + limit),
    total: all.length,
    counts: { ranked: SPANS.ranked.n, open: SPANS.open.n, fleets: SPANS.fleets.n },
    totals,
    updatedAt: "2026-11-25T14:02:00.000Z",
  };
}

export function fixtureStanding(me: string, meRank: number): Standing {
  const board = fixtureBoard({ window: "week", cls: "ranked", sort: "cost", tool: null }, 400, 0, me, meRank);
  const idx = meRank - 1;
  const row = board.rows[idx];
  const from = Math.max(0, idx - 15);
  return {
    username: me,
    week: FIXTURE_WEEK,
    cls: "ranked",
    rank: row.rank,
    of: board.total,
    cost: row.cost,
    tokens: row.tokens,
    planEq: row.planEq,
    movement: row.movement,
    above: idx > 0 ? { username: board.rows[idx - 1].username, cost: board.rows[idx - 1].cost } : null,
    below: board.rows[idx + 1] ? { username: board.rows[idx + 1].username, cost: board.rows[idx + 1].cost } : null,
    bracket: board.rows.slice(from, from + 30),
    streakWeeks: row.streakWeeks,
    bestWeek: { weekId: "2026-W44", cost: row.cost * 1.3, rank: Math.max(1, meRank - 3) },
    days: row.days,
    trust: "verified",
  };
}

export const FIXTURE_FACTS: SiteFacts = { developers: 1408, tokens: 45.9e12 };

export const FIXTURE_STRIP: MonthStrip = {
  label: "October 2026",
  developers: 281,
  models: [
    { name: "Opus 5.5", share: 57, color: "var(--v-anthropic)" },
    { name: "GPT-6 Astra", share: 19, color: "var(--v-openai)" },
    { name: "GPT-6.1 Sol", share: 7, color: "var(--v-openai)" },
    { name: "Fable 5.1", share: 4, color: "var(--v-anthropic)" },
    { name: "Sonnet 5.5", share: 2, color: "var(--v-anthropic)" },
  ],
  tools: [
    { name: "Claude Code", share: 86, color: "var(--v-anthropic)" },
    { name: "Codex", share: 70, color: "var(--v-openai)" },
    { name: "Antigravity", share: 17, color: "var(--v-google)" },
    { name: "OpenCode", share: 16, color: "var(--v-open)" },
    { name: "Grok Build", share: 9, color: "var(--v-open)" },
  ],
};
