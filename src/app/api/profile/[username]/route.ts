import { NextRequest, NextResponse } from "next/server";
import { getServerDataLayer } from "@/lib/data";
import { bestSubmissionCost, shapeProfileSummary } from "@/lib/public-api";

/**
 * GET /api/profile/[username]
 *
 * One profile's headline numbers as JSON, for agents (the viberank MCP server
 * reads it). The lookup is the profile page's: case-insensitive on the
 * username, the same submissions, the same rank.
 *
 * A profile with no submissions is a 404 here, though the page renders an
 * empty shell for it: there is nothing to report, and "no profile" is what
 * tells an agent to suggest submitting.
 *
 * Cached at the CDN for two minutes, matching the page's own revalidate.
 *
 * /api/profile/open-to-work is a sibling static route and wins for that one
 * name, which no GitHub login is likely to hold.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const CACHE_FOUND = "public, s-maxage=120, stale-while-revalidate=3600";
// Short, because the next thing someone who just submitted for the first
// time does is ask for their profile.
const CACHE_NOT_FOUND = "public, s-maxage=30";
const CACHE_NONE = "no-store";

function json(body: unknown, status: number, cacheControl: string) {
  return NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": cacheControl } });
}

// No body: a 204 that carries one makes the Response constructor throw.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: raw } = await params;
  // Same cap as the badge route: no GitHub handle is longer, and the value
  // goes into a query and an error message.
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A stray "%" isn't an escape; look the text up as it came.
  }
  const username = decoded.trim().slice(0, 64);
  const notFound = () => json({ error: `No profile for @${username}` }, 404, CACHE_NOT_FOUND);
  if (!username) return notFound();

  try {
    const dataLayer = await getServerDataLayer();
    const profile = await dataLayer.profiles.getProfile(username, 100);
    if (!profile || (profile.submissions ?? []).length === 0) return notFound();

    // Rank is a nice-to-have, as on the page: report null rather than fail.
    const best = bestSubmissionCost(profile);
    let rank: number | null = null;
    if (best > 0) {
      rank = await dataLayer.submissions.getGlobalRank(best).catch(() => null);
    }

    return json(shapeProfileSummary(profile, rank), 200, CACHE_FOUND);
  } catch (error) {
    console.error("Profile API failed:", error);
    return json({ error: "Profile temporarily unavailable. Please try again shortly." }, 503, CACHE_NONE);
  }
}
