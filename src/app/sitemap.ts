import type { MetadataRoute } from "next";
import { getServerDataLayer } from "@/lib/data";

const SITE = "https://www.viberank.app";

const staticEntries: MetadataRoute.Sitemap = [
  { url: SITE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  { url: `${SITE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  { url: `${SITE}/blog/mcp-servers-guide`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE}/blog/cursor-vs-claude-code-vs-copilot`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE}/blog/claude-code-complete-guide`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE}/blog/vibe-coding-revolution`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const dataLayer = await getServerDataLayer();
    // Top 1000 by cost is more than enough to keep the sitemap useful while
    // staying well under Google's 50k-URL-per-sitemap ceiling.
    const { items } = await dataLayer.submissions.getLeaderboard({
      sortBy: "cost",
      page: 0,
      pageSize: 1000,
    });

    const seen = new Set<string>();
    const profileEntries: MetadataRoute.Sitemap = [];
    for (const sub of items) {
      const handle = sub.githubUsername || sub.username;
      if (!handle || seen.has(handle.toLowerCase())) continue;
      seen.add(handle.toLowerCase());
      profileEntries.push({
        url: `${SITE}/profile/${encodeURIComponent(handle)}`,
        lastModified: new Date(sub.submittedAt),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }

    return [...staticEntries, ...profileEntries];
  } catch {
    // If the DB call fails (cold deploy, transient outage) we still want a
    // valid sitemap, just with the static entries.
    return staticEntries;
  }
}
