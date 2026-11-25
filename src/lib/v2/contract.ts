// viberank v2 contract: the shapes shared by the data layer, the API, the
// site and the CLI. Four parts of v2 were built in parallel against this file,
// so change it only with all of its consumers in view.
//
// The v2 idea: the week is the unit of play. Every Monday 00:00 UTC a new week
// opens; the home board ranks this week's usage. Only believable entries are
// Ranked; everything else stays public on Open or Fleets with the reason shown.

/** Which slice of time a board covers. "all" is the old lifetime board (/records). */
export type BoardWindow = "week" | "month" | "all";

/**
 * ranked: GitHub-verified, not under review, at or under FLEET_PLAN_EQ for the window.
 * open:   everyone else who is not a fleet (unclaimed CLI submissions, under review).
 * fleets: above FLEET_PLAN_EQ plan-equivalents a week; teams, relays, agent farms.
 */
export type BoardClass = "ranked" | "open" | "fleets";

export type BoardSort = "cost" | "tokens" | "efficiency";

export type TrustMark = "verified" | "claimed" | "unverified";

/** API-equivalent USD that one fully used top-tier subscription plan reaches in a week (#195). */
export const PLAN_EQ_USD_PER_WEEK = 1300;

/** Above this many plan-equivalents per week an entry is a fleet, not a person. */
export const FLEET_PLAN_EQ = 10;

/** Hours after a week closes during which late days still count for that week. */
export const WEEK_GRACE_HOURS = 12;

/** How many rows around you make up "your bracket". */
export const BRACKET_SIZE = 30;

export interface WeekRef {
  /** ISO week id, e.g. "2026-W48". */
  id: string;
  /** Monday, YYYY-MM-DD (UTC). */
  start: string;
  /** Sunday, YYYY-MM-DD (UTC). */
  end: string;
  /** 1 = Monday … 7 = Sunday; 7 for a closed week. */
  day: number;
  /** ISO timestamp when the week closes (next Monday 00:00 UTC). */
  closesAt: string;
  closed: boolean;
}

export interface BoardRow {
  rank: number;
  username: string;
  avatarUrl?: string;
  tools: string[];
  cost: number;
  tokens: number;
  /** Cost per day of the window, Monday first for a week (length 7); empty for month/all. */
  days: number[];
  /** Rank change against the previous week's final rank; null when new on the board. */
  movement: number | null;
  /** Cost needed to pass the row above; null for rank 1. */
  gap: number | null;
  /** cost / PLAN_EQ_USD_PER_WEEK, scaled to the window length. */
  planEq: number;
  trust: TrustMark;
  underReview: boolean;
  /** Why the row is on Open or Fleets instead of Ranked; absent on Ranked rows. */
  heldReason?: string;
  /** Consecutive closed weeks with usage, plus this week if it has usage. */
  streakWeeks: number;
}

export interface BoardParams {
  window: BoardWindow;
  cls: BoardClass;
  sort?: BoardSort;
  tool?: string;
  /** For window "week": which week; defaults to the current one. */
  weekId?: string;
  limit?: number;
  offset?: number;
}

export interface BoardResult {
  window: BoardWindow;
  cls: BoardClass;
  sort: BoardSort;
  week: WeekRef;
  rows: BoardRow[];
  /** Rows in this class and window (for paging and "of N"). */
  total: number;
  counts: { ranked: number; open: number; fleets: number };
  /** Site totals for the window: developers with usage and tokens. */
  totals: { developers: number; tokens: number; cost: number };
  updatedAt: string;
}

export interface Standing {
  username: string;
  avatarUrl?: string;
  week: WeekRef;
  cls: BoardClass;
  /** null when the user has no usage this week. */
  rank: number | null;
  of: number;
  cost: number;
  tokens: number;
  planEq: number;
  movement: number | null;
  /** The row directly above and below in the same class. */
  above: { username: string; cost: number } | null;
  below: { username: string; cost: number } | null;
  /** Up to BRACKET_SIZE rows centred on the user, same class, this week. */
  bracket: BoardRow[];
  streakWeeks: number;
  bestWeek: { weekId: string; cost: number; rank: number | null } | null;
  /** Cost per day this week, Monday first. */
  days: number[];
  trust: TrustMark;
  heldReason?: string;
}

export interface WeekRecap extends Standing {
  activeDays: number;
  topModels: { model: string; cost: number; share: number }[];
  tools: { tool: string; share: number }[];
  /** Percent of developers with usage this week who are below this user, 0–100. */
  percentile: number;
}

export interface YearWrapped {
  username: string;
  avatarUrl?: string;
  year: number;
  cost: number;
  tokens: number;
  activeDays: number;
  longestStreakDays: number;
  bestWeek: { weekId: string; cost: number; rank: number | null } | null;
  topModels: { model: string; cost: number; share: number }[];
  tools: { tool: string; share: number }[];
  /** Cost per month, January first (length 12). */
  months: number[];
  /** Percent of the year's developers below this user, 0–100. */
  percentile: number;
  /** Daily cost for the year, for the heatmap: [YYYY-MM-DD, cost]. */
  dailyCost: [string, number][];
}

export interface WeeklyService {
  getBoard(params: BoardParams): Promise<BoardResult>;
  getStanding(username: string, weekId?: string): Promise<Standing | null>;
  getRecap(username: string, weekId: string): Promise<WeekRecap | null>;
  getYear(username: string, year: number): Promise<YearWrapped | null>;
}

// Public HTTP routes (implemented in src/app/api, consumed by the site, CLI and plugin):
//   GET /api/v2/board?window=week|month|all&cls=ranked|open|fleets&sort=&tool=&week=&limit=&offset=  -> BoardResult
//   GET /api/v2/standing/{username}?week=  -> Standing (404 when unknown)
//   GET /api/v2/recap/{username}/{weekId}  -> WeekRecap
//   GET /api/v2/wrapped/{username}/{year}  -> YearWrapped
// Pages:
//   /                       this week, Ranked, with your row pinned and your bracket
//   /records                the lifetime board (old home)
//   /fleets                 the Fleets board
//   /recap/{weekId}/{user}  shareable week recap (noindex), OG image at /api/og/week/{weekId}/{user}
//   /wrapped/2026/{user}    Wrapped 2026, OG image at /api/og/wrapped/2026/{user}
