import { getServerDataLayer } from "@/lib/data";
import HomeClient from "./HomeClient";
import { HOME_FAQS } from "@/lib/home-faqs";
import { loadBoard } from "@/components/v2/board/load";
import { loadMonthStrip } from "@/components/v2/landing/strip";
import type { SiteFacts } from "@/components/v2/landing/Hero";

// Refresh the server-rendered snapshot every 5 min. The board is the week in
// progress, so this governs how stale the first paint (and crawlers) can be;
// tab changes and "you" are fetched live on the client.
export const revalidate = 300;

async function loadFacts(): Promise<SiteFacts | null> {
  try {
    const dataLayer = await getServerDataLayer();
    const site = await dataLayer.stats.getSiteStats();
    if (site) return { developers: site.totalUsers, tokens: site.totalTokens };
    const global = await dataLayer.stats.getGlobalStats();
    return { developers: global.totalUsers, tokens: global.totalTokens };
  } catch (err) {
    console.error("[v2] site facts failed", err);
    return null;
  }
}

// This week's Ranked board, first page, rendered on the server for SEO and a
// spinner-free first paint.
export default async function Home() {
  const [{ board, failed }, facts, strip] = await Promise.all([
    loadBoard({ window: "week", cls: "ranked", sort: "cost", limit: 50 }),
    loadFacts(),
    loadMonthStrip(),
  ]);

  // FAQPage schema for the homepage FAQ section (content shared via lib/home-faqs).
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <HomeClient board={board} failed={failed} facts={facts} strip={strip} />
    </>
  );
}
