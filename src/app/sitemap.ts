import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { FEATURED_TOOLS } from "@/lib/utils";
import { fetchAllPages } from "@/lib/data/supabase/client";
import { BLOG_POSTS } from "@/lib/blogPosts";
import { COMPARE_MATCHUPS } from "@/lib/compare";
import { buildModelEconomics, publishableModels } from "@/lib/model-economics";

const SITE = "https://www.viberank.app";

const toolEntries: MetadataRoute.Sitemap = FEATURED_TOOLS.map((t) => ({
  url: `${SITE}/tool/${t.key}`,
  lastModified: new Date(),
  changeFrequency: "daily" as const,
  priority: 0.8,
}));

const compareEntries: MetadataRoute.Sitemap = COMPARE_MATCHUPS.map((m) => ({
  url: `${SITE}/compare/${m.slug}`,
  lastModified: new Date(),
  changeFrequency: "daily" as const,
  priority: 0.8,
}));

// Blog entries carry the post's real publish/modified date. Stamping
// `new Date()` on every build tells crawlers lastModified is noise and they
// stop trusting it for the pages where it matters.
const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
  url: `${SITE}/blog/${p.slug}`,
  lastModified: new Date(`${p.dateModified}T00:00:00.000Z`),
  changeFrequency: "monthly" as const,
  priority: 0.7,
}));

// Every month from the first tracked data (Sep 2025) through the current one.
function monthlyReportEntries(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();
  const cursor = new Date(Date.UTC(2025, 8, 1));
  while (cursor <= now) {
    const month = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    entries.push({
      url: `${SITE}/stats/monthly/${month}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return entries;
}

const staticEntries: MetadataRoute.Sitemap = [
  { url: SITE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  ...toolEntries,
  ...compareEntries,
  { url: `${SITE}/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE}/ko`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE}/leagues`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE}/hire`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE}/stats`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE}/stats/monthly`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ...monthlyReportEntries(),
  { url: `${SITE}/calculator`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE}/data`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE}/model`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ...blogEntries,
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return staticEntries;
  }

  try {
    // Query the `profiles` table directly: one row per user, already deduped
    // by the unique `github_username` constraint. The data-layer's
    // `getLeaderboard` caps pageSize at 50 to protect the leaderboard UI,
    // which isn't useful for sitemap generation.
    // `.limit(45000)` here was silently served as 1000 by PostgREST's
    // db-max-rows, so every profile past the first thousand was missing from
    // the sitemap entirely — the same silent cap fixed in the data layer.
    // Page through with the same helper rather than a second implementation.
    const client = createClient(supabaseUrl, serviceKey);

    // Per-model economics pages, gated on the same developer threshold the
    // pages themselves use so the sitemap never advertises a thin page.
    let modelEntries: MetadataRoute.Sitemap = [];
    try {
      const { getServerDataLayer } = await import("@/lib/data");
      const site = await (await getServerDataLayer()).stats.getSiteStats();
      modelEntries = publishableModels(
        buildModelEconomics(site.modelSpend ?? [], site.models ?? [])
      ).map((m) => ({
        url: `${SITE}/model/${m.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));
    } catch {
      // model pages are optional in the sitemap
    }
    // Only profiles that have actually submitted. A signed-in account with no
    // submission renders an empty shell: 774 profile URLs were indexed for a
    // combined 47 clicks, and the empty ones are pure thin-content ballast.
    const profiles = await fetchAllPages<{
      username: string;
      github_username: string | null;
      updated_at: string | null;
    }>(
      (from, to) =>
        client
          .from("profiles")
          .select("username, github_username, updated_at")
          .gt("total_submissions", 0)
          .order("updated_at", { ascending: false })
          .order("username", { ascending: true })
          .range(from, to),
      "profiles for sitemap"
    );

    const profileEntries: MetadataRoute.Sitemap = profiles.flatMap((p) => {
      const handle = p.github_username || p.username;
      if (!handle) return [];
      return [{
        url: `${SITE}/profile/${encodeURIComponent(handle)}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }];
    });

    return [...staticEntries, ...modelEntries, ...profileEntries];
  } catch {
    // If the DB call fails (cold deploy, transient outage) still serve a
    // valid sitemap with the static entries.
    return staticEntries;
  }
}
