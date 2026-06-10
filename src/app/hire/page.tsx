import type { Metadata } from "next";
import Link from "next/link";
import { Github, BadgeCheck, BriefcaseBusiness } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import { formatNumber, formatCurrency, toolLabel, sizedAvatarUrl } from "@/lib/utils";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import TierBadge from "@/components/TierBadge";
import HireCta from "./HireCta";

export const revalidate = 300;

const TITLE = "Hire AI-native engineers | Viberank";
const DESC =
  "Engineers from the viberank leaderboard who are open to work — ranked by real, measured AI coding usage, not claims on a resume.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://www.viberank.app/hire" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://www.viberank.app/hire",
    images: [
      {
        url: "/api/og?title=Hire%20AI-native%20engineers&description=Ranked%20by%20real%2C%20measured%20AI%20coding%20usage",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default async function HirePage() {
  const dataLayer = await getServerDataLayer();
  let listings: Awaited<ReturnType<typeof dataLayer.profiles.getHireListings>> = [];
  try {
    listings = await dataLayer.profiles.getHireListings();
  } catch {
    // render the page shell even if the query hiccups
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="micro-label mb-3">Hire</p>
        <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground mb-3">
          AI-native engineers, proven by usage
        </h1>
        <p className="text-muted max-w-2xl mb-6">
          Everyone below is on the <Link href="/" className="text-accent hover:underline">viberank leaderboard</Link>{" "}
          with real, locally-measured AI coding usage — and has explicitly opted in to being contacted.
          No resumes, no claims: the rank <em>is</em> the proof of work.
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-12">
          <HireCta />
          <span className="text-xs text-muted">
            Hiring? Your role goes in front of the most agentic engineers anywhere.
          </span>
        </div>

        {listings.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 micro-label bg-surface-1 border-b border-border">
              <div className="flex-1">Engineer</div>
              <div className="hidden sm:block w-28">Tier</div>
              <div className="w-24 text-right">Usage</div>
              <div className="w-20 text-right hidden sm:block">Rank</div>
            </div>
            <div className="divide-y divide-border-subtle">
              {listings.map((l) => (
                <Link
                  key={l.githubUsername}
                  href={`/profile/${encodeURIComponent(l.githubUsername)}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {l.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sizedAvatarUrl(l.avatar, 80)}
                        alt=""
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full ring-2 ring-emerald-500/40"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
                        <BriefcaseBusiness className="w-4 h-4 text-muted" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium group-hover:text-accent transition-colors truncate">
                          {l.githubUsername}
                        </span>
                        {l.verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                        <Github className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {l.tools.map((t) => (
                          <span key={t} className="text-[10px] font-mono text-muted">
                            {toolLabel(t)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block w-28 flex-shrink-0">
                    <TierBadge totalCost={l.bestCost} size="xs" bare />
                  </div>
                  <div className="w-24 text-right flex-shrink-0">
                    <span className="text-sm font-mono font-semibold text-accent">
                      ${formatCurrency(l.bestCost)}
                    </span>
                    <div className="text-[10px] font-mono text-muted">{formatNumber(l.totalTokens)} tok</div>
                  </div>
                  <div className="w-20 text-right flex-shrink-0 hidden sm:block">
                    {l.rank && <span className="text-sm font-mono text-muted">#{l.rank}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface-1 px-6 py-12 text-center">
            <BriefcaseBusiness className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-sm text-muted max-w-md mx-auto">
              No one has opted in yet — the feature just launched. On the board?{" "}
              Flip on <span className="text-emerald-400 font-mono">Open to work</span> from your own
              profile page and you&apos;ll show up here.
            </p>
          </div>
        )}

        <p className="text-xs text-muted mt-8">
          For engineers: opt in or out anytime from your profile — it&apos;s a single toggle, visible only
          as this list and a badge. We never share emails; companies reach you via your GitHub.
        </p>
      </div>

      <Footer />
    </div>
  );
}
