import { getServerDataLayer } from "@/lib/data";
import HomeClient from "./HomeClient";
import type { Submission, GlobalStats } from "@/lib/data/types";

// Refresh the server-rendered snapshot every 5 min; the client hooks fetch
// live data on mount regardless, so this only governs the SEO/first-paint HTML.
export const revalidate = 300;

// Fetch the first leaderboard page + global stats on the server so the
// leaderboard renders in the initial HTML (SEO + no first-paint spinner).
// The client hooks take over for filtering, sorting and infinite scroll.
export default async function Home() {
  let initialItems: Submission[] = [];
  let initialStats: GlobalStats | undefined;
  let initialHasMore = false;

  try {
    const dataLayer = await getServerDataLayer();
    const [lb, stats] = await Promise.all([
      dataLayer.submissions.getLeaderboard({ sortBy: "cost", page: 0, pageSize: 25 }).catch(() => null),
      dataLayer.stats.getGlobalStats().catch(() => null),
    ]);
    initialItems = lb?.items ?? [];
    initialHasMore = lb?.hasMore ?? false;
    initialStats = stats ?? undefined;
  } catch {
    // Fall back to client-side fetch if the server read fails.
  }

  return <HomeClient initialItems={initialItems} initialStats={initialStats} initialHasMore={initialHasMore} />;
}
