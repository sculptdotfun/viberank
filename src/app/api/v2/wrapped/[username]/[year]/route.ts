import { NextRequest } from "next/server";
import { getWeeklyService } from "@/lib/data";
import { CACHE, parseUsername, parseYear } from "@/lib/v2/query";
import { v2Json, v2Options, v2Unavailable } from "@/lib/v2/api";

/**
 * GET /api/v2/wrapped/{username}/{year}
 *
 * A developer's year (YearWrapped in src/lib/v2/contract.ts) for Wrapped.
 * 404 when the handle is unknown or had no usage that year. A past year is
 * cached for a day; the current one for two minutes.
 */

export const OPTIONS = v2Options;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string; year: string }> }
) {
  const now = new Date();
  const { username: rawUser, year: rawYear } = await params;
  const username = parseUsername(rawUser);
  if (typeof username === "object") return v2Json({ error: username.error }, 400, CACHE.missing);
  const year = parseYear(rawYear, now);
  if (typeof year === "object") return v2Json({ error: year.error }, 400, CACHE.missing);

  try {
    const weekly = await getWeeklyService();
    const wrapped = await weekly.getYear(username, year);
    if (!wrapped) return v2Json({ error: `No usage for ${username} in ${year}.` }, 404, CACHE.missing);
    return v2Json(wrapped, 200, year < now.getUTCFullYear() ? CACHE.frozen : CACHE.live);
  } catch (error) {
    return v2Unavailable("Wrapped", error);
  }
}
