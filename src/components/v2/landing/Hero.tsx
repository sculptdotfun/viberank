"use client";

import { PLAN_EQ_USD_PER_WEEK, type BoardResult, type BoardRow, type Standing } from "@/lib/v2/contract";
import { countdown, money, plans, tokens, toolName, weekNumber } from "../format";
import { Countdown, CopyCommand } from "./bits";

export interface SiteFacts {
  developers: number;
  tokens: number;
}

/** What the terminal prints: the visitor's real standing, or an example from this week's board. */
interface TermLines {
  handle: string;
  example: boolean;
  trust: string;
  activeDays: number;
  tools: string[];
  rank: number | null;
  of: number;
  movement: number | null;
  cost: number;
  tokens: number;
  above: { username: string; cost: number } | null;
}

function fromStanding(s: Standing): TermLines {
  const row = s.bracket.find((r) => r.username === s.username);
  return {
    handle: s.username,
    example: false,
    trust: s.trust,
    activeDays: s.days.filter((d) => d > 0).length,
    tools: row?.tools ?? [],
    rank: s.rank,
    of: s.of,
    movement: s.movement,
    cost: s.cost,
    tokens: s.tokens,
    above: s.above,
  };
}

function fromExample(board: BoardResult): TermLines | null {
  const idx = Math.min(6, board.rows.length - 1);
  const row: BoardRow | undefined = board.rows[idx];
  if (!row) return null;
  const above = board.rows[idx - 1];
  return {
    handle: "you",
    example: true,
    trust: "verified",
    activeDays: row.days.filter((d) => d > 0).length,
    tools: row.tools,
    rank: row.rank,
    of: board.total,
    movement: row.movement,
    cost: row.cost,
    tokens: row.tokens,
    above: above ? { username: above.username, cost: above.cost } : null,
  };
}

function moveText(m: number | null): { text: string; cls: string } {
  if (m === null) return { text: "new this week", cls: "hi" };
  if (m > 0) return { text: `▲ ${m} on last week`, cls: "ok" };
  if (m < 0) return { text: `▼ ${-m} on last week`, cls: "dn" };
  return { text: "same as last week", cls: "" };
}

function Terminal({ t, board }: { t: TermLines; board: BoardResult }) {
  const wk = weekNumber(board.week);
  const day = board.week.closed ? 7 : Math.max(1, board.week.day);
  const pace = (t.cost / day) * (7 / PLAN_EQ_USD_PER_WEEK);
  const mv = moveText(t.movement);
  const toolList = t.tools.length ? t.tools.slice(0, 3).map(toolName).join(", ") : "your local logs";
  const behind = t.above && t.rank && t.rank > 1 ? `${money(Math.max(0, t.above.cost - t.cost))} behind @${t.above.username}.` : "Top of the board. Hold it to Sunday.";
  return (
    <div className="vr-term" aria-label="Terminal showing the viberank CLI">
      <div className="tb"><i /><i /><i /><span>~/app · zsh{t.example ? " · example" : ""}</span></div>
      <pre>
        <span className="p">$</span> <span className="hi">npx viberank-cli</span>{"\n"}
        <span className="ok">✓</span> read {t.activeDays} {t.activeDays === 1 ? "day" : "days"} from {toolList}{"\n"}
        <span className="ok">✓</span> synced as <span className="hi">@{t.handle}</span>{t.trust === "verified" ? ", verified" : t.trust === "claimed" ? ", claimed" : ""}{"\n\n"}
        <span className="hi">Week {wk} · Ranked</span>{"\n"}
        {t.rank !== null ? (
          <>
            <span className="big">#{t.rank} of {t.of.toLocaleString("en-US")}</span>   <span className={mv.cls}>{mv.text}</span>{"\n"}
          </>
        ) : (
          <>
            <span className="big">No usage yet this week</span>{"\n"}
          </>
        )}
        <span className="hi">{money(t.cost)}</span> so far · {tokens(t.tokens)} tokens · pace ≈ {plans(pace)} plans{"\n"}
        {behind}
      </pre>
      <div className="vr-sl">
        <span>~/app</span>
        <span>main</span>
        <span>Opus 5.5</span>
        <span className="me">
          ◆ {t.rank !== null ? <b>#{t.rank}{t.movement && t.movement > 0 ? ` ▲${t.movement}` : t.movement && t.movement < 0 ? ` ▼${-t.movement}` : ""}</b> : <b>–</b>} · wk {wk}
        </span>
      </div>
    </div>
  );
}

export default function Hero({ board, standing, facts }: { board: BoardResult; standing: Standing | null; facts: SiteFacts | null }) {
  const wk = weekNumber(board.week);
  const lines = standing ? fromStanding(standing) : fromExample(board);
  return (
    <div className="vr-hero">
      <div>
        <div className="vr-status">
          <span className="vr-live"><i />Week {wk} is live</span>
          <span>
            closes Monday 00:00 UTC, <Countdown closesAt={board.week.closesAt} initial={countdown(board.week.closesAt)} /> left
          </span>
        </div>
        <h1 className="vr-h1">The weekly league for AI coding.</h1>
        <p className="vr-lede">
          Sync your Claude Code, Codex and OpenCode usage once. Every Monday the week closes, you get a rank among verified
          people at your scale, and a card worth posting.
        </p>
        <div className="vr-cta">
          <CopyCommand source="hero" />
          <a className="vr-more" href="#board">See this week’s board</a>
        </div>
        <div className="vr-facts">
          {facts && (
            <>
              <span><b>{facts.developers.toLocaleString("en-US")}</b> developers on record</span>
              <span><b>{tokens(facts.tokens)}</b> tokens</span>
            </>
          )}
          <span>Only totals leave your machine</span>
        </div>
      </div>
      {lines && <Terminal t={lines} board={board} />}
    </div>
  );
}
