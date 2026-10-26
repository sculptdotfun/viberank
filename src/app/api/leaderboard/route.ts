import { NextRequest, NextResponse } from "next/server";
import { getServerDataLayer } from "@/lib/data";
import { parseLeaderboardQuery, shapeLeaderboardEntries } from "@/lib/public-api";

/**
 * GET /api/leaderboard?limit=N&tool=<slug>
 *
 * The board as JSON, for agents (the viberank MCP server reads it) rather
 * than for the site, which renders from the data layer directly. Same query
 * as the homepage and /tool/[tool]: ranked by cost, flagged rows left out,
 * rows under review kept and marked.
 *
 * It reads the query string, so the route itself is dynamic; the CDN caches
 * each URL for five minutes, like the homepage's own refresh.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200, cache = true) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...CORS,
      "Cache-Control": cache ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store",
    },
  });
}

// No body: a 204 that carries one makes the Response constructor throw.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const query = parseLeaderboardQuery(request.nextUrl.searchParams);
  if ("error" in query) return json({ error: query.error }, 400);

  try {
    const dataLayer = await getServerDataLayer();
    const board = await dataLayer.submissions.getLeaderboard({
      sortBy: "cost",
      page: 0,
      pageSize: query.limit,
      tool: query.tool,
    });
    return json({
      updatedAt: new Date().toISOString(),
      entries: shapeLeaderboardEntries(board.items),
    });
  } catch (error) {
    console.error("Leaderboard API failed:", error);
    // Not cached: a blip shouldn't be served from the CDN for five minutes.
    return json({ error: "Leaderboard temporarily unavailable. Please try again shortly." }, 503, false);
  }
}
