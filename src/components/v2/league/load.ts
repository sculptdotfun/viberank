// This week's rows for a league's members, from the weekly service. The
// service ranks classes, not arbitrary sets, so this pages each class's week
// board (memoised server-side) and keeps the members. Ranks are then
// re-numbered inside the league by cost.
import { getServerDataLayer } from "@/lib/data";
import type { BoardClass, BoardRow, WeekRef } from "@/lib/v2/contract";
import { MAX_BOARD_LIMIT } from "@/lib/v2/service";
import { leagueRanks } from "@/lib/v2/invite";

export interface LeagueWeekRow extends BoardRow {
  cls: BoardClass;
  /** Rank on the site-wide board for its class this week. */
  siteRank: number;
}

export interface LeagueWeek {
  week: WeekRef;
  rows: LeagueWeekRow[];
  /** Members with no usage this week, in the order given. */
  idle: string[];
}

const CLASSES: BoardClass[] = ["ranked", "open", "fleets"];

export async function loadLeagueWeek(members: string[]): Promise<LeagueWeek | null> {
  try {
    const weekly = (await getServerDataLayer()).weekly;
    const wanted = new Set(members.map((m) => m.toLowerCase()));
    const found = new Map<string, LeagueWeekRow>();
    let week: WeekRef | null = null;
    for (const cls of CLASSES) {
      for (let offset = 0; found.size < wanted.size; offset += MAX_BOARD_LIMIT) {
        const board = await weekly.getBoard({ window: "week", cls, sort: "cost", limit: MAX_BOARD_LIMIT, offset });
        week ??= board.week;
        for (const row of board.rows) {
          const key = row.username.toLowerCase();
          if (wanted.has(key) && !found.has(key)) found.set(key, { ...row, cls, siteRank: row.rank });
        }
        if (offset + MAX_BOARD_LIMIT >= board.total) break;
      }
    }
    if (!week) return null;
    const rows = leagueRanks([...found.values()]);
    const idle = members.filter((m) => !found.has(m.toLowerCase()));
    return { week, rows, idle };
  } catch (err) {
    console.error("[league] week load failed", err);
    return null;
  }
}
