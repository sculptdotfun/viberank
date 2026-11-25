import { NextRequest } from "next/server";
import { cachedRecap } from "@/lib/v2/cached";
import { CACHE, parseUsername, parseWeekParam } from "@/lib/v2/query";
import { v2Json, v2Options, v2Unavailable } from "@/lib/v2/api";
import { isFrozen } from "@/lib/v2/week";

/**
 * GET /api/v2/recap/{username}/{weekId}
 *
 * A developer's week (WeekRecap in src/lib/v2/contract.ts) for the share card
 * and /recap page. 404 when the handle is unknown or had no usage that week.
 */

export const OPTIONS = v2Options;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string; weekId: string }> }
) {
  const now = new Date();
  const { username: rawUser, weekId: rawWeek } = await params;
  const username = parseUsername(rawUser);
  if (typeof username === "object") return v2Json({ error: username.error }, 400, CACHE.missing);
  const week = parseWeekParam(decodeURIComponent(rawWeek), now);
  if (!week) return v2Json({ error: "A week like 2026-W48 is required." }, 400, CACHE.missing);
  if (typeof week === "object") return v2Json({ error: week.error }, 400, CACHE.missing);

  try {
    const recap = await cachedRecap(username, week, now);
    if (!recap) return v2Json({ error: `No usage for ${username} in ${week}.` }, 404, CACHE.missing);
    return v2Json(recap, 200, isFrozen(week, now) ? CACHE.frozen : CACHE.live);
  } catch (error) {
    return v2Unavailable("The recap", error);
  }
}
