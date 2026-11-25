// A closed week's permanent page: the frozen Ranked board, its totals, the
// week's climbers and newcomers, and links to the weeks either side.
// Server-only: no tabs, no live fetches; the week is over.
import Link from "next/link";
import type { BoardResult, BoardRow as Row } from "@/lib/v2/contract";
import { newEntries, topMovers, type ArchiveWeekState } from "@/lib/v2/archive";
import { money, moneyCompact, tokens, weekNumber, weekRange } from "../format";
import { BoardHead, BoardRow, type RowContext } from "../board/BoardRow";
import { HandleAvatar } from "../board/parts";
import PageHead from "../PageHead";

export const ARCHIVE_ROWS = 50;

function weekTitle(board: BoardResult): string {
  return `Week ${weekNumber(board.week)}, ${board.week.id.slice(0, 4)}`;
}

function PersonLine({ row, right }: { row: Row; right: string }) {
  return (
    <li>
      <Link href={`/profile/${encodeURIComponent(row.username)}`} prefetch={false} className="who">
        <HandleAvatar handle={row.username} src={row.avatarUrl} size={20} />
        <b>{row.username}</b>
      </Link>
      <span>{right}</span>
    </li>
  );
}

function Highlights({ board, allRows }: { board: BoardResult; allRows: Row[] }) {
  const podium = board.rows.slice(0, 3);
  const movers = topMovers(allRows);
  const fresh = newEntries(allRows);
  return (
    <div className="vr-arch-hl">
      <section className="vr-ix">
        <h3>Podium</h3>
        {podium.length ? (
          <ol>{podium.map((r) => <PersonLine key={r.username} row={r} right={`#${r.rank} · ${money(r.cost)}`} />)}</ol>
        ) : (
          <p>Nobody ranked this week.</p>
        )}
      </section>
      <section className="vr-ix">
        <h3>Top movers</h3>
        {movers.length ? (
          <ol>{movers.map((r) => <PersonLine key={r.username} row={r} right={`▲ ${r.movement} to #${r.rank}`} />)}</ol>
        ) : (
          <p>No one climbed against the week before.</p>
        )}
      </section>
      <section className="vr-ix">
        <h3>New on the board</h3>
        {fresh.length ? (
          <ol>{fresh.map((r) => <PersonLine key={r.username} row={r} right={`#${r.rank} · ${money(r.cost)}`} />)}</ol>
        ) : (
          <p>Every ranked name had a rank the week before.</p>
        )}
      </section>
    </div>
  );
}

function WeekNav({ prev, next, liveHref }: { prev: string | null; next: string | null; liveHref: string }) {
  return (
    <nav className="vr-arch-nav" aria-label="Other weeks">
      {prev ? <Link href={`/week/${prev}`} rel="prev">← Week {weekNumber({ id: prev })}</Link> : <span />}
      <Link href="/weeks">All weeks</Link>
      {next === "current" ? (
        <Link href={liveHref}>This week →</Link>
      ) : next ? (
        <Link href={`/week/${next}`} rel="next">Week {weekNumber({ id: next })} →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export interface WeekArchiveProps {
  board: BoardResult;
  /** Every loaded row (up to the API cap), for movers beyond the shown page. */
  allRows: Row[];
  state: Extract<ArchiveWeekState, "settling" | "final">;
  prev: string | null;
  next: string | null;
  liveHref: string;
}

export default function WeekArchive({ board, allRows, state, prev, next, liveHref }: WeekArchiveProps) {
  const leader = board.rows[0];
  const ctx: RowContext = { window: "week", cls: "ranked", sort: "cost", today: 7 };
  const rows = board.rows.slice(0, ARCHIVE_ROWS);
  return (
    <>
      <PageHead
        eyebrow={
          <span>
            Week archive · {weekRange(board.week)} · {state === "final" ? "final" : "closed, settling until Monday 12:00 UTC"}
          </span>
        }
        title={`${weekTitle(board)}.`}
      >
        {leader
          ? `${leader.username} won the week with ${money(leader.cost)} API-equivalent, ahead of ${(board.total - 1).toLocaleString("en-US")} other ranked developers.`
          : "No verified developer ranked this week."}{" "}
        Monday 00:00 to Sunday 24:00 UTC, frozen 12 hours after the close.
      </PageHead>

      <WeekNav prev={prev} next={next} liveHref={liveHref} />

      <div className="vr-facts vr-arch-facts">
        <span><b>{board.totals.developers.toLocaleString("en-US")}</b> developers with usage</span>
        <span><b>{tokens(board.totals.tokens)}</b> tokens</span>
        <span><b>{moneyCompact(board.totals.cost)}</b> API-equivalent</span>
        <span><b>{board.counts.ranked.toLocaleString("en-US")}</b> ranked · {board.counts.open.toLocaleString("en-US")} open · {board.counts.fleets.toLocaleString("en-US")} fleets</span>
      </div>

      <Highlights board={board} allRows={allRows} />

      <section className="vr-win" id="standings">
        <div className="vr-winhead">
          <h2>Final standings</h2>
          <span className="w">
            {weekRange(board.week)} · {board.total.toLocaleString("en-US")} ranked{board.total > rows.length ? ` · top ${rows.length}` : ""}
          </span>
        </div>
        <div className="vr-grid c-ranked" role="table" aria-label={`${weekTitle(board)} Ranked board`}>
          <BoardHead ctx={ctx} valueLabel="Week total" />
          {rows.length === 0 && <div className="vr-empty">Nobody ranked this week.</div>}
          {rows.map((r) => (
            <BoardRow key={`${r.rank}-${r.username}`} row={r} ctx={ctx} />
          ))}
        </div>
        <div className="vr-foot">
          <span>API-equivalent dollars from ccusage. Not money paid.</span>
          <span>Every row: GitHub-verified</span>
        </div>
      </section>

      <WeekNav prev={prev} next={next} liveHref={liveHref} />
    </>
  );
}
