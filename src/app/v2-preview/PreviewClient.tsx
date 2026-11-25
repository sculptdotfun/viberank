"use client";

import { useMemo } from "react";
import HomeClient from "../HomeClient";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import PageHead from "@/components/v2/PageHead";
import Board from "@/components/v2/board/Board";
import type { BoardSource } from "@/components/v2/board/useBoard";
import { FIXTURE_FACTS, FIXTURE_STRIP, fixtureBoard, fixtureStanding } from "@/components/v2/__fixtures__";

const ME = "sable-k";

export default function PreviewClient({ view, meMode }: { view: string; meMode: string }) {
  const me = meMode === "none" ? null : ME;
  const meRank = meMode === "far" ? 88 : 7;
  const source = useMemo<BoardSource>(
    () => async (q, limit, offset) => {
      await new Promise((r) => setTimeout(r, 150));
      return fixtureBoard(q, limit, offset, me, meRank);
    },
    [me, meRank],
  );
  const standing = me ? fixtureStanding(me, meRank) : null;

  if (view === "home") {
    const board = fixtureBoard({ window: "week", cls: "ranked", sort: "cost", tool: null }, 50, 0, me, meRank);
    return <HomeClient board={board} facts={FIXTURE_FACTS} strip={FIXTURE_STRIP} preview={{ me, standing, source }} />;
  }

  const cfg =
    view === "records"
      ? { title: "All-time records.", q: { window: "all", cls: "ranked", sort: "cost", tool: null } as const, windows: [] as const, classes: undefined }
      : view === "fleets"
        ? { title: "Fleets.", q: { window: "week", cls: "fleets", sort: "cost", tool: null } as const, windows: undefined, classes: ["fleets"] as const }
        : { title: "Claude Code Usage Leaderboard", q: { window: "all", cls: "ranked", sort: "efficiency", tool: "claude" } as const, windows: undefined, classes: undefined };

  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <PageHead eyebrow={<span>Preview · {view}</span>} title={cfg.title}>Fixture data from src/components/v2/__fixtures__.ts.</PageHead>
        <Board
          initial={fixtureBoard(cfg.q, 50, 0, me, meRank)}
          windows={cfg.windows ? [...cfg.windows] : undefined}
          classes={cfg.classes ? [...cfg.classes] : undefined}
          lockedTool={cfg.q.tool ?? undefined}
          me={me}
          source={source}
        />
      </main>
      <Footer />
    </div>
  );
}
