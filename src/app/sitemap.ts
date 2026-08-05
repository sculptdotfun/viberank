import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { FEATURED_TOOLS } from "@/lib/utils";
import { fetchAllPages } from "@/lib/data/supabase/client";

const SITE = "https://www.viberank.app";

const toolEntries: MetadataRoute.Sitemap = FEATURED_TOOLS.map((t) => ({
  url: `${SITE}/tool/${t.key}`,
  lastModified: new Date(),
  changeFrequency: "daily" as const,
  priority: 0.8,
}));

const staticEntries: MetadataRoute.Sitemap = [
  { url: SITE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  ...toolEntries,
  { url: `${SITE}/hire`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE}/stats`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE}/calculator`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  { url: `${SITE}/blog/what-is-tokenmaxxing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${SITE}/blog/codex-token-usage-leaderboard`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${SITE}/blog/state-of-ai-coding-2026`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE}/blog/codex-vs-claude-code-vs-gemini-cli`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE}/blog/how-much-does-claude-code-cost`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE}/blog/reduce-ai-coding-costs`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
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
    // `.limit(45000)` here was silently served as 1000 by PostgREST's
    // db-max-rows, so every profile past the first thousand was missing from
    // the sitemap entirely — the same silent cap fixed in the data layer.
    // Page through with the same helper rather than a second implementation.
    const client = createClient(supabaseUrl, serviceKey);
    const profiles = await fetchAllPages<{
      username: string;
      github_username: string | null;
      updated_at: string | null;
    }>(
      (from, to) =>
        client
          .from("profiles")
          .select("username, github_username, updated_at")
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

    return [...staticEntries, ...profileEntries];
  } catch {
    // If the DB call fails (cold deploy, transient outage) still serve a
    // valid sitemap with the static entries.
    return staticEntries;
  }
}
