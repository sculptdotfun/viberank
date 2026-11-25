import { NextRequest } from "next/server";
import { cachedStanding } from "@/lib/v2/cached";
import { CACHE, parseUsername, parseWeekParam } from "@/lib/v2/query";
import { v2Json, v2Options, v2Unavailable } from "@/lib/v2/api";
import { isFrozen } from "@/lib/v2/week";

/**
 * GET /api/v2/standing/{username}?week=2026-W48
 *
 * Where a developer stands in a week (Standing in src/lib/v2/contract.ts):
 * rank, the rows either side, their bracket. 404 when no submission carries
 * the handle. The CLI status line and the site's pinned row read this.
 */

export const OPTIONS = v2Options;

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const now = new Date();
  const username = parseUsername((await params).username);
  if (typeof username === "object") return v2Json({ error: username.error }, 400, CACHE.missing);
  const week = parseWeekParam(request.nextUrl.searchParams.get("week"), now);
  if (week && typeof week === "object") return v2Json({ error: week.error }, 400, CACHE.missing);

  try {
    const standing = await cachedStanding(username, week, now);
    if (!standing) return v2Json({ error: `No developer named ${username}.` }, 404, CACHE.missing);
    return v2Json(standing, 200, isFrozen(standing.week.id, now) ? CACHE.frozen : CACHE.live);
  } catch (error) {
    return v2Unavailable("Standing", error);
  }
}
