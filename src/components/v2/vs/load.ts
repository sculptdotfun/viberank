// Server reads for /vs/{a}/{b} and its OG image, through the weekly service.
// Standings for this week, plus the last weeks from getStanding(user, weekId):
// the service has no history endpoint, but a closed week's standing is read
// from the stored frozen week, so this stays a handful of memoised reads.
import { cache } from "react";
import { getServerDataLayer } from "@/lib/data";
import type { Standing } from "@/lib/v2/contract";
import { shiftWeek } from "@/lib/v2/week";
import type { VsWeek } from "@/lib/v2/invite";

export const HISTORY_WEEKS = 8;

export interface VsData {
  a: Standing | null;
  b: Standing | null;
}

export interface VsHistoryWeek extends VsWeek {
  rankA: number | null;
  rankB: number | null;
}

export const loadVs = cache(async (a: string, b: string): Promise<VsData> => {
  const weekly = (await getServerDataLayer()).weekly;
  const [sa, sb] = await Promise.all([weekly.getStanding(a), weekly.getStanding(b)]);
  return { a: sa, b: sb };
});

/**
 * The last HISTORY_WEEKS weeks, oldest first, ending with the current one.
 * Null when any read fails: the page then shows this week and best weeks only.
 */
export const loadVsHistory = cache(async (a: string, b: string, currentWeekId: string): Promise<VsHistoryWeek[] | null> => {
  try {
    const weekly = (await getServerDataLayer()).weekly;
    const ids = Array.from({ length: HISTORY_WEEKS }, (_, i) => shiftWeek(currentWeekId, i - (HISTORY_WEEKS - 1)));
    return await Promise.all(
      ids.map(async (weekId) => {
        const [sa, sb] = await Promise.all([weekly.getStanding(a, weekId), weekly.getStanding(b, weekId)]);
        return { weekId, a: sa?.cost ?? 0, b: sb?.cost ?? 0, rankA: sa?.rank ?? null, rankB: sb?.rank ?? null };
      })
    );
  } catch (err) {
    console.error("[vs] history failed", a, b, err);
    return null;
  }
});
