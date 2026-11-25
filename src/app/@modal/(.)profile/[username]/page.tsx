import { unstable_cache } from "next/cache";
import { getServerDataLayer } from "@/lib/data";
import type { ProfileSummary } from "@/lib/data/types";
import ProfileSheet from "./ProfileSheet";

interface Params {
  params: Promise<{ username: string }>;
}

// ISR: cache the rendered sheet per username; stats are at most a minute stale.
export const revalidate = 60;

export function generateStaticParams(): { username: string }[] {
  return [];
}

type SheetData = { summary: ProfileSummary; globalRank: number | null } | null;

// The sheet needs totals, not the day rows the full profile pages through:
// one round trip for the summary, one for the rank, shared across requests
// for a minute so reopening a sheet (or another visitor opening it) is free.
const sheetData = (username: string) =>
  unstable_cache(
    async (): Promise<SheetData> => {
      const dataLayer = await getServerDataLayer();
      const summary = await dataLayer.profiles.getProfileSummary(username);
      if (!summary) return null;
      let globalRank: number | null = null;
      try {
        if (summary.bestCost > 0) globalRank = await dataLayer.submissions.getGlobalRank(summary.bestCost);
      } catch (err) {
        // Rank is a nice-to-have on the sheet; the rest still renders.
        console.error(`profile sheet: rank for ${username} failed`, err);
      }
      return { summary, globalRank };
    },
    ["profile-sheet", "v1", username.toLowerCase()],
    { revalidate: 60 }
  )();

// Intercepted /profile/[username]: client-side navigations from the board
// get this pull-up sheet over the leaderboard; direct loads, refreshes and
// crawlers still get the full SSR profile page (SEO unaffected).
export default async function InterceptedProfile({ params }: Params) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const data = await sheetData(username);
  if (!data) return null;
  return <ProfileSheet requested={username} summary={data.summary} globalRank={data.globalRank} />;
}
