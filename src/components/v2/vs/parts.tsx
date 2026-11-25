// Presentational pieces of the head-to-head page. Server components: no hooks.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Standing } from "@/lib/v2/contract";
import { pairedHeights, type Leader, type Tally } from "@/lib/v2/invite";
import { CLI_COMMAND, PLUGIN_INSTALL_COMMAND, PLUGIN_MARKETPLACE_COMMAND } from "@/lib/commands";
import { Avatar } from "../share/parts";
import { CLASS_LABEL, DAY_INITIALS, tokens, usd, weekNumber } from "../share/format";
import CopyBlock from "../start/CopyBlock";
import type { VsHistoryWeek } from "./load";

/** Side A is the data colour (heat); side B is neutral ink, so the pair reads at a glance. */
export const SIDE_BG = { a: "bg-h3", b: "bg-ink-2" } as const;

export function SideKey({ side, username }: { side: "a" | "b"; username: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-3">
      <i className={`inline-block w-[8px] h-[8px] rounded-[2px] ${SIDE_BG[side]}`} />
      {username}
    </span>
  );
}

/** Mon–Sun, two bars a day on one shared scale. Days still to come draw as dashed outlines. */
export function PairedBars({ a, b, today, height = 120 }: { a: number[]; b: number[]; today?: number; height?: number }) {
  const h = pairedHeights(a, b);
  return (
    <div
      className="grid items-end gap-x-2 sm:gap-x-3 gap-y-[6px]"
      style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridTemplateRows: `${height}px auto` }}
      role="img"
      aria-label="Spend by day, Monday to Sunday, both developers"
    >
      {DAY_INITIALS.map((_, i) => {
        const future = today !== undefined && i + 1 > today;
        if (future) return <i key={i} className="block h-full rounded-[3px] border border-dashed border-line-2" />;
        return (
          <div key={i} className="flex items-end gap-[3px] h-full">
            {(["a", "b"] as const).map((side) => (
              <i
                key={side}
                className={`block flex-1 rounded-[2px] ${h[side][i] > 0 ? SIDE_BG[side] : "bg-h0"}`}
                style={{ height: h[side][i] > 0 ? `${h[side][i]}%` : "3%" }}
                title={usd((side === "a" ? a : b)[i] ?? 0)}
              />
            ))}
          </div>
        );
      })}
      {DAY_INITIALS.map((d, i) => (
        <span key={`l${i}`} className={`text-center font-mono text-[11px] ${today === i + 1 ? "text-ink" : "text-ink-3"}`}>
          {d}
        </span>
      ))}
    </div>
  );
}

function Cell({ value, lead, sub }: { value: string; lead: boolean; sub?: string }) {
  return (
    <div className="min-w-0 text-right">
      <b className={`block font-mono text-[15px] sm:text-[17px] font-medium tracking-[-0.02em] whitespace-nowrap ${lead ? "text-ink" : "text-ink-3"}`}>
        {value}
      </b>
      {sub && <span className="block font-mono text-[11px] text-ink-3 truncate">{sub}</span>}
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: ReactNode; b: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 sm:px-5 py-3 border-b border-line last:border-b-0">
      <span className="font-mono text-xs text-ink-3">{label}</span>
      {a}
      {b}
    </div>
  );
}

const rankText = (s: Standing) => (s.rank === null ? "–" : `#${s.rank}`);
const higher = (x: number, y: number) => x > y;
const lowerRank = (x: number | null, y: number | null) => x !== null && (y === null || x < y);

/** Tale of the tape: the numbers row by row, the better value in ink, the other dimmed. */
export function Tape({ a, b, dayWins }: { a: Standing; b: Standing; dayWins: { a: number; b: number } }) {
  const sameClass = a.cls === b.cls;
  return (
    <section className="border border-line-2 rounded-[14px] bg-panel overflow-hidden">
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 sm:px-5 py-3 border-b border-line">
        <span className="font-mono text-xs text-ink-3">this week</span>
        {[a, b].map((s, i) => (
          <Link key={s.username} href={`/profile/${encodeURIComponent(s.username)}`} className="flex items-center justify-end gap-2 min-w-0 hover:text-ink">
            <span className="truncate text-sm font-medium text-ink">{s.username}</span>
            <Avatar username={s.username} url={s.avatarUrl} size={22} />
            <i className={`hidden sm:inline-block flex-none w-[8px] h-[8px] rounded-[2px] ${SIDE_BG[i === 0 ? "a" : "b"]}`} />
          </Link>
        ))}
      </div>
      <Row
        label="rank"
        a={<Cell value={rankText(a)} lead={sameClass && lowerRank(a.rank, b.rank)} sub={`of ${a.of} · ${CLASS_LABEL[a.cls]}`} />}
        b={<Cell value={rankText(b)} lead={sameClass && lowerRank(b.rank, a.rank)} sub={`of ${b.of} · ${CLASS_LABEL[b.cls]}`} />}
      />
      <Row label="spend" a={<Cell value={usd(a.cost)} lead={higher(a.cost, b.cost)} />} b={<Cell value={usd(b.cost)} lead={higher(b.cost, a.cost)} />} />
      <Row label="tokens" a={<Cell value={tokens(a.tokens)} lead={higher(a.tokens, b.tokens)} />} b={<Cell value={tokens(b.tokens)} lead={higher(b.tokens, a.tokens)} />} />
      <Row label="days won" a={<Cell value={String(dayWins.a)} lead={dayWins.a > dayWins.b} />} b={<Cell value={String(dayWins.b)} lead={dayWins.b > dayWins.a} />} />
      <Row
        label="streak"
        a={<Cell value={`${a.streakWeeks} wk`} lead={higher(a.streakWeeks, b.streakWeeks)} />}
        b={<Cell value={`${b.streakWeeks} wk`} lead={higher(b.streakWeeks, a.streakWeeks)} />}
      />
      <Row
        label="best week"
        a={<Cell value={a.bestWeek ? usd(a.bestWeek.cost) : "–"} lead={higher(a.bestWeek?.cost ?? 0, b.bestWeek?.cost ?? 0)} sub={a.bestWeek ? `week ${weekNumber(a.bestWeek.weekId)}` : undefined} />}
        b={<Cell value={b.bestWeek ? usd(b.bestWeek.cost) : "–"} lead={higher(b.bestWeek?.cost ?? 0, a.bestWeek?.cost ?? 0)} sub={b.bestWeek ? `week ${weekNumber(b.bestWeek.weekId)}` : undefined} />}
      />
    </section>
  );
}

const WINNER_MARK: Record<Leader, string> = { a: "◀", b: "▶", tie: "=", none: "" };

/** The last weeks, oldest at the top, newest (this week) at the bottom. */
export function History({ weeks, a, b, tally, currentWeekId }: { weeks: VsHistoryWeek[]; a: string; b: string; tally: Tally; currentWeekId: string }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.a, w.b]));
  return (
    <section className="border border-line-2 rounded-[14px] bg-panel overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 sm:px-5 py-3 border-b border-line">
        <span className="font-mono text-xs text-ink-3">last {weeks.length} weeks</span>
        <span className="font-mono text-[13px] text-ink">
          {a} <b className="font-medium">{tally.a}</b> – <b className="font-medium">{tally.b}</b> {b}
          {tally.tie > 0 && <span className="text-ink-3"> · {tally.tie} level</span>}
        </span>
      </div>
      {weeks.map((w) => {
        const winner: Leader = w.a <= 0 && w.b <= 0 ? "none" : Math.abs(w.a - w.b) < 0.005 ? "tie" : w.a > w.b ? "a" : "b";
        const live = w.weekId === currentWeekId;
        return (
          <div key={w.weekId} className="grid grid-cols-[52px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 border-b border-line last:border-b-0 font-mono text-[12.5px]">
            <span className={live ? "text-ink" : "text-ink-3"}>wk {weekNumber(w.weekId)}{live ? "·" : ""}</span>
            <div className="flex items-center justify-end gap-2 min-w-0">
              <span className={winner === "a" ? "text-ink" : "text-ink-3"}>{w.a > 0 ? usd(w.a) : "–"}</span>
              <span className="hidden sm:flex w-[90px] justify-end"><i className={`block h-[6px] rounded-[1.5px] ${SIDE_BG.a}`} style={{ width: `${Math.round((w.a / max) * 100)}%` }} /></span>
            </div>
            <span className="text-center text-ink-3">{WINNER_MARK[winner]}</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:flex w-[90px]"><i className={`block h-[6px] rounded-[1.5px] ${SIDE_BG.b}`} style={{ width: `${Math.round((w.b / max) * 100)}%` }} /></span>
              <span className={winner === "b" ? "text-ink" : "text-ink-3"}>{w.b > 0 ? usd(w.b) : "–"}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** The short version of /start, for someone who arrived on an invite. */
export function JoinSteps({ handle }: { handle: string }) {
  return (
    <section className="border border-line-2 rounded-[14px] bg-panel p-5 sm:p-6 flex flex-col gap-3">
      <p className="font-mono text-[12.5px] text-ink-3 m-0">{handle}, join in ten seconds</p>
      <CopyBlock text={CLI_COMMAND} prompt="$" />
      <p className="text-[13.5px] text-ink-2 m-0">
        Reads your usage locally with ccusage and shows your rank this week. Only daily totals leave your machine; never
        prompts or code.
      </p>
      <details className="text-[13.5px] text-ink-2">
        <summary className="cursor-pointer font-mono text-xs text-ink-3 hover:text-ink">Use Claude Code? The plugin puts your rank in the status line</summary>
        <div className="flex flex-col gap-2 mt-3">
          <CopyBlock text={PLUGIN_MARKETPLACE_COMMAND} prompt=">" />
          <CopyBlock text={PLUGIN_INSTALL_COMMAND} prompt=">" />
        </div>
      </details>
      <Link href="/start" className="vr-more self-start text-[13.5px]">Every way to join, and what is sent →</Link>
    </section>
  );
}
