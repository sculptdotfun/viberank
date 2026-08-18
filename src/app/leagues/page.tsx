import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Users, Trophy, Shield } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import type { League } from "@/lib/data/types";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import LeaguesClient from "./LeaguesClient";

const SITE = "https://www.viberank.app";
const TITLE = "Friend Leagues — Private AI Coding Leaderboards | Viberank";
const DESC =
  "Start a private leaderboard with your friends or team. Invite-code leagues rank real AI coding usage from ccusage — Claude Code, Codex, Gemini CLI and more.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}/leagues` },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE}/leagues`,
    siteName: "Viberank",
    type: "website",
    images: [
      `/api/og?title=${encodeURIComponent("Friend Leagues")}&description=${encodeURIComponent("Private AI coding leaderboards with invite codes")}`,
    ],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default async function LeaguesPage() {
  const session = await getServerSession(authOptions);
  let myLeagues: League[] = [];
  if (session?.user?.username) {
    try {
      const dataLayer = await getServerDataLayer();
      myLeagues = await dataLayer.leagues.listForUser(session.user.username);
    } catch {
      // render without
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <p className="micro-label mb-3">Leagues</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          Your own leaderboard, your own people
        </h1>
        <p className="text-muted mb-8 max-w-2xl">
          The global board has 1,100+ developers. A league has the ones you actually know — teammates, friends, your
          Discord. Same real <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">ccusage</a>{" "}
          data, private invite code, bragging rights that matter.
        </p>

        <div className="grid gap-4 sm:grid-cols-3 mb-10">
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <Users className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium text-sm mb-1">Invite-only</p>
            <p className="text-xs text-muted m-0">A private code gates the door. Up to 100 members per league.</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <Trophy className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium text-sm mb-1">Same real data</p>
            <p className="text-xs text-muted m-0">Members rank by their board totals — no separate submission needed.</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <Shield className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium text-sm mb-1">Public page, private door</p>
            <p className="text-xs text-muted m-0">League boards are viewable; joining requires the code.</p>
          </div>
        </div>

        <LeaguesClient
          signedIn={Boolean(session?.user?.username)}
          myLeagues={myLeagues.map((l) => ({ slug: l.slug, name: l.name }))}
        />
      </div>
      <Footer />
    </div>
  );
}
