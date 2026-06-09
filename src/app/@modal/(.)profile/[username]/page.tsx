import { getServerDataLayer } from "@/lib/data";
import { getProfileCached } from "@/app/profile/[username]/getProfile";
import ProfileSheet from "./ProfileSheet";

interface Params {
  params: Promise<{ username: string }>;
}

// ISR: cache the rendered sheet per username so repeat opens skip the
// 4 sequential DB queries entirely. Stats are at most a minute stale.
export const revalidate = 60;

export function generateStaticParams(): { username: string }[] {
  return [];
}

// Intercepted /profile/[username] — client-side navigations from the board
// get this pull-up sheet over the leaderboard; direct loads, refreshes and
// crawlers still get the full SSR profile page (SEO unaffected).
export default async function InterceptedProfile({ params }: Params) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const profileData = await getProfileCached(username);

  if (!profileData) return null;

  const submissions = profileData.submissions ?? [];
  const totalCost = submissions.reduce((s, sub) => s + sub.totalCost, 0);
  const totalTokens = submissions.reduce((s, sub) => s + sub.totalTokens, 0);
  const allDaily = submissions.flatMap((sub) => sub.dailyBreakdown ?? []);
  const daysActive = new Set(allDaily.map((d) => d.date)).size || 1;
  const tools = Array.from(new Set(submissions.flatMap((s) => s.tools ?? []))).sort();
  const bestCost = submissions.length > 0 ? Math.max(...submissions.map((s) => s.totalCost)) : 0;

  // Last 30 calendar days of spend for the sheet's sparkline.
  const byDate = new Map<string, number>();
  for (const d of allDaily) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.totalCost);
  const days = [...byDate.keys()].sort();
  const spark = days.slice(-30).map((d) => byDate.get(d) ?? 0);

  let globalRank: number | null = null;
  try {
    if (bestCost > 0) {
      const dataLayer = await getServerDataLayer();
      globalRank = await dataLayer.submissions.getGlobalRank(bestCost);
    }
  } catch {
    // rank is nice-to-have
  }

  return (
    <ProfileSheet
      username={username}
      displayName={profileData.githubName || profileData.githubUsername || username}
      handle={profileData.githubUsername || username}
      avatar={profileData.avatar ?? null}
      totalCost={totalCost}
      totalTokens={totalTokens}
      daysActive={daysActive}
      bestCost={bestCost}
      globalRank={globalRank}
      tools={tools}
      spark={spark}
    />
  );
}
