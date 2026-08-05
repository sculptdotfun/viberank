import { NextRequest, NextResponse } from "next/server";
import { getServerDataLayer } from "@/lib/data";
import {
  renderBadge,
  badgeCost,
  badgeTokens,
  badgeLabelFor,
  isBadgeMetric,
} from "@/lib/badge";

/**
 * README badge: ![viberank](https://viberank.app/api/badge/<username>)
 *
 * Always answers 200 with an SVG, including for unknown users. A README that
 * renders a broken-image icon because someone typo'd their handle is worse
 * than one that renders "not found" — and GitHub's camo proxy caches a 404
 * hard enough that fixing the typo doesn't visibly fix the badge.
 */

function svg(body: string, maxAge: number) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // GitHub proxies through camo, which caches aggressively. An hour keeps
      // a rank reasonably fresh without making every README view a database
      // query, and stale-while-revalidate means nobody waits on the refresh.
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw).slice(0, 64);

  const metricParam = request.nextUrl.searchParams.get("metric");
  const metric = isBadgeMetric(metricParam) ? metricParam : "rank";
  const label = badgeLabelFor(metric);

  try {
    const dataLayer = await getServerDataLayer();
    const profile = await dataLayer.profiles.getProfile(username, 1);

    const best = profile?.submissions?.[0];
    if (!profile || !best) {
      return svg(renderBadge({ label, value: "not found", color: "#52525b" }), 300);
    }

    let value: string;
    if (metric === "cost") {
      value = badgeCost(best.totalCost);
    } else if (metric === "tokens") {
      value = badgeTokens(best.totalTokens);
    } else {
      const rank = await dataLayer.submissions.getGlobalRank(best.totalCost);
      value = rank > 0 ? `#${rank.toLocaleString("en-US")}` : "unranked";
    }

    return svg(renderBadge({ label, value }), 3600);
  } catch (error) {
    console.error("Badge render failed:", error);
    // Still an image, still 200 — a README must not show a broken image
    // because our database had a bad minute. Short TTL so it self-heals.
    return svg(renderBadge({ label, value: "unavailable", color: "#52525b" }), 60);
  }
}
