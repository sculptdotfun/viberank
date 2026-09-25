import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerDataLayer } from "@/lib/data";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import SubmissionsClient from "./SubmissionsClient";
import SubscriptionsClient from "./SubscriptionsClient";

export const metadata: Metadata = {
  title: "Your submissions | Viberank",
  description: "Review and delete your own leaderboard submissions, and declare what you pay.",
  robots: { index: false, follow: false },
};

// Always reflect the current session and current rows.
export const dynamic = "force-dynamic";

export default async function SubmissionsSettingsPage() {
  const session = await getServerSession(authOptions);

  let rows: {
    id: string;
    totalCost: number;
    totalTokens: number;
    dateRange: { start: string; end: string };
    verified: boolean;
  }[] = [];
  let subscriptions: {
    id: string;
    tool: string;
    planId: string;
    startedOn: string;
    endedOn: string | null;
  }[] = [];

  if (session?.user?.username) {
    const dataLayer = await getServerDataLayer();
    try {
      const profile = await dataLayer.profiles.getProfile(session.user.username, 50);
      rows = (profile?.submissions ?? []).map((s) => ({
        id: s.id,
        totalCost: s.totalCost,
        totalTokens: s.totalTokens,
        dateRange: s.dateRange,
        verified: s.verified,
      }));
    } catch {
      // render empty state
    }
    try {
      subscriptions = (await dataLayer.profiles.getSubscriptions(session.user.username)).map((s) => ({
        id: s.id,
        tool: s.tool,
        planId: s.planId,
        startedOn: s.startedOn,
        endedOn: s.endedOn,
      }));
    } catch {
      // render empty state
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        <Link
          href={session?.user?.username ? `/profile/${encodeURIComponent(session.user.username)}` : "/"}
          className="inline-flex items-center gap-1.5 micro-label text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {session?.user?.username ? "Your profile" : "Leaderboard"}
        </Link>

        <p className="micro-label mb-3">Settings</p>
        <h1 className="font-mono text-2xl font-bold tracking-tight mb-2">Your submissions</h1>
        <p className="text-muted text-sm mb-8 max-w-xl">
          Deleting a submission removes its days from your profile and the boards. Useful when a machine migration
          or backfill double-counted a range (
          <a
            href="https://github.com/sculptdotfun/viberank/issues/127"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            #127
          </a>
          ) — delete the bad row, then re-submit clean with{" "}
          <code className="font-mono text-accent">npx viberank-cli</code>.
        </p>

        {session?.user?.username ? (
          <SubmissionsClient initialRows={rows} />
        ) : (
          <p className="text-sm text-muted">Sign in with GitHub to manage your submissions.</p>
        )}

        {session?.user?.username && (
          <section className="mt-12">
            <h2 className="font-mono text-xl font-bold tracking-tight mb-2">What you pay</h2>
            <p className="text-muted text-sm mb-6 max-w-xl">
              Every dollar on your profile is API-equivalent value: what your tokens would cost at list API prices,
              not what you paid. Declare the plans you actually pay for and your profile shows real spend next to
              that value. Declarations are public on your profile and show there within a couple of minutes;
              remove one at any time.
            </p>
            <SubscriptionsClient initial={subscriptions} />
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
