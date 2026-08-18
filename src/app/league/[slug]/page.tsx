import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TierBadge from "@/components/TierBadge";
import { formatNumber, formatCurrency } from "@/lib/utils";
import InvitePanel from "./InvitePanel";

interface LeagueParams {
  params: Promise<{ slug: string }>;
}

const SITE = "https://www.viberank.app";

// League boards move with their members' daily submissions.
export const revalidate = 300;

const getLeague = cache(async (slug: string) => {
  try {
    const dataLayer = await getServerDataLayer();
    return await dataLayer.leagues.getBySlug(slug);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: LeagueParams): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const data = await getLeague(slug);
  if (!data) return {};
  const title = `${data.league.name} — League Leaderboard | Viberank`;
  const description = `${data.league.name}: ${data.members.length} developers ranked by real AI coding usage on Viberank.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/league/${slug}` },
    // Private-ish spaces shouldn't compete in search; the global board does that.
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE}/league/${slug}`,
      siteName: "Viberank",
      type: "website",
      images: [
        `/api/og?title=${encodeURIComponent(data.league.name)}&description=${encodeURIComponent(`${data.members.length} developers · league leaderboard`)}`,
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LeaguePage({ params }: LeagueParams) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const data = await getLeague(slug);
  if (!data) notFound();

  const { league, members } = data;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/leagues" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Leagues
        </Link>

        <p className="micro-label mb-3">League</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">{league.name}</h1>
        <p className="text-muted mb-8">
          {members.length} member{members.length === 1 ? "" : "s"}, ranked by all-time board totals. Started by{" "}
          <Link href={`/profile/${encodeURIComponent(league.createdBy)}`} className="text-accent hover:underline">
            {league.createdBy}
          </Link>
          .
        </p>

        {members.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden mb-8">
            <div className="flex items-center gap-3 px-4 py-2.5 micro-label bg-surface-1 border-b border-border">
              <div className="w-8 text-center">#</div>
              <div className="flex-1">Member</div>
              <div className="hidden sm:block w-24">Tier</div>
              <div className="w-28 text-right">Cost</div>
              <div className="w-24 text-right hidden sm:block">Tokens</div>
            </div>
            <div className="divide-y divide-border-subtle">
              {members.map((m, i) => (
                <Link
                  key={m.username}
                  href={`/profile/${encodeURIComponent(m.username)}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors group"
                >
                  <div className={`w-8 text-center text-sm font-mono ${i === 0 ? "text-[#f5b008] font-bold" : i === 1 ? "text-[#b8bcc4] font-bold" : i === 2 ? "text-[#c2703f] font-bold" : "text-muted"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                      {m.username}
                    </span>
                    {m.verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  </div>
                  <div className="hidden sm:block w-24 flex-shrink-0">
                    {m.totalCost > 0 && <TierBadge totalCost={m.totalCost} size="xs" bare />}
                  </div>
                  <div className="w-28 text-right text-sm font-mono font-semibold text-accent">
                    {m.totalCost > 0 ? `$${formatCurrency(m.totalCost)}` : "—"}
                  </div>
                  <div className="w-24 text-right text-sm font-mono text-muted hidden sm:block">
                    {m.totalTokens > 0 ? formatNumber(m.totalTokens) : "no data yet"}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-10 text-center mb-8">
            <p className="font-medium mb-1">Nobody here yet</p>
            <p className="text-sm text-muted">Share the invite code to fill the board.</p>
          </div>
        )}

        <InvitePanel slug={slug} />

        <p className="text-xs text-muted mt-8">
          Members without a submission show as &quot;no data yet&quot; — one{" "}
          <code className="font-mono text-accent">npx viberank-cli</code> fixes that.
        </p>
      </div>
      <Footer />
    </div>
  );
}
