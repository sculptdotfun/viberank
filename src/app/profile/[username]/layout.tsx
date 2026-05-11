import type { Metadata } from "next";
import { getServerDataLayer } from "@/lib/data";

interface ProfileParams {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfileParams): Promise<Metadata> {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);

  try {
    const dataLayer = await getServerDataLayer();
    const profile = await dataLayer.profiles.getProfile(username, 25);

    if (!profile) {
      return {
        title: `${username} | Viberank`,
        description: `Claude Code usage stats for ${username}.`,
        alternates: { canonical: `https://www.viberank.app/profile/${encodeURIComponent(username)}` },
      };
    }

    const display = profile.githubName || profile.githubUsername || profile.username;
    const totalCost = profile.submissions.reduce((acc, s) => acc + s.totalCost, 0);
    const totalTokens = profile.submissions.reduce((acc, s) => acc + s.totalTokens, 0);
    const tokensB = totalTokens >= 1e9 ? `${(totalTokens / 1e9).toFixed(1)}B` : `${(totalTokens / 1e6).toFixed(0)}M`;
    const cost = `$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const title = `${display} — ${cost} on Claude Code | Viberank`;
    const description = `${display} has spent ${cost} across ${tokensB} tokens on Claude Code. See the full breakdown, daily usage, and how they rank on the Viberank leaderboard.`;
    const canonical = `https://www.viberank.app/profile/${encodeURIComponent(profile.username)}`;
    const ogImage = `/api/og?title=${encodeURIComponent(display)}&description=${encodeURIComponent(`${cost} • ${tokensB} tokens`)}`;

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
      description: `Claude Code usage stats for ${username}.`,
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

  let profile: Awaited<ReturnType<Awaited<ReturnType<typeof getServerDataLayer>>["profiles"]["getProfile"]>> = null;
  try {
    const dataLayer = await getServerDataLayer();
    profile = await dataLayer.profiles.getProfile(username, 25);
  } catch {
    // ignore — page will render its own loading/empty state
  }

  const display = profile?.githubName || profile?.githubUsername || username;
  const totalCost = profile?.submissions.reduce((acc, s) => acc + s.totalCost, 0) ?? 0;

  const jsonLd = profile
    ? {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "url": `https://www.viberank.app/profile/${encodeURIComponent(profile.username)}`,
        "name": `${display} on Viberank`,
        "mainEntity": {
          "@type": "Person",
          "name": display,
          "identifier": profile.githubUsername || profile.username,
          "sameAs": profile.githubUsername
            ? [`https://github.com/${profile.githubUsername}`]
            : undefined,
          "description": `Claude Code user, ${profile.totalSubmissions} submission${profile.totalSubmissions === 1 ? "" : "s"} totaling $${totalCost.toFixed(0)} on Viberank.`,
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
