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
