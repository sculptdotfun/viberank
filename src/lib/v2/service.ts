// The WeeklyService, written once over a small data source. The Supabase
// backend supplies window totals from the v2 RPCs (migration 024) and stores
// frozen weeks; the demo backend supplies generated data. Everything else
// (classification, ranking, movement, streaks, brackets, recaps, Wrapped) is
// here, so both backends behave the same and the tests exercise the real path.

import {
  BRACKET_SIZE,
  type BoardClass,
  type BoardParams,
  type BoardResult,
  type BoardRow,
  type BoardSort,
  type BoardWindow,
  type Standing,
  type TrustMark,
  type WeekRecap,
  type WeekRef,
  type WeeklyService,
  type YearWrapped,
} from "./contract";
import { classify, movementFor, planEqFor, roundPlanEq, streakWeeks, trustMarkFor } from "./trust";
import {
  addDays,
  daysBetween,
  isClosed,
  isFrozen,
  isoDate,
  monthWindow,
  previousWeekId,
  weekDates,
  weekEnd,
  weekIdOf,
  weekRef,
  weekStart,
} from "./week";
import { efficiencyScore } from "../efficiency";
import { computeStreaks } from "../streaks";
import { rankInWindow } from "../badge";

// ============================================================================
// SOURCE
// ============================================================================

export interface WindowDay {
  date: string;
  cost: number;
  tokens: number;
}

/** One developer's usage inside a date window, already deduplicated. */
export interface WindowEntry {
  /** lower(username): the identity submissions are merged on. */
  userKey: string;
  /** Display handle: the GitHub login when there is one. */
  username: string;
  avatarUrl?: string;
  verified: boolean;
  source?: string | null;
  reviewReasons: string[];
  /** Tools seen on the window's days. */
  tools: string[];
  cost: number;
  tokens: number;
  activeDays: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Per-day usage; present when the query asked for days. */
  days?: WindowDay[];
  /** Mondays (YYYY-MM-DD) of weeks with usage since `historyFrom`. */
  activeWeeks?: string[];
}

export interface WindowQuery {
  /** Inclusive bounds; null for an open end (the lifetime board). */
  from: string | null;
  to: string | null;
  tool?: string;
  withDays?: boolean;
  /** Also report activeWeeks from this Monday up to `to`. */
  historyFrom?: string;
}

export interface UserDay {
  date: string;
  cost: number;
  tokens: number;
  agents: string[];
  models: { model: string; cost: number }[];
}

export interface UserHistory {
  userKey: string;
  username: string;
  avatarUrl?: string;
  verified: boolean;
  source?: string | null;
  reviewReasons: string[];
  /** Every day with usage in the requested range, oldest first. */
  days: UserDay[];
}

/** A classified developer for one week; what a frozen week stores. */
export interface WeekEntry {
  userKey: string;
  username: string;
  avatarUrl?: string;
  tools: string[];
  cost: number;
  tokens: number;
  /** Cost per day, Monday first (length 7). */
  days: number[];
  planEq: number;
  trust: TrustMark;
  cls: BoardClass;
  underReview: boolean;
  heldReason?: string;
  streakWeeks: number;
  /** Final rank in its class by cost (stored with frozen weeks). */
  rank?: number;
  movement?: number | null;
}

export interface FrozenWeek {
  weekStart: string;
  frozenAt: string;
  totals: { developers: number; tokens: number; cost: number };
  entries: WeekEntry[];
}

export interface WeeklySource {
  windowEntries(query: WindowQuery): Promise<WindowEntry[]>;
  /** null when no submission carries this handle. */
  userHistory(username: string, from: string | null, to: string | null): Promise<UserHistory | null>;
  /** The stored result of a frozen week, or null when it was never stored. */
  frozenWeek(weekStart: string): Promise<FrozenWeek | null>;
  /** Persist a frozen week. Optional: the demo and browser clients cannot. */
  storeWeek?(week: FrozenWeek): Promise<void>;
}

/**
 * The contract's WeeklyService plus what the data layer's own routes need
 * (the README badge's rolling-window rank, #198). Consumers of the contract
 * see a plain WeeklyService.
 */
export interface WeeklyDataService extends WeeklyService {
  /** Rank among every developer with usage between two dates (inclusive), by cost or tokens. */
  getWindowRank(
    handle: string,
    from: string,
    to: string,
    sort: "cost" | "tokens"
  ): Promise<{ rank: number; of: number; cost: number; tokens: number } | null>;
}

export interface WeeklyServiceOptions {
  now?: () => Date;
  /** Memo lifetime for window reads inside one server instance. 0 disables. */
  cacheMs?: number;
}

// ============================================================================
// CONSTANTS AND SMALL HELPERS
// ============================================================================

/** Matches EFFICIENCY_MIN_COST in the Supabase layer: below it the ratio is noise. */
export const EFFICIENCY_FLOOR_COST = 100;
/** How far back streaks look. Two years is longer than any realistic run. */
export const STREAK_LOOKBACK_WEEKS = 104;
export const DEFAULT_BOARD_LIMIT = 50;
export const MAX_BOARD_LIMIT = 200;

const round2 = (value: number) => Math.round(value * 100) / 100;

function sortValue(entry: { cost: number; tokens: number }, sort: BoardSort): number {
  if (sort === "tokens") return entry.tokens;
  if (sort === "efficiency") return efficiencyScore(entry.tokens, entry.cost) ?? 0;
  return entry.cost;
}

/** One class, ordered by `sort`, with 1-based ranks. Ties fall to cost, tokens, then handle. */
export function rankClass<T extends { cls: BoardClass; cost: number; tokens: number; userKey: string }>(
  entries: T[],
  cls: BoardClass,
  sort: BoardSort
): (T & { rank: number })[] {
  return entries
    .filter((entry) => entry.cls === cls && (sort !== "efficiency" || entry.cost >= EFFICIENCY_FLOOR_COST))
    .sort(
      (a, b) =>
        sortValue(b, sort) - sortValue(a, sort) ||
        b.cost - a.cost ||
        b.tokens - a.tokens ||
        a.userKey.localeCompare(b.userKey)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function countsOf(entries: { cls: BoardClass }[]): BoardResult["counts"] {
  const counts = { ranked: 0, open: 0, fleets: 0 };
  for (const entry of entries) counts[entry.cls]++;
  return counts;
}

function totalsOf(entries: { cost: number; tokens: number }[]): BoardResult["totals"] {
  return {
    developers: entries.length,
    tokens: entries.reduce((sum, entry) => sum + entry.tokens, 0),
    cost: round2(entries.reduce((sum, entry) => sum + entry.cost, 0)),
  };
}

/** Rows centred on `index`, at most `size`, shifted inward at either end. */
export function bracketAround<T>(rows: T[], index: number, size = BRACKET_SIZE): T[] {
  if (rows.length <= size) return rows.slice();
  const start = Math.max(0, Math.min(index - Math.floor(size / 2), rows.length - size));
  return rows.slice(start, start + size);
}

/** Cost needed to pass the row above: its cost minus yours, plus a cent. */
function gapTo(above: { cost: number } | undefined, cost: number): number | null {
  if (!above) return null;
  return Math.max(0, round2(above.cost - cost + 0.01));
}

function toBoardRow(entry: WeekEntry & { rank: number }, gap: number | null, movement: number | null): BoardRow {
  return {
    rank: entry.rank,
    username: entry.username,
    ...(entry.avatarUrl ? { avatarUrl: entry.avatarUrl } : {}),
    tools: entry.tools,
    cost: round2(entry.cost),
    tokens: entry.tokens,
    days: entry.days,
    movement,
    gap,
    planEq: roundPlanEq(entry.planEq),
    trust: entry.trust,
    underReview: entry.underReview,
    ...(entry.heldReason ? { heldReason: entry.heldReason } : {}),
    streakWeeks: entry.streakWeeks,
  };
}

/** Day costs Monday first for a week, from per-day rows. */
function weekDayCosts(id: string, days: WindowDay[] | undefined): number[] {
  const byDate = new Map((days ?? []).map((day) => [day.date, day.cost]));
  return weekDates(id).map((date) => round2(byDate.get(date) ?? 0));
}

function sameHandle(entry: { userKey: string; username: string }, handle: string): boolean {
  const wanted = handle.toLowerCase();
  return entry.userKey === wanted || entry.username.toLowerCase() === wanted;
}

/** Cost per tool, splitting a day's cost evenly across the tools active that day. */
function toolShares(days: UserDay[]): { tool: string; share: number }[] {
  const byTool = new Map<string, number>();
  for (const day of days) {
    if (day.agents.length === 0 || day.cost <= 0) continue;
    const slice = day.cost / day.agents.length;
    for (const tool of day.agents) byTool.set(tool, (byTool.get(tool) ?? 0) + slice);
  }
  const total = [...byTool.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  return [...byTool.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tool, cost]) => ({ tool, share: round2(cost / total) }));
}

function topModels(days: UserDay[], limit = 5): { model: string; cost: number; share: number }[] {
  const byModel = new Map<string, number>();
  for (const day of days) {
    for (const model of day.models) {
      if (!model.model) continue;
      byModel.set(model.model, (byModel.get(model.model) ?? 0) + (Number(model.cost) || 0));
    }
  }
  const total = [...byModel.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  return [...byModel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([model, cost]) => ({ model, cost: round2(cost), share: round2(cost / total) }));
}

function percentileBelow(costs: number[], cost: number): number {
  if (costs.length === 0) return 0;
  const below = costs.filter((value) => value < cost).length;
  return Math.round((below / costs.length) * 1000) / 10;
}

function weeklyTotals(days: UserDay[]): Map<string, number> {
  const byWeek = new Map<string, number>();
  for (const day of days) {
    const id = weekIdOf(day.date);
    byWeek.set(id, (byWeek.get(id) ?? 0) + day.cost);
  }
  return byWeek;
}

// ============================================================================
// SERVICE
// ============================================================================

interface WeekState {
  week: WeekRef;
  entries: WeekEntry[];
  totals: BoardResult["totals"];
}

/** How much of the past one week load may compute: see loadWeek. */
type Depth = "full" | "shallow";

export function createWeeklyService(source: WeeklySource, options: WeeklyServiceOptions = {}): WeeklyDataService {
  const now = options.now ?? (() => new Date());
  const cacheMs = options.cacheMs ?? 0;
  const memo = new Map<string, { expires: number; value: Promise<unknown> }>();

  function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (cacheMs <= 0) return load();
    const hit = memo.get(key);
    const at = Date.now();
    if (hit && hit.expires > at) return hit.value as Promise<T>;
    const value = load();
    memo.set(key, { expires: at + cacheMs, value });
    // A failed read must not be served from the memo.
    value.catch(() => memo.delete(key));
    return value;
  }

  const windowEntries = (query: WindowQuery) =>
    cached(`w:${JSON.stringify(query)}`, () => source.windowEntries(query));

  /** Classify one week's live entries (tool-filtered values, unfiltered class). */
  async function liveWeek(id: string, tool: string | undefined): Promise<WeekEntry[]> {
    const start = weekStart(id);
    const end = weekEnd(id);
    const historyFrom = addDays(start, -7 * STREAK_LOOKBACK_WEEKS);
    // Independent reads: run them together rather than one after the other.
    const [full, toolValues] = await Promise.all([
      windowEntries({ from: start, to: end, withDays: true, historyFrom }),
      tool ? windowEntries({ from: start, to: end, tool, withDays: true }) : null,
    ]);
    const values = toolValues ?? full;
    const fullByKey = new Map(full.map((entry) => [entry.userKey, entry]));

    return values
      .filter((entry) => entry.cost > 0 || entry.tokens > 0)
      .map((entry) => {
        // Who you are this week comes from all of your usage, so a fleet stays
        // a fleet on every tool board it appears on.
        const whole = fullByKey.get(entry.userKey) ?? entry;
        const planEq = planEqFor(whole.cost, 7);
        const trust = trustMarkFor(whole);
        const { cls, underReview, heldReason } = classify({ trust, reviewReasons: whole.reviewReasons, planEq });
        return {
          userKey: entry.userKey,
          username: whole.username,
          ...(whole.avatarUrl ? { avatarUrl: whole.avatarUrl } : {}),
          tools: entry.tools,
          cost: entry.cost,
          tokens: entry.tokens,
          days: weekDayCosts(id, entry.days),
          planEq,
          trust,
          cls,
          underReview,
          ...(heldReason ? { heldReason } : {}),
          streakWeeks: streakWeeks(whole.activeWeeks ?? [start], start),
        };
      });
  }

  /** Movement map for `id` from the week before: userKey → previous class and rank. */
  function rankMap(entries: WeekEntry[], sort: BoardSort): Map<string, { cls: BoardClass; rank: number }> {
    const map = new Map<string, { cls: BoardClass; rank: number }>();
    for (const cls of ["ranked", "open", "fleets"] as const) {
      for (const entry of rankClass(entries, cls, sort)) map.set(entry.userKey, { cls, rank: entry.rank });
    }
    return map;
  }

  /**
   * One week's classified entries. A frozen week reads its stored result; a
   * frozen week that was never stored is computed and stored now, which is
   * how the grace freeze happens without a scheduler: the first read after
   * freezesAt makes the result final. "shallow" loads (the previous week, for
   * movement) never reach further back than one stored week.
   */
  async function loadWeek(id: string, tool: string | undefined, depth: Depth): Promise<WeekState> {
    return cached(`k:${id}:${tool ?? ""}:${depth}`, async () => {
      const at = now();
      const week = weekRef(id, at);
      const frozen = isFrozen(id, at);

      if (frozen && !tool) {
        const stored = await source.frozenWeek(week.start);
        if (stored) return { week, entries: stored.entries, totals: stored.totals };
      }

      const entries = await liveWeek(id, tool);
      const state = { week, entries, totals: totalsOf(entries) };

      if (frozen && !tool && source.storeWeek) {
        // Movement for the stored rows comes from the week before. A shallow
        // load only looks at that week's stored result: computing it live
        // would recurse through the whole history.
        const priorId = previousWeekId(id);
        const before =
          depth === "full"
            ? (await loadWeek(priorId, undefined, "shallow")).entries
            : ((await source.frozenWeek(weekStart(priorId)))?.entries ?? []);
        const previous = rankMap(before, "cost");
        const ranks = rankMap(entries, "cost");
        const finalEntries = entries.map((entry) => {
          const rank = ranks.get(entry.userKey)?.rank;
          const prior = previous.get(entry.userKey);
          return {
            ...entry,
            rank,
            movement: rank && prior && prior.cls === entry.cls ? movementFor(prior.rank, rank) : null,
          };
        });
        try {
          await source.storeWeek({ weekStart: week.start, frozenAt: at.toISOString(), totals: state.totals, entries: finalEntries });
        } catch (error) {
          // The live result is still correct for this response; the next read
          // tries the store again.
          console.error(`Storing frozen week ${id} failed:`, error);
        }
      }
      return state;
    });
  }

  async function weekBoard(params: BoardParams, sort: BoardSort, limit: number, offset: number): Promise<BoardResult> {
    const at = now();
    const id = params.weekId ?? weekIdOf(at);
    const [state, previous] = await Promise.all([
      loadWeek(id, params.tool, "full"),
      loadWeek(previousWeekId(id), params.tool, "shallow"),
    ]);
    const before = rankMap(previous.entries, sort);
    const ranked = rankClass(state.entries, params.cls, sort);

    const rows = ranked.slice(offset, offset + limit).map((entry, index) => {
      const prior = before.get(entry.userKey);
      const movement = prior && prior.cls === entry.cls ? movementFor(prior.rank, entry.rank) : null;
      return toBoardRow(entry, gapTo(ranked[offset + index - 1], entry.cost), movement);
    });

    return {
      window: "week",
      cls: params.cls,
      sort,
      week: state.week,
      rows,
      total: ranked.length,
      counts: countsOf(state.entries),
      totals: state.totals,
      updatedAt: at.toISOString(),
    };
  }

  /** Month-to-date or lifetime: no movement, no per-day series. */
  async function spanBoard(params: BoardParams, sort: BoardSort, limit: number, offset: number): Promise<BoardResult> {
    const at = now();
    const current = weekRef(undefined, at);
    const month = monthWindow(at);
    const window: BoardWindow = params.window;
    const from = window === "month" ? month.from : null;
    const to = window === "month" ? month.to : null;
    const historyFrom = addDays(current.start, -7 * STREAK_LOOKBACK_WEEKS);

    const [full, toolValues] = await Promise.all([
      windowEntries({ from, to, historyFrom }),
      params.tool ? windowEntries({ from, to, tool: params.tool }) : null,
    ]);
    const values = toolValues ?? full;
    const fullByKey = new Map(full.map((entry) => [entry.userKey, entry]));

    const entries: WeekEntry[] = values
      .filter((entry) => entry.cost > 0 || entry.tokens > 0)
      .map((entry) => {
        const whole = fullByKey.get(entry.userKey) ?? entry;
        // A lifetime is measured over the developer's own span, so a long
        // history is not mistaken for a fleet.
        const span =
          window === "month"
            ? month.days
            : whole.firstDate && whole.lastDate
              ? daysBetween(whole.firstDate, whole.lastDate) + 1
              : 7;
        const planEq = planEqFor(whole.cost, span);
        const trust = trustMarkFor(whole);
        const { cls, underReview, heldReason } = classify({ trust, reviewReasons: whole.reviewReasons, planEq });
        return {
          userKey: entry.userKey,
          username: whole.username,
          ...(whole.avatarUrl ? { avatarUrl: whole.avatarUrl } : {}),
          tools: entry.tools,
          cost: entry.cost,
          tokens: entry.tokens,
          days: [],
          planEq,
          trust,
          cls,
          underReview,
          ...(heldReason ? { heldReason } : {}),
          streakWeeks: streakWeeks(whole.activeWeeks ?? [], current.start),
        };
      });

    const ranked = rankClass(entries, params.cls, sort);
    const rows = ranked
      .slice(offset, offset + limit)
      .map((entry, index) => toBoardRow(entry, gapTo(ranked[offset + index - 1], entry.cost), null));

    return {
      window,
      cls: params.cls,
      sort,
      week: current,
      rows,
      total: ranked.length,
      counts: countsOf(entries),
      totals: totalsOf(entries),
      updatedAt: at.toISOString(),
    };
  }

  /** The user's rank by cost in a closed or current week; null for weeks never ranked. */
  async function rankInWeek(userKey: string, id: string): Promise<number | null> {
    const at = now();
    if (!isClosed(id, at) && id !== weekIdOf(at)) return null;
    const state = await loadWeek(id, undefined, "shallow");
    const entry = state.entries.find((candidate) => candidate.userKey === userKey);
    if (!entry) return null;
    return rankClass(state.entries, entry.cls, "cost").find((row) => row.userKey === userKey)?.rank ?? null;
  }

  async function bestWeekOf(userKey: string, days: UserDay[]): Promise<Standing["bestWeek"]> {
    let best: { weekId: string; cost: number } | null = null;
    for (const [weekId, cost] of weeklyTotals(days)) {
      if (cost > 0 && (!best || cost > best.cost)) best = { weekId, cost };
    }
    if (!best) return null;
    return { weekId: best.weekId, cost: round2(best.cost), rank: await rankInWeek(userKey, best.weekId) };
  }

  async function getStanding(username: string, weekId?: string): Promise<Standing | null> {
    const at = now();
    const id = weekId ?? weekIdOf(at);
    // The week loads do not depend on who is asking: start them with the
    // history read instead of after it.
    const [history, state, previous] = await Promise.all([
      cached(`h:${username.toLowerCase()}`, () => source.userHistory(username, null, null)),
      loadWeek(id, undefined, "full"),
      loadWeek(previousWeekId(id), undefined, "shallow"),
    ]);
    if (!history) return null;
    const mine = state.entries.find((entry) => entry.userKey === history.userKey) ?? state.entries.find((entry) => sameHandle(entry, username));

    // No usage this week: classify as an empty entry, so the page can still
    // say which board the user would land on.
    const trust = mine?.trust ?? trustMarkFor(history);
    const classification = mine
      ? { cls: mine.cls, heldReason: mine.heldReason }
      : classify({ trust, reviewReasons: history.reviewReasons, planEq: 0 });
    const cls = classification.cls;
    const classRows = rankClass(state.entries, cls, "cost");
    const index = mine ? classRows.findIndex((row) => row.userKey === mine.userKey) : -1;
    const me = index >= 0 ? classRows[index] : null;

    const before = rankMap(previous.entries, "cost");
    const movementOf = (entry: WeekEntry & { rank: number }) => {
      const prior = before.get(entry.userKey);
      return prior && prior.cls === entry.cls ? movementFor(prior.rank, entry.rank) : null;
    };
    const bracketIndex = index >= 0 ? index : classRows.length - 1;
    const bracket = bracketAround(classRows, bracketIndex).map((entry) => {
      const position = classRows.indexOf(entry);
      return toBoardRow(entry, gapTo(classRows[position - 1], entry.cost), movementOf(entry));
    });

    const above = index > 0 ? classRows[index - 1] : index < 0 ? classRows[classRows.length - 1] : undefined;
    const below = index >= 0 ? classRows[index + 1] : undefined;
    const weekStartDate = weekStart(id);
    const activeWeekStarts = [...weeklyTotals(history.days.filter((day) => day.date <= weekEnd(id))).keys()].map(weekStart);

    return {
      username: mine?.username ?? history.username,
      ...((mine?.avatarUrl ?? history.avatarUrl) ? { avatarUrl: mine?.avatarUrl ?? history.avatarUrl } : {}),
      week: state.week,
      cls,
      rank: me?.rank ?? null,
      of: classRows.length,
      cost: round2(mine?.cost ?? 0),
      tokens: mine?.tokens ?? 0,
      planEq: roundPlanEq(mine?.planEq ?? 0),
      movement: me ? movementOf(me) : null,
      above: above ? { username: above.username, cost: round2(above.cost) } : null,
      below: below ? { username: below.username, cost: round2(below.cost) } : null,
      bracket,
      streakWeeks: mine?.streakWeeks ?? streakWeeks(activeWeekStarts, weekStartDate),
      bestWeek: await bestWeekOf(history.userKey, history.days),
      days: mine?.days ?? weekDates(id).map(() => 0),
      trust,
      ...(classification.heldReason ? { heldReason: classification.heldReason } : {}),
    };
  }

  async function getRecap(username: string, weekId: string): Promise<WeekRecap | null> {
    const standing = await getStanding(username, weekId);
    if (!standing || (standing.cost <= 0 && standing.tokens <= 0)) return null;
    const history = await cached(`h:${username.toLowerCase()}`, () => source.userHistory(username, null, null));
    const start = weekStart(weekId);
    const end = weekEnd(weekId);
    const days = (history?.days ?? []).filter((day) => day.date >= start && day.date <= end);
    const state = await loadWeek(weekId, undefined, "full");

    return {
      ...standing,
      activeDays: days.filter((day) => day.cost > 0 || day.tokens > 0).length,
      topModels: topModels(days),
      tools: toolShares(days),
      percentile: percentileBelow(state.entries.map((entry) => entry.cost), standing.cost),
    };
  }

  async function getYear(username: string, year: number): Promise<YearWrapped | null> {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const history = await cached(`h:${username.toLowerCase()}`, () => source.userHistory(username, null, null));
    if (!history) return null;
    const days = history.days.filter((day) => day.date >= from && day.date <= to && (day.cost > 0 || day.tokens > 0));
    if (days.length === 0) return null;

    const everyone = await windowEntries({ from, to });
    const cost = days.reduce((sum, day) => sum + day.cost, 0);
    const months = Array.from({ length: 12 }, () => 0);
    for (const day of days) months[Number(day.date.slice(5, 7)) - 1] += day.cost;
    const yearWeeks = days.filter((day) => weekIdOf(day.date).startsWith(`${year}-`));

    return {
      username: history.username,
      ...(history.avatarUrl ? { avatarUrl: history.avatarUrl } : {}),
      year,
      cost: round2(cost),
      tokens: days.reduce((sum, day) => sum + day.tokens, 0),
      activeDays: days.length,
      longestStreakDays: computeStreaks(days.map((day) => day.date), isoDate(now())).longest,
      bestWeek: await bestWeekOf(history.userKey, yearWeeks),
      topModels: topModels(days),
      tools: toolShares(days),
      months: months.map(round2),
      percentile: percentileBelow(everyone.map((entry) => entry.cost), cost),
      dailyCost: days.map((day) => [day.date, round2(day.cost)] as [string, number]),
    };
  }

  return {
    async getBoard(params: BoardParams): Promise<BoardResult> {
      const sort = params.sort ?? "cost";
      const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_BOARD_LIMIT, MAX_BOARD_LIMIT));
      const offset = Math.max(0, params.offset ?? 0);
      return params.window === "week" ? weekBoard(params, sort, limit, offset) : spanBoard(params, sort, limit, offset);
    },
    getStanding,
    getRecap,
    getYear,
    async getWindowRank(handle, from, to, sort) {
      return rankInWindow(await windowEntries({ from, to }), handle, sort);
    },
  };
}
