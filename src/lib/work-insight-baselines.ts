import { unstable_cache } from "next/cache";
import { getServerDataLayer } from "./data";

// Profile ISR caches each username separately; share this cohort query across
// profiles so a popular page does not page through submissions every render.
export const getWorkInsightBaselinesCached = unstable_cache(
  async () => (await getServerDataLayer()).stats.getWorkInsightBaselines(),
  ["work-insight-baselines"],
  { revalidate: 120 }
);
