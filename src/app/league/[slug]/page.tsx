import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getServerDataLayer } from "@/lib/data";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import LeagueBoard from "@/components/v2/league/LeagueBoard";
import { loadLeagueWeek } from "@/components/v2/league/load";
import { closesIn, dayRange, weekNumber } from "@/components/v2/share/format";
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
  const description = `${data.league.name}: this week's board for ${data.members.length} developers, ranked by real AI coding usage on Viberank.`;
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
  const week = await loadLeagueWeek(members.map((m) => m.username));
  const w = week?.week;

  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <div className="max-w-4xl">
          <header className="pt-10 sm:pt-14 pb-7">
            <p className="font-mono text-[12.5px] text-ink-3 m-0 mb-3" suppressHydrationWarning>
              <Link href="/leagues" className="hover:text-ink">Leagues</Link>
              {w ? ` · week ${weekNumber(w.id)} · ${dayRange(w.start, w.end)} · ${w.closed ? "closed" : `closes in ${closesIn(w.closesAt)}`}` : ""}
            </p>
            <h1 className="text-[34px] sm:text-[48px] font-medium leading-[1.02] tracking-[-0.045em] text-ink m-0 mb-3 break-words">{league.name}</h1>
            <p className="text-ink-2 text-[15px] sm:text-[16px] leading-relaxed max-w-2xl m-0">
              {members.length} member{members.length === 1 ? "" : "s"}, ranked by this week&apos;s usage. The week resets Monday 00:00 UTC.
              Started by{" "}
              <Link href={`/profile/${encodeURIComponent(league.createdBy)}`} className="vr-ul text-ink!">
                {league.createdBy}
              </Link>
              .
            </p>
          </header>

          {members.length > 0 ? (
            <LeagueBoard week={week} members={members} />
          ) : (
            <div className="border border-line-2 rounded-[14px] bg-panel p-10 text-center">
              <p className="font-medium text-ink mb-1">Nobody here yet</p>
              <p className="text-sm text-ink-2 m-0">Share the invite link to fill the board.</p>
            </div>
          )}

          <div className="mt-6">
            <InvitePanel slug={slug} />
          </div>

          <p className="font-mono text-[12px] text-ink-3 mt-6">
            Members show up once they sync: <code className="vr-code">npx viberank-cli</code>, or{" "}
            <Link href="/start" className="vr-ul">every way to join</Link>. Ranks are within the league; dollars are API-equivalent.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
