// Server-side reads for the share surfaces, through the weekly service in the
// v2 contract. Fixtures are served only when explicitly asked for with
// VIBERANK_SHARE_FIXTURES=1 outside production, never as a fallback.
import { cache } from "react";
import { getServerDataLayer } from "@/lib/data";
import type { Standing, WeekRecap, YearWrapped } from "@/lib/v2/contract";
import { asUser, fixtureRecap, fixtureStanding, fixtureYear } from "./__fixtures__";
import { weekRange } from "./format";

function useFixtures(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.VIBERANK_SHARE_FIXTURES === "1";
}

export const loadRecap = cache(async (username: string, weekId: string): Promise<WeekRecap | null> => {
  if (useFixtures()) {
    const range = weekRange(weekId) ?? fixtureRecap.week;
    return asUser({ ...fixtureRecap, week: { ...fixtureRecap.week, id: weekId, ...range } }, username);
  }
  const data = await getServerDataLayer();
  return data.weekly.getRecap(username, weekId);
});

export const loadYear = cache(async (username: string, year: number): Promise<YearWrapped | null> => {
  if (useFixtures()) return asUser(fixtureYear, username);
  const data = await getServerDataLayer();
  return data.weekly.getYear(username, year);
});

export const loadStanding = cache(async (username: string): Promise<Standing | null> => {
  if (useFixtures()) return asUser(fixtureStanding, username);
  const data = await getServerDataLayer();
  return data.weekly.getStanding(username);
});
