// Contract-shaped sample data for the share surfaces. Used by the dev preview
// route and, only when VIBERANK_SHARE_FIXTURES=1 outside production, by the
// loaders, so the real pages and OG images can be looked at before the weekly
// data layer lands.
import type { BoardRow, Standing, WeekRecap, WeekRef, YearWrapped } from "@/lib/v2/contract";

const closedWeek: WeekRef = {
  id: "2026-W47",
  start: "2026-11-16",
  end: "2026-11-22",
  day: 7,
  closesAt: "2026-11-23T00:00:00Z",
  closed: true,
};

const liveWeek: WeekRef = {
  id: "2026-W48",
  start: "2026-11-23",
  end: "2026-11-29",
  day: 3,
  closesAt: "2026-11-30T00:00:00Z",
  closed: false,
};

function row(rank: number, username: string, cost: number, extra: Partial<BoardRow> = {}): BoardRow {
  return {
    rank,
    username,
    tools: ["claude", "codex"],
    cost,
    tokens: Math.round(cost * 1.4e6),
    days: [cost * 0.2, cost * 0.25, cost * 0.2, cost * 0.15, cost * 0.2, 0, 0],
    movement: 0,
    gap: null,
    planEq: cost / 1300,
    trust: "verified",
    underReview: false,
    streakWeeks: 4,
    ...extra,
  };
}

const bracket: BoardRow[] = [
  row(1, "kestrel", 1940),
  row(2, "juniper-lab", 1315),
  row(3, "fixture", 1146, { movement: 6 }),
  row(4, "amara-o", 1012),
  row(5, "yilmaz-e", 895),
];

export const fixtureRecap: WeekRecap = {
  username: "fixture",
  avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
  week: closedWeek,
  cls: "ranked",
  rank: 3,
  of: 29,
  cost: 1146.42,
  tokens: 1_620_000_000,
  planEq: 0.88,
  movement: 6,
  above: { username: "juniper-lab", cost: 1315.1 },
  below: { username: "amara-o", cost: 1012.3 },
  bracket,
  streakWeeks: 9,
  bestWeek: { weekId: "2026-W44", cost: 1388.2, rank: 2 },
  days: [212.4, 301.9, 344.7, 243.1, 44.3, 0, 0],
  trust: "verified",
  activeDays: 5,
  topModels: [
    { model: "claude-opus-4-5-20251101", cost: 814.0, share: 0.71 },
    { model: "gpt-5.1-codex", cost: 252.2, share: 0.22 },
    { model: "claude-haiku-4-5-20251001", cost: 46.0, share: 0.04 },
    { model: "glm-4.6", cost: 34.2, share: 0.03 },
  ],
  tools: [
    { tool: "claude", share: 0.78 },
    { tool: "codex", share: 0.22 },
  ],
  percentile: 88,
};

export const fixtureStanding: Standing = {
  username: "fixture",
  avatarUrl: fixtureRecap.avatarUrl,
  week: liveWeek,
  cls: "ranked",
  rank: 7,
  of: 31,
  cost: 823.4,
  tokens: 1_090_000_000,
  planEq: 0.63,
  movement: 4,
  above: { username: "mina-t", cost: 849.0 },
  below: { username: "pdelgado", cost: 811.2 },
  bracket,
  streakWeeks: 10,
  bestWeek: { weekId: "2026-W44", cost: 1388.2, rank: 2 },
  days: [288.1, 311.6, 223.7, 0, 0, 0, 0],
  trust: "verified",
};

/** A held entry: public on Open, with the reason shown. */
export const fixtureHeldStanding: Standing = {
  ...fixtureStanding,
  cls: "open",
  rank: 12,
  of: 64,
  movement: null,
  trust: "claimed",
  heldReason: "One day is 40× this profile's median day. Ranked once a maintainer clears it.",
  above: { username: "relay-42", cost: 905.0 },
};

/** Deterministic pseudo-random numbers so the preview doesn't reshuffle. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function yearDaily(): [string, number][] {
  const rand = seeded(48);
  const out: [string, number][] = [];
  const start = Date.UTC(2026, 0, 1);
  const end = Date.UTC(2026, 10, 25);
  for (let t = start, i = 0; t <= end; t += 86_400_000, i++) {
    const dow = new Date(t).getUTCDay();
    const ramp = 0.25 + (i / 330) * 1.1;
    const weekend = dow === 0 || dow === 6;
    // A quiet stretch in late March and a lighter August, like a real year.
    const gap = (i >= 78 && i <= 92) || (i >= 214 && i <= 224 && rand() < 0.7);
    if (gap || (weekend && rand() < 0.6) || rand() < 0.12) continue;
    out.push([new Date(t).toISOString().slice(0, 10), Math.round(rand() * 260 * ramp * 100) / 100 + 4]);
  }
  return out;
}

const daily = yearDaily();
const months = Array.from({ length: 12 }, (_, m) =>
  daily.filter(([d]) => Number(d.slice(5, 7)) === m + 1).reduce((s, [, c]) => s + c, 0)
);

export const fixtureYear: YearWrapped = {
  username: "fixture",
  avatarUrl: fixtureRecap.avatarUrl,
  year: 2026,
  cost: months.reduce((s, c) => s + c, 0),
  tokens: 61_200_000_000,
  activeDays: daily.length,
  longestStreakDays: 44,
  bestWeek: { weekId: "2026-W44", cost: 1388.2, rank: 2 },
  topModels: [
    { model: "claude-opus-4-5-20251101", cost: 19_400, share: 0.58 },
    { model: "claude-sonnet-4-5-20250929", cost: 6_700, share: 0.2 },
    { model: "gpt-5.1-codex", cost: 4_300, share: 0.13 },
    { model: "gemini-2.5-pro", cost: 1_700, share: 0.05 },
    { model: "glm-4.6", cost: 1_300, share: 0.04 },
  ],
  tools: [
    { tool: "claude", share: 0.74 },
    { tool: "codex", share: 0.16 },
    { tool: "opencode", share: 0.06 },
    { tool: "gemini", share: 0.04 },
  ],
  months,
  percentile: 94,
  dailyCost: daily,
};

/** Fixture data renamed to the requested user, so any URL previews. */
export function asUser<T extends { username: string; bracket?: BoardRow[] }>(data: T, username: string): T {
  const bracket = data.bracket?.map((r) => (r.username === "fixture" ? { ...r, username } : r));
  return bracket ? { ...data, username, bracket } : { ...data, username };
}
