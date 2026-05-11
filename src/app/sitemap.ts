import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

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
    const client = createClient(supabaseUrl, serviceKey);
    const { data: profiles } = await client
      .from("profiles")
      .select("username, github_username, updated_at")
      .order("updated_at", { ascending: false })
      .limit(45000); // Google's per-sitemap ceiling is 50k URLs.

    const profileEntries: MetadataRoute.Sitemap = (profiles ?? []).flatMap((p) => {
      const handle = p.github_username || p.username;
      if (!handle) return [];
      return [{
        url: `${SITE}/profile/${encodeURIComponent(handle)}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }];
    });

    return [...staticEntries, ...profileEntries];
  } catch {
    // If the DB call fails (cold deploy, transient outage) still serve a
    // valid sitemap with the static entries.
    return staticEntries;
  }
}
