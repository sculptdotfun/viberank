"use client";

import Link from "next/link";
import { useState } from "react";
import type { LeagueBoardRow } from "@/lib/data/types";
import { DayBars, HandleAvatar, TrustTick } from "../board/parts";
import { money, tokens } from "../format";
import { CLASS_LABEL } from "../share/format";
import type { LeagueWeek } from "./load";

type View = "week" | "all";

const COLS = "grid grid-cols-[28px_minmax(0,1fr)_88px] sm:grid-cols-[36px_minmax(0,1fr)_124px_96px_84px] items-center gap-3 px-4";

function Name({ handle, src, children }: { handle: string; src?: string; children?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <HandleAvatar handle={handle} src={src} />
      <b className="font-medium truncate">{handle}</b>
      {children}
    </span>
  );
}

function WeekRows({ data }: { data: LeagueWeek }) {
  const today = data.week.closed ? 7 : data.week.day;
  return (
    <>
      <div className={`${COLS} h-9 border-b border-line font-mono text-[11.5px] text-ink-3`}>
        <span>#</span>
        <span>Member</span>
        <span className="hidden sm:block">Mon to Sun</span>
        <span className="text-right">This week</span>
        <span className="hidden sm:block text-right">Gap</span>
      </div>
      {data.rows.length === 0 && <div className="px-4 py-8 text-center text-[14.5px] text-ink-2 border-b border-line">Nobody has synced this week yet.</div>}
      {data.rows.map((r) => (
        <Link key={r.username} href={`/profile/${encodeURIComponent(r.username)}`} prefetch={false} className={`${COLS} h-[50px] border-b border-line text-[14.5px] text-ink! hover:bg-raised`}>
          <span className="font-mono text-sm font-medium text-ink-2">{r.rank}</span>
          <Name handle={r.username} src={r.avatarUrl}>
            <TrustTick trust={r.trust} />
            {r.cls !== "ranked" && (
              <span className="flex-none font-mono text-[10.5px] text-ink-3 border border-line-2 rounded px-1" title={r.heldReason}>
                {CLASS_LABEL[r.cls].toLowerCase()}
              </span>
            )}
          </Name>
          <span className="hidden sm:block"><DayBars days={r.days} today={today} /></span>
          <span className="text-right font-mono font-medium whitespace-nowrap">{money(r.cost)}</span>
          <span className="hidden sm:block text-right font-mono text-[13px] text-ink-3">{r.gap === null ? "–" : `+${money(r.gap)}`}</span>
        </Link>
      ))}
      {data.idle.map((handle) => (
        <Link key={handle} href={`/profile/${encodeURIComponent(handle)}`} prefetch={false} className={`${COLS} h-[44px] border-b border-line text-[14px] text-ink-3! hover:bg-raised`}>
          <span className="font-mono text-sm">–</span>
          <Name handle={handle} />
          <span className="hidden sm:block" />
          <span className="text-right font-mono text-[12.5px] whitespace-nowrap">no usage</span>
          <span className="hidden sm:block" />
        </Link>
      ))}
    </>
  );
}

function AllRows({ members }: { members: LeagueBoardRow[] }) {
  return (
    <>
      <div className={`${COLS} h-9 border-b border-line font-mono text-[11.5px] text-ink-3`}>
        <span>#</span>
        <span>Member</span>
        <span className="hidden sm:block" />
        <span className="text-right">All-time</span>
        <span className="hidden sm:block text-right">Tokens</span>
      </div>
      {members.map((m, i) => (
        <Link key={m.username} href={`/profile/${encodeURIComponent(m.username)}`} prefetch={false} className={`${COLS} h-[50px] border-b border-line text-[14.5px] text-ink! hover:bg-raised`}>
          <span className="font-mono text-sm font-medium text-ink-2">{m.totalCost > 0 ? i + 1 : "–"}</span>
          <Name handle={m.username}>{m.verified && <TrustTick trust="verified" />}</Name>
          <span className="hidden sm:block" />
          <span className="text-right font-mono font-medium whitespace-nowrap">{m.totalCost > 0 ? money(Math.round(m.totalCost)) : "–"}</span>
          <span className="hidden sm:block text-right font-mono text-[13px] text-ink-3">{m.totalTokens > 0 ? tokens(m.totalTokens) : "no data"}</span>
        </Link>
      ))}
    </>
  );
}

/** This week's board for the members, with the old all-time totals one tap away. */
export default function LeagueBoard({ week, members }: { week: LeagueWeek | null; members: LeagueBoardRow[] }) {
  const [view, setView] = useState<View>(week ? "week" : "all");
  return (
    <section className="border border-line-2 rounded-[14px] bg-panel overflow-hidden" aria-label="League board">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-line">
        <span className="font-mono text-xs text-ink-3">
          {view === "week" && week ? `${week.rows.length} of ${week.rows.length + week.idle.length} active this week` : `${members.length} members, all-time`}
        </span>
        <div className="vr-seg" role="group" aria-label="Window">
          <button type="button" aria-pressed={view === "week"} disabled={!week} onClick={() => setView("week")}>This week</button>
          <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>All-time</button>
        </div>
      </div>
      {view === "week" && week ? <WeekRows data={week} /> : <AllRows members={members} />}
    </section>
  );
}
