// Server-side board loading for the pages. The weekly service is the source
// of truth; this only adds a well-formed empty board for when it fails, so a
// page still renders its shell and the client can retry.
import { getServerDataLayer } from "@/lib/data";
import type { BoardParams, BoardResult } from "@/lib/v2/contract";
import { currentWeek } from "../week";

export function emptyBoard(params: BoardParams): BoardResult {
  return {
    window: params.window,
    cls: params.cls,
    sort: params.sort ?? "cost",
    week: currentWeek(),
    rows: [],
    total: 0,
    counts: { ranked: 0, open: 0, fleets: 0 },
    totals: { developers: 0, tokens: 0, cost: 0 },
    updatedAt: new Date().toISOString(),
  };
}

export async function loadBoard(params: BoardParams): Promise<{ board: BoardResult; failed: boolean }> {
  try {
    const dataLayer = await getServerDataLayer();
    return { board: await dataLayer.weekly.getBoard(params), failed: false };
  } catch (err) {
    console.error("[v2] board load failed", params, err);
    return { board: emptyBoard(params), failed: true };
  }
}
