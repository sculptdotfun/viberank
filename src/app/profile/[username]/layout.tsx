import type { Metadata } from "next";
import { computeStreaks } from "@/lib/streaks";
import { getProfileCached } from "./getProfile";

interface ProfileParams {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfileParams): Promise<Metadata> {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);

  try {
    const profile = await getProfileCached(username);

    if (!profile) {
      return {
        title: `${username} | Viberank`,
        description: `AI coding usage stats (Claude Code, Codex & more) for ${username}.`,
        alternates: { canonical: `https://www.viberank.app/profile/${encodeURIComponent(username)}` },
      };
    }

    const display = profile.githubName || profile.githubUsername || profile.username;
    const totalCost = profile.submissions.reduce((acc, s) => acc + s.totalCost, 0);
    const totalTokens = profile.submissions.reduce((acc, s) => acc + s.totalTokens, 0);
    const tokensB = totalTokens >= 1e9 ? `${(totalTokens / 1e9).toFixed(1)}B` : `${(totalTokens / 1e6).toFixed(0)}M`;
    const cost = `$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    // Build the tool list from the profile's actual usage (Claude sorts first),
    // so metadata is accurate per user and still keyword-rich for Claude users.
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    const tools = Array.from(
      new Set(profile.submissions.flatMap((s) => s.tools ?? []))
    ).sort();
    const toolsShort =
      tools.length === 0
        ? "AI coding tools"
        : tools.length <= 2
          ? tools.map(cap).join(" & ")
          : `${tools.slice(0, 2).map(cap).join(" & ")} & more`;
    const toolsLong =
      tools.length === 0 ? "AI coding tools" : tools.map(cap).join(", ");

    const title = `${display} — ${cost} on ${toolsShort} | Viberank`;
    const description = `${display} has spent ${cost} across ${tokensB} tokens on ${toolsLong}. See the full breakdown, daily usage, and how they rank on the Viberank leaderboard.`;
    const canonical = `https://www.viberank.app/profile/${encodeURIComponent(profile.username)}`;

    // Rich share card: avatar, rank, tier, cost, tokens. Rank and tier match
    // the leaderboard convention (best submission, not lifetime sum).
    const bestCost = profile.submissions.reduce((acc, s) => Math.max(acc, s.totalCost), 0);
    let rank: number | null = null;
    try {
      if (bestCost > 0) {
        const { getServerDataLayer } = await import("@/lib/data");
        const dataLayer = await getServerDataLayer();
        rank = await dataLayer.submissions.getGlobalRank(bestCost);
      }
    } catch {
      // rank is nice-to-have on the card; render without it on failure
    }
    const avatar = profile.submissions.find((s) => s.githubAvatar)?.githubAvatar;
    const activeDates = new Set(
      profile.submissions.flatMap((s) => (s.dailyBreakdown ?? []).map((d) => d.date))
    );
    const daysActive = activeDates.size;
    const { current: streak } = computeStreaks(activeDates);

    // Mini activity heatmap for the share card: last 112 days as one level
    // digit (0–4) per day, oldest first. Quartile thresholds over the window's
    // nonzero days, mirroring the profile page's calendar.
    const costByDate = new Map<string, number>();
    for (const s of profile.submissions) {
      for (const d of s.dailyBreakdown ?? []) {
        if (!costByDate.has(d.date)) costByDate.set(d.date, d.totalCost);
      }
    }
    const DAY_MS = 86_400_000;
    const todayUtc = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const windowCosts: number[] = [];
    for (let i = 111; i >= 0; i--) {
      const date = new Date(todayUtc - i * DAY_MS).toISOString().slice(0, 10);
      windowCosts.push(costByDate.get(date) ?? 0);
    }
    const nonzero = windowCosts.filter((c) => c > 0).sort((a, b) => a - b);
    const q = (p: number) => nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] ?? 0;
    const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
    const heatmap = windowCosts
      .map((c) => (c <= 0 ? 0 : c <= q1 ? 1 : c <= q2 ? 2 : c <= q3 ? 3 : 4))
      .join("");
    const ogParams = new URLSearchParams({
      type: "profile",
      username: profile.githubUsername || profile.username,
      cost: String(Math.round(bestCost)),
      tokens: tokensB,
    });
    if (rank) ogParams.set("rank", String(rank));
    if (avatar) ogParams.set("avatar", avatar);
    if (daysActive > 0) ogParams.set("days", String(daysActive));
    if (streak > 1) ogParams.set("streak", String(streak));
    if (tools.length > 0) ogParams.set("tools", tools.slice(0, 4).join(","));
    if (nonzero.length > 0) ogParams.set("hm", heatmap);
    // Content fingerprint: the URL changes whenever the underlying stats do,
    // so the OG route can serve versioned responses as immutable and crawlers
    // still pick up fresh cards after each submission.
    ogParams.set("v", `${Math.round(totalCost)}-${daysActive}-${rank ?? 0}`);
    const ogImage = `/api/og?${ogParams.toString()}`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: "Viberank",
        type: "profile",
        images: [{ url: ogImage, width: 1200, height: 630, alt: `${display} on Viberank` }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: `${username} | Viberank`,
      description: `AI coding usage stats (Claude Code, Codex & more) for ${username}.`,
    };
  }
}

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);

  let profile: Awaited<ReturnType<typeof getProfileCached>> = null;
  try {
    profile = await getProfileCached(username);
  } catch {
    // ignore — page renders its own empty state
  }

  const display = profile?.githubName || profile?.githubUsername || username;
  const totalCost = profile?.submissions.reduce((acc, s) => acc + s.totalCost, 0) ?? 0;
  const canonical = `https://www.viberank.app/profile/${encodeURIComponent(profile?.username || username)}`;

  // Breadcrumb is emitted even without a profile so the page always has the
  // Home → Profile trail for crawlers.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", position: 1, name: "Leaderboard", item: "https://www.viberank.app" },
      { "@type": "ListItem", position: 2, name: `${display} on Viberank`, item: canonical },
    ],
  };

  const profileLd = profile
    ? {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "url": canonical,
        "name": `${display} on Viberank`,
        "mainEntity": {
          "@type": "Person",
          "name": display,
          "identifier": profile.githubUsername || profile.username,
          "sameAs": profile.githubUsername
            ? [`https://github.com/${profile.githubUsername}`]
            : undefined,
          "description": `AI coding user, ${profile.totalSubmissions} submission${profile.totalSubmissions === 1 ? "" : "s"} totaling $${totalCost.toFixed(0)} on Viberank.`,
        },
      }
    : null;

  const jsonLd = [breadcrumbLd, ...(profileLd ? [profileLd] : [])];

  return (
    <>
      <script
        type="application/ld+json"
        // GitHub display names are attacker-controlled free text; a literal
        // "</script>" inside would break out of this tag, so escape "<".
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
