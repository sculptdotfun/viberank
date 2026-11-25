import { ImageResponse } from "next/og";
import type { BoardResult, BoardRow } from "@/lib/v2/contract";
import { loadBoard } from "@/components/v2/board/load";
import { archiveWeekState } from "@/lib/v2/archive";
import { OG, dayRange, tokens, usd, weekNumber } from "@/components/v2/share/format";
import { OgArrow, OgAvatar, OgMark, OgStats, getOgFonts, ogError, ogHeaders } from "@/components/v2/share/og";

// Node runtime: the weekly service reads through the server data layer.
export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ weekId: string }>;
}

function Move({ value }: { value: number | null }) {
  if (value === null) return <span style={{ display: "flex", color: OG.ink3 }}>new</span>;
  if (value === 0) return <span style={{ display: "flex", color: OG.ink3 }}>–</span>;
  const up = value > 0;
  const color = up ? OG.up : OG.down;
  return (
    <div style={{ display: "flex", alignItems: "center", color }}>
      <OgArrow up={up} size={16} color={color} />
      <span>{String(Math.abs(value))}</span>
    </div>
  );
}

// Satori lays flex children out loosely, so every column has a fixed width
// that sums to the 1072px content box: 40 + 36 + 360 + 300 + 150 + 76 + 5 gaps of 22.
const BAR_PX = 300;

function Row({ row, max }: { row: BoardRow; max: number }) {
  const first = row.rank === 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, height: 62, borderBottom: `1px solid ${OG.line}` }}>
      <span style={{ display: "flex", width: 40, flexShrink: 0, fontFamily: "Geist Mono", fontWeight: 500, fontSize: 26, color: first ? OG.heat : OG.ink2 }}>
        {String(row.rank)}
      </span>
      <div style={{ display: "flex", width: 36, flexShrink: 0 }}><OgAvatar username={row.username} url={row.avatarUrl} size={36} /></div>
      <span style={{ display: "flex", width: 360, flexShrink: 0, fontSize: 28, fontWeight: 500, color: OG.ink, overflow: "hidden", whiteSpace: "nowrap" }}>{row.username}</span>
      <div style={{ display: "flex", width: BAR_PX, flexShrink: 0, height: 10, borderRadius: 3, backgroundColor: OG.h[0] }}>
        <div style={{ display: "flex", width: Math.max(8, Math.round((row.cost / max) * BAR_PX)), height: 10, borderRadius: 3, backgroundColor: first ? OG.heat : OG.h[3] }} />
      </div>
      <span style={{ display: "flex", width: 150, flexShrink: 0, justifyContent: "flex-end", fontFamily: "Geist Mono", fontWeight: 500, fontSize: 26, color: OG.ink }}>
        {usd(row.cost)}
      </span>
      <div style={{ display: "flex", width: 76, flexShrink: 0, justifyContent: "flex-end", fontFamily: "Geist Mono", fontSize: 20 }}>
        <Move value={row.movement} />
      </div>
    </div>
  );
}

function Card({ board }: { board: BoardResult }) {
  const rows = board.rows.slice(0, 5);
  const max = Math.max(...rows.map((r) => r.cost), 1);
  const wk = weekNumber(board.week.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: OG.bg, padding: "46px 64px 44px", fontFamily: "Geist", color: OG.ink }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "Geist Mono", fontSize: 22, color: OG.ink3 }}>
          <OgMark size={26} />
          <span>{`viberank · ${dayRange(board.week.start, board.week.end)} · ${board.week.closed ? "final" : "live"}`}</span>
        </div>
        <span style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 22, color: OG.ink3 }}>Ranked · GitHub-verified</span>
      </div>
      <span style={{ display: "flex", marginTop: 22, fontSize: 64, fontWeight: 500, letterSpacing: -2.5, lineHeight: 1 }}>
        {`Week ${wk}, ${board.week.id.slice(0, 4)}`}
      </span>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
        {rows.length === 0 ? (
          <span style={{ display: "flex", fontSize: 30, color: OG.ink2, marginTop: 40 }}>Nobody ranked this week.</span>
        ) : (
          rows.map((r) => <Row key={r.username} row={r} max={max} />)
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <OgStats
          items={[
            { value: board.total.toLocaleString("en-US"), label: "ranked" },
            { value: board.totals.developers.toLocaleString("en-US"), label: "developers" },
            { value: tokens(board.totals.tokens), label: "tokens" },
            { value: usd(board.totals.cost), label: "API-equivalent" },
          ]}
        />
      </div>
    </div>
  );
}

/** GET /api/og/board/{weekId}: the week's top 5 in the v2 look, for /week/{weekId}. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const weekId = decodeURIComponent((await params).weekId).toUpperCase();
    const state = archiveWeekState(weekId, new Date());
    if (state === "invalid" || state === "future") return new Response("Unknown week", { status: 404 });
    const [{ board, failed }, fonts] = await Promise.all([
      loadBoard({ window: "week", cls: "ranked", sort: "cost", weekId, limit: 5 }),
      getOgFonts(),
    ]);
    if (failed) return new Response("Board unavailable", { status: 503 });
    return new ImageResponse(<Card board={board} />, { width: 1200, height: 630, fonts, headers: ogHeaders() });
  } catch (e: unknown) {
    return ogError(e);
  }
}
