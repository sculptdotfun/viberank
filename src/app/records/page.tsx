import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import SponsorSlot from "@/components/SponsorSlot";
import PageHead from "@/components/v2/PageHead";
import BoardWithMe from "@/components/v2/board/BoardWithMe";
import { loadBoard } from "@/components/v2/board/load";

const SITE = "https://www.viberank.app";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "All-time Records — AI Coding Spend & Token Leaderboard | viberank",
  description:
    "The lifetime viberank board: developers ranked by total API-equivalent spend and tokens across Claude Code, Codex, OpenCode and every tool ccusage reads. Verified people on Ranked; teams and pipelines on Fleets.",
  alternates: { canonical: `${SITE}/records` },
  openGraph: {
    title: "All-time records · viberank",
    description: "Lifetime AI coding spend and tokens, ranked. Verified people, with receipts.",
    url: `${SITE}/records`,
    siteName: "Viberank",
    type: "website",
    images: [`/api/og?title=${encodeURIComponent("All-time records")}&description=${encodeURIComponent("Lifetime AI coding spend, ranked")}`],
  },
};

// The lifetime board that used to be the home page, in the v2 board style.
export default async function RecordsPage() {
  const { board, failed } = await loadBoard({ window: "all", cls: "ranked", sort: "cost", limit: 50 });
  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <PageHead eyebrow={<span>Lifetime board</span>} title="All-time records.">
          Everything synced since the first submission, totalled per developer. The weekly league is on the{" "}
          <Link href="/" className="vr-ul">home board</Link>; this is the long record.
        </PageHead>
        <BoardWithMe initial={board} failed={failed} windows={[]} syncUrl anchorId="records" />
        <SponsorSlot placement="records_board" />
      </main>
      <Footer />
    </div>
  );
}
