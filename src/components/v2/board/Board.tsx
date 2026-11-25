"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FEATURED_TOOLS, toolLabel } from "@/lib/utils";
import { boardViewed, bracketToggled } from "@/lib/analytics";
import { FLEET_PLAN_EQ, type BoardClass, type BoardResult, type BoardRow as Row, type BoardWindow, type Standing } from "@/lib/v2/contract";
import { valueHeader, weekNumber, weekRange, WINDOW_LABEL } from "../format";
import { BoardHead, BoardRow, type RowContext } from "./BoardRow";
import { queryFromUrl, useBoard, writeQueryToUrl, type BoardQuery, type BoardSource } from "./useBoard";

export interface BoardProps {
  initial: BoardResult;
  /** Window tabs to offer. "all" becomes a link when `allHref` is set (the home links to /records). */
  windows?: BoardWindow[];
  allHref?: string;
  classes?: BoardClass[];
  /** Locks the board to one tool (the /tool pages); hides the tool filter. */
  lockedTool?: string;
  showToolFilter?: boolean;
  /** Mirror sort/class/window into the address bar so a view can be shared. */
  syncUrl?: boolean;
  pageSize?: number;
  me?: string | null;
  standing?: Standing | null;
  /** id for in-page links ("See this week's board"). */
  anchorId?: string;
  source?: BoardSource;
  /** The server could not load the first page: show the error and a retry, not an empty board. */
  failed?: boolean;
  /** Show only this many rows until "Show top N" is pressed (the home keeps the board a glance). */
  collapsedRows?: number;
}

const CLASS_LABEL: Record<BoardClass, string> = { ranked: "Ranked", open: "Open", fleets: "Fleets" };
const SORT_LABEL = { cost: "Spend", tokens: "Tokens", efficiency: "Efficiency" } as const;

function title(result: BoardResult): { h: string; sub: string } {
  const n = result.total.toLocaleString("en-US");
  const noun = result.cls === "ranked" ? "ranked" : result.cls === "open" ? "open" : "fleets";
  if (result.window === "week") {
    const wk = result.week;
    const when = wk.closed ? "closed" : `day ${wk.day} of 7`;
    return { h: `Week ${weekNumber(wk)}`, sub: `${weekRange(wk)} · ${n} ${noun} · ${when}` };
  }
  if (result.window === "month") return { h: "This month", sub: `${n} ${noun} · API-equivalent spend so far` };
  return { h: "All-time records", sub: `${n} ${noun} · lifetime totals` };
}

function RuleLine({ result }: { result: BoardResult }) {
  const n = result.total.toLocaleString("en-US");
  if (result.cls === "fleets") {
    return (
      <>
        <span><b>Fleets</b> · {n} entries</span>
        <span>Above {FLEET_PLAN_EQ} plans a week</span>
        <span>Listed, not ranked against people</span>
      </>
    );
  }
  if (result.cls === "open") {
    return (
      <>
        <span><b>Open</b> · {n} entries</span>
        <span>Unclaimed or under review</span>
        <span>Public, with the reason shown</span>
      </>
    );
  }
  return (
    <>
      <span><b>Ranked</b> · {n} developers</span>
      <span>GitHub-verified</span>
      <span>At most {FLEET_PLAN_EQ} plans a week</span>
    </>
  );
}

function Tabs({ q, setQ, windows, allHref, classes, counts }: {
  q: BoardQuery;
  setQ: (next: Partial<BoardQuery>) => void;
  windows: BoardWindow[];
  allHref?: string;
  classes: BoardClass[];
  counts: BoardResult["counts"];
}) {
  return (
    <div className="vr-tabs" role="tablist" aria-label="Board">
      {windows.map((w) =>
        w === "all" && allHref ? (
          <Link key={w} href={allHref} className="vr-tab">{WINDOW_LABEL[w]} →</Link>
        ) : (
          <button key={w} type="button" role="tab" className="vr-tab" aria-selected={q.window === w} onClick={() => setQ({ window: w })}>
            {WINDOW_LABEL[w]}
          </button>
        ),
      )}
      {windows.length > 0 && classes.length > 1 && <span className="sep" aria-hidden />}
      {classes.length > 1 &&
        classes.map((c) => (
          <button key={c} type="button" role="tab" className="vr-tab" aria-selected={q.cls === c} onClick={() => setQ({ cls: c })}>
            {CLASS_LABEL[c]} <span className="ct">{counts[c].toLocaleString("en-US")}</span>
          </button>
        ))}
    </div>
  );
}

function Controls({ q, setQ, showToolFilter, bracket, onBracket }: {
  q: BoardQuery;
  setQ: (next: Partial<BoardQuery>) => void;
  showToolFilter: boolean;
  bracket: boolean | null;
  onBracket: (on: boolean) => void;
}) {
  return (
    <div className="vr-ctl">
      {bracket !== null && (
        <div className="vr-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={!bracket} onClick={() => onBracket(false)}>Top</button>
          <button type="button" aria-pressed={bracket} onClick={() => onBracket(true)}>Your bracket</button>
        </div>
      )}
      {showToolFilter && (
        <label className="vr-select">
          <span className="sr-only">Tool</span>
          <select value={q.tool ?? ""} onChange={(e) => setQ({ tool: e.target.value || null })}>
            <option value="">All tools</option>
            {FEATURED_TOOLS.map((t) => (
              <option key={t.key} value={t.key}>{t.key === "claude" ? "Claude Code" : toolLabel(t.key)}</option>
            ))}
          </select>
        </label>
      )}
      <div className="vr-seg" role="group" aria-label="Sort by">
        {(Object.keys(SORT_LABEL) as (keyof typeof SORT_LABEL)[]).map((s) => (
          <button key={s} type="button" aria-pressed={q.sort === s} onClick={() => setQ({ sort: s })}>{SORT_LABEL[s]}</button>
        ))}
      </div>
    </div>
  );
}

/** The visitor's row from their standing, if it belongs on the board being shown. */
function myRow(standing: Standing | null | undefined, q: BoardQuery): Row | null {
  if (!standing || standing.rank === null || q.window !== "week" || q.tool || standing.cls !== q.cls) return null;
  return standing.bracket.find((r) => r.username === standing.username) ?? null;
}

export default function Board({
  initial,
  windows = ["week", "month", "all"],
  allHref,
  classes = ["ranked", "open", "fleets"],
  lockedTool,
  showToolFilter = !lockedTool,
  syncUrl = false,
  pageSize = 50,
  me = null,
  standing = null,
  anchorId,
  source,
  failed = false,
  collapsedRows,
}: BoardProps) {
  const defaults = useMemo<BoardQuery>(
    () => ({ window: initial.window, cls: initial.cls, sort: initial.sort, tool: lockedTool ?? null }),
    [initial.window, initial.cls, initial.sort, lockedTool],
  );
  const { query: q, setQuery, result, status, more, retry } = useBoard(initial, defaults, pageSize, source, failed);
  const [bracket, setBracket] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (syncUrl) setQuery(queryFromUrl(defaults, Boolean(lockedTool)));
  }, [syncUrl, defaults, lockedTool, setQuery]);

  // Funnel: which boards people actually look at, first view and every tab change.
  useEffect(() => {
    boardViewed(q.window, q.cls);
  }, [q.window, q.cls]);

  const toggleBracket = (on: boolean) => {
    setBracket(on);
    bracketToggled(on);
  };

  const setQ = (next: Partial<BoardQuery>) => {
    const merged = { ...q, ...next };
    setQuery(merged);
    if (syncUrl) writeQueryToUrl(merged, defaults, Boolean(lockedTool));
  };

  const mine = myRow(standing, q);
  const hasBracket = Boolean(mine && standing && standing.bracket.length > 1);
  const showBracket = bracket && hasBracket;
  const all = showBracket && standing ? standing.bracket : result.rows;
  const collapsed = Boolean(collapsedRows && !expanded && !showBracket && all.length > collapsedRows);
  const rows = collapsed ? all.slice(0, collapsedRows) : all;
  const meLower = me?.toLowerCase();
  const inView = Boolean(meLower && rows.some((r) => r.username.toLowerCase() === meLower));
  const ctx: RowContext = { window: q.window, cls: q.cls, sort: q.sort, today: result.week.closed ? 7 : result.week.day };
  const t = title(result);

  return (
    <section className="vr-win" id={anchorId} aria-busy={status === "loading"}>
      <div className="vr-winhead">
        <h2>{t.h}</h2>
        <span className="w">{t.sub}</span>
        <Tabs q={q} setQ={setQ} windows={windows} allHref={allHref} classes={classes} counts={result.counts} />
      </div>
      <div className="vr-rule">
        <RuleLine result={result} />
        <Controls q={q} setQ={setQ} showToolFilter={showToolFilter} bracket={hasBracket ? showBracket : null} onBracket={toggleBracket} />
      </div>
      <div className={`vr-grid c-${q.cls}${q.window === "week" ? "" : " nodays"}${status === "loading" ? " busy" : ""}`} role="table" aria-label={t.h}>
        <BoardHead ctx={ctx} valueLabel={valueHeader(q.sort, q.window)} />
        {status === "error" && (
          <div className="vr-gap err" role="alert">
            Could not load this board. <button type="button" onClick={retry}>Try again</button>
          </div>
        )}
        {status !== "error" && rows.length === 0 && (
          <div className="vr-empty">
            Nobody here yet{q.window === "week" ? " this week" : ""}. Be first: <code>npx viberank-cli</code>
          </div>
        )}
        {showBracket && rows[0] && rows[0].rank > 1 && <div className="vr-gap">1–{rows[0].rank - 1} above your bracket</div>}
        {rows.map((r) => (
          <BoardRow key={`${r.rank}-${r.username}`} row={r} ctx={ctx} you={r.username.toLowerCase() === meLower} />
        ))}
        {mine && !inView && (
          <div className="vr-pin">
            <div className="vr-gap">
              {(rows.at(-1)?.rank ?? 0) + 1}–{mine.rank - 1} · {Math.max(0, mine.rank - 1 - (rows.at(-1)?.rank ?? 0)).toLocaleString("en-US")} more
            </div>
            <BoardRow row={mine} ctx={ctx} you />
          </div>
        )}
      </div>
      <div className="vr-foot">
        <span>API-equivalent dollars from ccusage. Not money paid.</span>
        {collapsed ? (
          <button type="button" className="vr-more-btn" onClick={() => setExpanded(true)}>
            Show top {all.length} · of {result.total.toLocaleString("en-US")}
          </button>
        ) : !showBracket && result.rows.length < result.total ? (
          <button type="button" className="vr-more-btn" onClick={more} disabled={status === "loading"}>
            {status === "loading" ? "Loading…" : `Show more · ${result.rows.length} of ${result.total.toLocaleString("en-US")}`}
          </button>
        ) : (
          <span>{q.cls === "ranked" ? "Every row: GitHub-verified" : "Public, not ranked against verified people"}</span>
        )}
      </div>
    </section>
  );
}
