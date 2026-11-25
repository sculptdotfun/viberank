// The landing sections under the board: how it runs itself, receipts, the
// weekly card and Wrapped teaser, last month's data strip and the closing CTA.
import Link from "next/link";
import { FLEET_PLAN_EQ, PLAN_EQ_USD_PER_WEEK, type BoardResult, type BoardRow, type Standing } from "@/lib/v2/contract";
import { countdown, money, plans, tokens, weekNumber, weekRange } from "../format";
import { DayBarsCard, HandleAvatar } from "../board/parts";
import { Countdown, CopyCommand } from "./bits";

export function HowItRuns({ week }: { week: BoardResult["week"] }) {
  const wk = weekNumber(week);
  return (
    <section className="vr-sec" aria-labelledby="how-h">
      <h2 className="vr-h2" id="how-h">One command. Then it runs itself.</h2>
      <p className="vr-p">No dashboard to check. Your rank lives where you already work, and the week ends whether you look or not.</p>
      <div className="vr-3">
        <div className="vr-step">
          <div className="fig">
            <div className="fig-sl">
              <div className="l">&gt; fix the flaky checkout test</div>
              <div className="vr-sl" style={{ borderTop: 0 }}>
                <span>main</span><span>Opus 5.5</span><span className="me">◆ <b>#7 ▲4</b> · wk {wk}</span>
              </div>
            </div>
          </div>
          <div className="tx">
            <span className="vr-day">Every session</span>
            <h3>Sync at session end</h3>
            <p>The Claude Code plugin sends totals when a session closes. No cron job, no second command.</p>
          </div>
        </div>
        <div className="vr-step">
          <div className="fig">
            <div className="fig-lad">
              <div>#5 · @lindqvist<span>$988</span></div>
              <div>#6 · @amara-o<span>$902</span></div>
              <div className="on">#7 · you<span>$835</span></div>
              <div>#8 · @pdelgado<span>$811</span></div>
              <div>#9 · @vasquez-io<span>$796</span></div>
            </div>
          </div>
          <div className="tx">
            <span className="vr-day">All week</span>
            <h3>Rank in the status line</h3>
            <p>Your rank and the gap to the row above sit beside the model name. Nobody on one plan is ranked against a fleet.</p>
          </div>
        </div>
        <div className="vr-step">
          <div className="fig">
            <div className="fig-res">
              Week {wk - 1 > 0 ? wk - 1 : 52} closed<br />
              <b>#3 of 241 ranked</b><br />
              <span style={{ color: "var(--up)" }}>▲ 4 on the week before</span><br />
              5 active days · 4 weeks in a row
            </div>
          </div>
          <div className="tx">
            <span className="vr-day">Monday 00:00 UTC</span>
            <h3>Get your results</h3>
            <p>A line in your terminal and a card to post. Then the next week starts from zero for everyone.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayLabel(start: string, i: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return `${DAY_NAMES[i]} ${d.getUTCDate()}`;
}

/** A receipt for the board's #1: each counted day, identity and scale. Real figures from this week's board. */
function Receipt({ row, week }: { row: BoardRow; week: BoardResult["week"] }) {
  const today = week.closed ? 7 : week.day;
  const pace = (row.cost / Math.max(1, today)) * (7 / PLAN_EQ_USD_PER_WEEK);
  const lines = row.days.slice(0, today).map((cost, i) => ({ i, cost, live: !week.closed && i === today - 1 }));
  return (
    <div className="vr-rcpt">
      <div className="hd">
        <span>@{row.username} · week {weekNumber(week)}</span>
        <span style={{ color: "var(--ink-3)" }}>Ranked #{row.rank}</span>
      </div>
      {lines.map((l) => (
        <div className="ln" key={l.i}>
          <span>{dayLabel(week.start, l.i)}</span>
          <span>{l.live ? <><span className="lv">●</span> live, still counting</> : l.cost > 0 ? <><span className="ok">✓</span> counted</> : <span style={{ color: "var(--ink-3)" }}>no usage</span>}</span>
          <span>{money(l.cost)}</span>
        </div>
      ))}
      <div className="kv"><span>identity</span><span>{row.trust === "verified" ? "GitHub, signed token" : row.trust === "claimed" ? "GitHub, claimed" : "CLI, unclaimed"}</span></div>
      <div className="kv"><span>scale</span><span>pace ≈ {plans(pace)} plans · limit {FLEET_PLAN_EQ}</span></div>
      <div className="kv" style={{ borderBottom: 0 }}>
        <span>flags</span>
        <span>{row.underReview ? "under review" : "none"} · <Link href={`/profile/${encodeURIComponent(row.username)}`} style={{ color: "var(--ink-3)" }}>see the profile</Link></span>
      </div>
    </div>
  );
}

export function Receipts({ board }: { board: BoardResult }) {
  const top = board.window === "week" ? board.rows[0] : undefined;
  return (
    <section className="vr-sec" aria-labelledby="trust-h">
      <div className="vr-split">
        <div>
          <h2 className="vr-h2" id="trust-h">Every row has receipts.</h2>
          <p className="vr-p">Other boards show a billion-dollar #1. This one shows where each number came from, and holds what it cannot explain.</p>
          <ul className="vr-rules">
            <li><b>Fresh days only</b><span>A day counts for the week it happened in, up to 12 hours after the week closes. Old history builds your record, never your rank.</span></li>
            <li><b>Verified handles</b><span>Ranked rows are signed with a GitHub-linked token.</span></li>
            <li><b>Human scale</b><span>Ranked stops at {FLEET_PLAN_EQ} plans a week. Teams, relays and pipelines list on Fleets.</span></li>
            <li><b>Held, then ranked</b><span>An unusual entry keeps its profile, shows on Open with the reason, and is ranked only after review.</span></li>
          </ul>
        </div>
        <div>
          {top && <Receipt row={top} week={board.week} />}
          <div className="vr-held"><b>held</b><span>A day far above the profile’s usual pattern. Listed on Open with the reason, not ranked until a maintainer clears it.</span></div>
          <div className="vr-held"><b style={{ color: "var(--ink-2)" }}>fleet</b><span>Above {FLEET_PLAN_EQ} plans a week under one handle. Listed on Fleets with what it declared, never against one person.</span></div>
        </div>
      </div>
    </section>
  );
}

interface CardFigures {
  handle: string;
  avatarUrl?: string;
  rank: number | null;
  of: number;
  movement: number | null;
  days: number[];
  cost: number;
  tokens: number;
  planEq: number;
  streak: number;
  example: boolean;
}

function cardFigures(board: BoardResult, standing: Standing | null): CardFigures | null {
  if (standing) {
    return { handle: standing.username, avatarUrl: standing.avatarUrl, rank: standing.rank, of: standing.of, movement: standing.movement, days: standing.days, cost: standing.cost, tokens: standing.tokens, planEq: standing.planEq, streak: standing.streakWeeks, example: false };
  }
  const row = board.rows[Math.min(2, board.rows.length - 1)];
  if (!row) return null;
  return { handle: "you", rank: row.rank, of: board.total, movement: row.movement, days: row.days, cost: row.cost, tokens: row.tokens, planEq: row.planEq, streak: row.streakWeeks, example: true };
}

/** Decorative year grid for the Wrapped teaser; a fixed pattern, labelled as an example. */
function heatCells(): string[] {
  const levels = ["var(--h0)", "var(--h1)", "var(--h2)", "var(--h3)", "var(--h4)"];
  let seed = 2026;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: 371 }, (_, i) => {
    const wk = Math.floor(i / 7);
    let base = wk < 8 ? 0.25 : wk < 20 ? 0.5 : wk < 40 ? 0.72 : 0.8;
    if (i % 7 > 4) base *= 0.55;
    const v = rnd();
    const l = v > base ? 0 : v > base * 0.7 ? 1 : v > base * 0.42 ? 2 : v > base * 0.16 ? 3 : 4;
    return wk === 52 && i % 7 > 3 ? "transparent" : levels[l];
  });
}

export function CardTeaser({ board, standing, me }: { board: BoardResult; standing: Standing | null; me: string | null }) {
  const f = cardFigures(board, standing);
  const wk = weekNumber(board.week);
  const today = board.week.closed ? 7 : board.week.day;
  const activeDays = f ? f.days.slice(0, today).filter((d) => d > 0).length : 0;
  const badgeUser = me ?? "you";
  return (
    <section className="vr-sec" aria-labelledby="card-h">
      <h2 className="vr-h2" id="card-h">A card every Monday. Wrapped in December.</h2>
      <p className="vr-p">The week card is made for you when the week closes. Wrapped 2026 covers the whole year, including months your local logs already deleted.</p>
      <div className="vr-share">
        {f && (
          <div className="vr-card">
            <div className="r1">
              <span className="who"><HandleAvatar handle={f.handle} src={f.avatarUrl} />@{f.handle}</span>
              <span>viberank · week {wk} · {weekRange(board.week)}{f.example ? " · example" : ""}</span>
            </div>
            <div className="rank">
              <b>{f.rank !== null ? `#${f.rank}` : "–"}</b>
              <div>
                of {f.of.toLocaleString("en-US")} ranked
                <strong className={f.movement !== null && f.movement < 0 ? "dn" : ""}>
                  {f.movement === null ? "New this week" : f.movement > 0 ? `▲ ${f.movement} on last week` : f.movement < 0 ? `▼ ${-f.movement} on last week` : "Held your place"}
                </strong>
              </div>
              <DayBarsCard days={f.days} today={today} />
            </div>
            <div className="nums">
              <div><b>{money(f.cost)}</b><span>this week, API-equivalent</span></div>
              <div><b>{tokens(f.tokens)}</b><span>tokens</span></div>
              <div><b>{activeDays} of 7</b><span>active days</span></div>
              <div><b>≈ {plans(f.planEq)}</b><span>plans</span></div>
            </div>
          </div>
        )}
        <div className="vr-wrapcol">
          <Link href="/wrapped/2026" className="vr-year">
            <div className="r1"><span>Wrapped 2026</span><span>see yours →</span></div>
            <h3>Your year in AI coding, one page.</h3>
            <div className="vr-heat" aria-hidden>
              {heatCells().map((c, i) => <i key={i} style={{ background: c }} />)}
            </div>
            <p>Active days · best week · longest run · top models · <b>shareable</b></p>
          </Link>
          <div className="vr-badge">
            <span className="bd"><span>viberank</span><b>#{f?.rank ?? 7} · wk {wk}</b></span>
            <span className="bd"><span>streak</span><b>{f?.streak ?? 4} wks</b></span>
            <code>![viberank](https://www.viberank.app/api/badge/{badgeUser})</code>
          </div>
        </div>
      </div>
    </section>
  );
}

export interface MonthStrip {
  label: string;
  developers: number;
  models: { name: string; share: number; color: string }[];
  tools: { name: string; share: number; color: string }[];
}

function Bars({ items }: { items: MonthStrip["models"] }) {
  return (
    <>
      {items.map((m) => (
        <div className="vr-bar" key={m.name}>
          <span>{m.name}</span>
          <div><i style={{ width: `${Math.max(1, Math.round(m.share))}%`, background: m.color }} /></div>
          <span>{Math.round(m.share)}%</span>
        </div>
      ))}
    </>
  );
}

export function DataStrip({ strip }: { strip: MonthStrip }) {
  return (
    <section className="vr-sec" aria-labelledby="index-h">
      <h2 className="vr-h2" id="index-h">What the board ran last month.</h2>
      <p className="vr-p">
        {strip.label}, from {strip.developers.toLocaleString("en-US")} developers. Free to cite under CC BY 4.0. <Link href="/data" className="vr-ul">Open data and API</Link>
      </p>
      <div className="vr-index">
        {strip.models.length > 0 && <div className="vr-ix"><h3>Share of spend by model</h3><Bars items={strip.models} /></div>}
        {strip.tools.length > 0 && <div className="vr-ix"><h3>Developers using each tool</h3><Bars items={strip.tools} /></div>}
      </div>
    </section>
  );
}

export function Closing({ week }: { week: BoardResult["week"] }) {
  return (
    <div className="vr-end">
      <h2>
        Week {weekNumber(week)} closes in <Countdown closesAt={week.closesAt} initial={countdown(week.closesAt)} />.
      </h2>
      <div className="vr-cta">
        <CopyCommand source="closing" />
        <Link className="vr-more" href="/start">Other ways to join →</Link>
      </div>
    </div>
  );
}
