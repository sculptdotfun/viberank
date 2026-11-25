import Link from "next/link";
import type { BoardClass, BoardRow as Row, BoardSort, BoardWindow } from "@/lib/v2/contract";
import { money, plans, tokens, tokensPerDollar } from "../format";
import { DayBars, HandleAvatar, Movement, ToolChips, TrustTick } from "./parts";

export interface RowContext {
  window: BoardWindow;
  cls: BoardClass;
  sort: BoardSort;
  /** Day of the week (1–7) for the flat future bars; 7 when the week is closed. */
  today: number;
}

function valueCell(row: Row, sort: BoardSort): string {
  if (sort === "tokens") return tokens(row.tokens);
  if (sort === "efficiency") return tokensPerDollar(row.tokens, row.cost);
  return money(row.cost);
}

function lastCell(row: Row, cls: BoardClass): string {
  if (cls !== "ranked" && row.heldReason) return row.heldReason;
  return row.streakWeeks === 1 ? "1 wk" : `${row.streakWeeks} wks`;
}

// Every cell carries data-c so the stylesheet can drop whole columns
// (header and rows together) as the board narrows.

/** One row of any v2 board. `you` paints the visitor's own row in heat. */
export function BoardRow({ row, ctx, you = false }: { row: Row; ctx: RowContext; you?: boolean }) {
  const href = `/profile/${encodeURIComponent(row.username)}`;
  return (
    <Link href={href} prefetch={false} className={`vr-row${you ? " you" : ""}`} aria-current={you ? "true" : undefined}>
      <span className="vr-rk" data-c="rk">{row.rank}</span>
      <span data-c="mv"><Movement value={row.movement} /></span>
      <span className="vr-dev" data-c="dev">
        <HandleAvatar handle={row.username} src={row.avatarUrl} />
        <b>{row.username}</b>
        <TrustTick trust={row.trust} />
        {you && <span className="vr-you">you</span>}
        {row.underReview && <span className="vr-flag">review</span>}
      </span>
      <span data-c="tools"><ToolChips tools={row.tools} /></span>
      {ctx.window === "week" ? <span data-c="days"><DayBars days={row.days} today={ctx.today} /></span> : null}
      <span className="vr-usd" data-c="val">{valueCell(row, ctx.sort)}</span>
      <span className="vr-gp" data-c="gap">{row.gap === null || ctx.sort !== "cost" ? "–" : `+${money(row.gap)}`}</span>
      <span className="vr-pl" data-c="pl">{plans(row.planEq)}</span>
      <span className={`vr-st${ctx.cls !== "ranked" && row.heldReason ? " why" : ""}`} data-c="last" title={row.heldReason}>
        {lastCell(row, ctx.cls)}
      </span>
    </Link>
  );
}

export function BoardHead({ ctx, valueLabel }: { ctx: RowContext; valueLabel: string }) {
  return (
    <div className="vr-th" role="row">
      <span data-c="rk">#</span>
      <span data-c="mv">Move</span>
      <span data-c="dev">Developer</span>
      <span data-c="tools">Tools</span>
      {ctx.window === "week" ? <span data-c="days">Mon to Sun</span> : null}
      <span data-c="val">{valueLabel}</span>
      <span data-c="gap">Gap</span>
      <span data-c="pl">≈ plans</span>
      <span data-c="last">{ctx.cls === "ranked" ? "Streak" : ctx.cls === "fleets" ? "Declared as" : "Why open"}</span>
    </div>
  );
}
