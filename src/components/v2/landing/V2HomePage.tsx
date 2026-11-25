import { getServerDataLayer } from "@/lib/data";
import HomeClient from "@/app/HomeClient";
import { HOME_FAQS } from "@/lib/home-faqs";
import { loadBoard } from "../board/load";
import { loadMonthStrip } from "./strip";
import type { SiteFacts } from "./Hero";

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

// The v2 landing: this week's Ranked board, first page, rendered on the
// server for SEO and a spinner-free first paint. Served at "/" when
// VIBERANK_HOME=v2 and always at /week.
export default async function V2HomePage() {
  const [{ board, failed }, facts, strip] = await Promise.all([
    loadBoard({ window: "week", cls: "ranked", sort: "cost", limit: 50 }),
    loadFacts(),
    loadMonthStrip(),
  ]);

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
