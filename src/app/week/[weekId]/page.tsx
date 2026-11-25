import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import TrackView from "@/components/v2/TrackView";
import WeekArchive, { ARCHIVE_ROWS } from "@/components/v2/archive/WeekArchive";
import { loadBoard } from "@/components/v2/board/load";
import { money, weekNumber, weekRange } from "@/components/v2/format";
import { boardHref, homeVariant } from "@/lib/home-flag";
import { archiveWeekState, neighbourWeeks } from "@/lib/v2/archive";
import type { BoardResult } from "@/lib/v2/contract";
import { weekRef } from "@/lib/v2/week";

const SITE = "https://www.viberank.app";

// A closed week only changes during its 12 grace hours, and the Monday 12:05
// cron warms the frozen result, so the page can cache for hours. Pages are
// built on first request, not at deploy.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface WeekParams {
  params: Promise<{ weekId: string }>;
}

// The service caps a page at 200 rows; movers are found among all of them.
const MOVER_POOL = 200;

async function read(params: WeekParams["params"]) {
  const raw = decodeURIComponent((await params).weekId);
  const id = raw.toUpperCase();
  const now = new Date();
  const state = archiveWeekState(id, now);
  if (state === "invalid" || state === "future") notFound();
  if (state === "current") redirect(boardHref(homeVariant()));
  if (raw !== id) permanentRedirect(`/week/${id}`);
  const loaded = await loadBoard({ window: "week", cls: "ranked", sort: "cost", weekId: id, limit: MOVER_POOL });
  // The fallback empty board carries the current week; keep this one's dates.
  const board = loaded.failed ? { ...loaded.board, week: weekRef(id, now) } : loaded.board;
  return { id, state, board, failed: loaded.failed, now };
}

function describe(board: BoardResult): string {
  const leader = board.rows[0];
  const range = weekRange(board.week);
  if (!leader) return `The viberank Ranked board for week ${weekNumber(board.week)} (${range}).`;
  const top = board.rows.slice(1, 3).map((r) => r.username).join(" and ");
  return `Week ${weekNumber(board.week)} (${range}) AI coding leaderboard: ${leader.username} won with ${money(leader.cost)} API-equivalent${top ? `, ahead of ${top}` : ""}. ${board.total} GitHub-verified developers ranked by Claude Code, Codex and other ccusage spend.`;
}

export async function generateMetadata({ params }: WeekParams): Promise<Metadata> {
  const { id, board, failed } = await read(params);
  const title = `Week ${weekNumber(board.week)} ${id.slice(0, 4)} AI Coding Leaderboard (${weekRange(board.week)}) | viberank`;
  const description = describe(board);
  const url = `${SITE}/week/${id}`;
  const og = `/api/og/board/${id}`;
  // An empty or failed week is not worth indexing; it still renders for links.
  const indexable = !failed && board.rows.length > 0;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: indexable, follow: true },
    openGraph: { title, description, url, siteName: "Viberank", type: "website", images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default async function WeekArchivePage({ params }: WeekParams) {
  const { id, state, board, failed, now } = await read(params);
  if (state !== "settling" && state !== "final") notFound();
  const { prev, next } = neighbourWeeks(id, now);
  const liveHref = boardHref(homeVariant());

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `viberank week ${weekNumber(board.week)}, ${id.slice(0, 4)}: Ranked board`,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: board.total,
    itemListElement: board.rows.slice(0, 10).map((r) => ({
      "@type": "ListItem",
      position: r.rank,
      name: r.username,
      url: `${SITE}/profile/${encodeURIComponent(r.username)}`,
    })),
  };

  return (
    <div className="vr">
      <NavBar />
      <TrackView event="week_archive_view" props={{ week: id }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <main className="vr-in">
        {failed ? (
          <div className="vr-empty" role="alert">Could not load week {weekNumber(board.week)}. Try again in a minute.</div>
        ) : (
          <WeekArchive
            board={{ ...board, rows: board.rows.slice(0, ARCHIVE_ROWS) }}
            allRows={board.rows}
            state={state}
            prev={prev}
            next={next}
            liveHref={liveHref}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
