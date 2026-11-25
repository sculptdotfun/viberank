// Cross-request caching for the weekly service, for pages and API routes.
//
// The service memoises inside one server instance, but on Vercel each cold
// function (and each build worker) starts empty, so every one of them paid
// for the window RPCs again. unstable_cache keeps results in the shared Data
// Cache. Failures throw and are never cached. The key carries the resolved
// week and month, so a Monday rollover never serves last week as "current",
// and a shape version, since Data Cache entries outlive a deployment.

import { unstable_cache } from "next/cache";
import { getWeeklyService } from "@/lib/data";
import type { BoardParams, BoardResult, Standing, WeekRecap } from "./contract";
import { isFrozen, weekIdOf } from "./week";

const SHAPE = "v2-1";
/** Live data: a minute behind at most; the CDN adds its own s-maxage on top. */
const LIVE_SECONDS = 60;
/** A frozen week never changes again. */
const FROZEN_SECONDS = 86_400;

export const BOARD_TAG = "v2-board";

function boardKey(params: BoardParams, now: Date): string {
  const week = params.weekId ?? weekIdOf(now);
  return JSON.stringify([
    params.window,
    params.cls,
    params.sort ?? "cost",
    params.tool ?? "",
    params.window === "week" ? week : now.toISOString().slice(0, params.window === "month" ? 7 : 0),
    params.limit ?? null,
    params.offset ?? 0,
  ]);
}

const boardFor = (key: string, frozen: boolean, params: BoardParams) =>
  unstable_cache(async () => (await getWeeklyService()).getBoard(params), ["board", SHAPE, key], {
    revalidate: frozen ? FROZEN_SECONDS : LIVE_SECONDS,
    tags: [BOARD_TAG],
  })();

/** One page of a board, shared across requests and instances. */
export function cachedBoard(params: BoardParams, now = new Date()): Promise<BoardResult> {
  const frozen = params.window === "week" && isFrozen(params.weekId ?? weekIdOf(now), now);
  return boardFor(boardKey(params, now), frozen, params);
}

/** A developer's current (or given) week standing. */
export function cachedStanding(username: string, weekId?: string, now = new Date()): Promise<Standing | null> {
  const week = weekId ?? weekIdOf(now);
  return unstable_cache(
    async () => (await getWeeklyService()).getStanding(username, week),
    ["standing", SHAPE, username.toLowerCase(), week],
    { revalidate: isFrozen(week, now) ? FROZEN_SECONDS : LIVE_SECONDS, tags: [BOARD_TAG] }
  )();
}

/** A developer's recap for a week. */
export function cachedRecap(username: string, weekId: string, now = new Date()): Promise<WeekRecap | null> {
  return unstable_cache(
    async () => (await getWeeklyService()).getRecap(username, weekId),
    ["recap", SHAPE, username.toLowerCase(), weekId],
    { revalidate: isFrozen(weekId, now) ? FROZEN_SECONDS : LIVE_SECONDS, tags: [BOARD_TAG] }
  )();
}
