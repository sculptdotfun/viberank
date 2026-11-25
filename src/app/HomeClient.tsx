"use client";

import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import SponsorSlot from "@/components/SponsorSlot";
import Board from "@/components/v2/board/Board";
import type { BoardSource } from "@/components/v2/board/useBoard";
import Hero, { type SiteFacts } from "@/components/v2/landing/Hero";
import { CardTeaser, Closing, DataStrip, HowItRuns, Receipts, type MonthStrip } from "@/components/v2/landing/Sections";
import { useMe, useStanding } from "@/components/v2/useMe";
import { HOME_FAQS } from "@/lib/home-faqs";
import type { BoardResult, Standing } from "@/lib/v2/contract";

export interface HomeClientProps {
  board: BoardResult;
  failed?: boolean;
  facts: SiteFacts | null;
  strip: MonthStrip | null;
  /** Dev preview only: a fixed visitor and standing, and a fixture board source. */
  preview?: { me: string | null; standing: Standing | null; source: BoardSource };
}

// Only signed-in users can have rows to claim, so the banner (and the
// Supabase client it pulls in) loads only for them.
const ClaimBanner = dynamic(() => import("@/components/v2/landing/ClaimBanner"), { ssr: false });

function Faq() {
  return (
    <section className="vr-sec" aria-labelledby="faq-h">
      <h2 className="vr-h2" id="faq-h">Questions</h2>
      <div className="vr-faq">
        {HOME_FAQS.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomeClient({ board, failed = false, facts, strip, preview }: HomeClientProps) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const detected = useMe();
  const me = preview ? preview.me : detected.me;
  const fetched = useStanding(preview ? null : me, preview ? preview.standing : undefined);
  const standing = preview ? preview.standing : fetched;

  return (
    <div className="vr">
      <NavBar />
      {signedIn && !preview && <ClaimBanner />}
      <main className="vr-in">
        <Hero board={board} standing={standing} facts={facts} />
        <Board
          initial={board}
          failed={failed}
          collapsedRows={12}
          anchorId="board"
          allHref="/records"
          me={me}
          standing={standing}
          syncUrl
          source={preview?.source}
        />
        <SponsorSlot placement="home_board" />
        <HowItRuns week={board.week} />
        <Receipts board={board} />
        <CardTeaser board={board} standing={standing} me={me} />
        {strip && <DataStrip strip={strip} />}
        <Faq />
        <Closing week={board.week} />
      </main>
      <Footer />
    </div>
  );
}
