import { cache } from "react";
import { getServerDataLayer } from "@/lib/data";

/**
 * Request-deduped profile fetch. `cache()` ensures the layout (metadata) and
 * the page (content) share a single DB read per request.
 */
export const getProfileCached = cache(async (username: string) => {
  const dataLayer = await getServerDataLayer();
  return dataLayer.profiles.getProfile(username, 100);
});

/**
 * Request-deduped global rank for a best-submission cost. The layout's share
 * card and the page each asked for it, so an uncached profile counted the
 * board twice.
 */
export const getGlobalRankCached = cache(async (bestCost: number) => {
  const dataLayer = await getServerDataLayer();
  return dataLayer.submissions.getGlobalRank(bestCost);
});
