import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import PageHead from "@/components/v2/PageHead";
import BoardWithMe from "@/components/v2/board/BoardWithMe";
import { loadBoard } from "@/components/v2/board/load";
import { FLEET_PLAN_EQ } from "@/lib/v2/contract";

const SITE = "https://www.viberank.app";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Fleets — Teams, Relays and Agent Farms | viberank",
  description: `Entries above ${FLEET_PLAN_EQ} plan-equivalents a week: teams, relays and agent pipelines. Listed in public with what they declared, never ranked against one person.`,
  alternates: { canonical: `${SITE}/fleets` },
  openGraph: {
    title: "Fleets · viberank",
    description: "Teams, relays and agent farms, listed apart from people.",
    url: `${SITE}/fleets`,
    siteName: "Viberank",
    type: "website",
  },
};

export default async function FleetsPage() {
  const { board, failed } = await loadBoard({ window: "week", cls: "fleets", sort: "cost", limit: 50 });
  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <PageHead eyebrow={<span>Above {FLEET_PLAN_EQ} plans a week</span>} title="Fleets.">
          Teams, relays and agent pipelines run at a scale no one person on one plan reaches. They stay public here, with
          what they declared, so the Ranked board stays a contest between people.
        </PageHead>
        <BoardWithMe initial={board} failed={failed} windows={["week", "month", "all"]} classes={["fleets"]} syncUrl anchorId="fleets" />
      </main>
      <Footer />
    </div>
  );
}
