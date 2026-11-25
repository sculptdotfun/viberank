import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import PageHead from "@/components/v2/PageHead";
import { HandleAvatar } from "@/components/v2/board/parts";
import { loadBoard } from "@/components/v2/board/load";
import { money, moneyCompact, weekNumber, weekRange } from "@/components/v2/format";
import { boardHref, homeVariant } from "@/lib/home-flag";
import { ARCHIVE_INDEX_WEEKS, ARCHIVE_SITEMAP_WEEKS, closedWeekIds } from "@/lib/v2/archive";
import type { BoardResult } from "@/lib/v2/contract";
import { weekRef } from "@/lib/v2/week";

const SITE = "https://www.viberank.app";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Weekly AI Coding Leaderboard Archive · Every Week's Winners | viberank",
  description:
    "Every closed week of the viberank league: the winner, the spend and the frozen Ranked board of GitHub-verified developers, week by week, across Claude Code, Codex and every tool ccusage reads.",
  alternates: { canonical: `${SITE}/weeks` },
  openGraph: {
    title: "Week archive · viberank",
    description: "Every closed week of the AI coding league, frozen.",
    url: `${SITE}/weeks`,
    siteName: "Viberank",
    type: "website",
  },
};

/** Winner and totals for the recent weeks; older weeks are listed as links only. */
async function recentBoards(ids: string[]): Promise<Map<string, BoardResult>> {
  const loaded = await Promise.all(
    ids.map(async (id) => [id, await loadBoard({ window: "week", cls: "ranked", sort: "cost", weekId: id, limit: 1 })] as const),
  );
  return new Map(loaded.filter(([, r]) => !r.failed).map(([id, r]) => [id, r.board]));
}

function WeekLine({ id, board }: { id: string; board?: BoardResult }) {
  const week = board?.week ?? weekRef(id, new Date());
  const leader = board?.rows[0];
  return (
    <li>
      <Link href={`/week/${id}`} className="vr-arch-wk">
        <b>Week {weekNumber(week)}</b>
        <span className="d">{weekRange(week)}</span>
        {board && (
          <span className="who">
            {leader ? (
              <>
                <HandleAvatar handle={leader.username} src={leader.avatarUrl} size={18} />
                {leader.username} · {money(leader.cost)}
              </>
            ) : (
              "nobody ranked"
            )}
          </span>
        )}
        {board && <span className="t">{board.counts.ranked.toLocaleString("en-US")} ranked · {moneyCompact(board.totals.cost)}</span>}
      </Link>
    </li>
  );
}

export default async function WeeksPage() {
  const ids = closedWeekIds(new Date(), ARCHIVE_INDEX_WEEKS);
  const boards = await recentBoards(ids.slice(0, ARCHIVE_SITEMAP_WEEKS));
  const years = [...new Set(ids.map((id) => id.slice(0, 4)))];
  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <PageHead eyebrow={<span>Week archive · {ids.length} closed weeks</span>} title="Every week, frozen.">
          Each week runs Monday 00:00 to Sunday 24:00 UTC and freezes 12 hours after it closes. The week in progress is on the{" "}
          <Link href={boardHref(homeVariant())} className="vr-ul">live board</Link>.
        </PageHead>
        {years.map((year) => (
          <section key={year} className="vr-arch-year" aria-labelledby={`y-${year}`}>
            <h2 id={`y-${year}`}>{year}</h2>
            <ol className="vr-arch-list">
              {ids.filter((id) => id.startsWith(year)).map((id) => (
                <WeekLine key={id} id={id} board={boards.get(id)} />
              ))}
            </ol>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
