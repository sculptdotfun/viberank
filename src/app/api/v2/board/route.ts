import { NextRequest } from "next/server";
import { cachedBoard } from "@/lib/v2/cached";
import { CACHE, parseBoardQuery } from "@/lib/v2/query";
import { v2Json, v2Options, v2Unavailable } from "@/lib/v2/api";
import { isFrozen } from "@/lib/v2/week";

/**
 * GET /api/v2/board?window=week|month|all&cls=ranked|open|fleets&sort=&tool=&week=&limit=&offset=
 *
 * One page of a v2 board (BoardResult in src/lib/v2/contract.ts). A frozen
 * week is cached for a day; anything live for two minutes.
 */

export const OPTIONS = v2Options;

export async function GET(request: NextRequest) {
  const now = new Date();
  const params = parseBoardQuery(request.nextUrl.searchParams, now);
  if ("error" in params) return v2Json({ error: params.error }, 400, CACHE.missing);

  try {
    const board = await cachedBoard(params, now);
    const frozen = params.window === "week" && isFrozen(board.week.id, now);
    return v2Json(board, 200, frozen ? CACHE.frozen : CACHE.live);
  } catch (error) {
    return v2Unavailable("The board", error);
  }
}
