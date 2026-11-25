import { getServerDataLayer } from "@/lib/data";
import type { Submission, GlobalStats } from "@/lib/data/types";
import LegacyHome from "./LegacyHome";
import { LEGACY_HOME_FAQS } from "./faqs";

// The pre-v2 home's server half, unchanged from main's src/app/page.tsx:
// the first leaderboard page + global stats render in the initial HTML (SEO
// + no first-paint spinner); the client hooks take over for filtering,
// sorting and infinite scroll.
export default async function LegacyHomePage() {
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

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LEGACY_HOME_FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <LegacyHome initialItems={initialItems} initialStats={initialStats} initialHasMore={initialHasMore} />
    </>
  );
}
