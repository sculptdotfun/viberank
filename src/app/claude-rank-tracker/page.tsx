import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, RefreshCcw, Trophy, Shield } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import type { Submission } from "@/lib/data/types";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TierBadge from "@/components/TierBadge";
import { formatCurrency, formatNumber } from "@/lib/utils";

const SITE = "https://www.viberank.app";
const TITLE = "Claude Rank Tracker — Track Your Claude Code Rank, Free & Daily | Viberank";
const DESC =
  "Free Claude rank tracker: see where your Claude Code usage ranks among 1,100+ developers, updated daily. One command to join, autosubmit keeps your rank current, README badge included.";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "claude rank tracker",
    "claude rank",
    "claude ranking",
    "claude rank tracking",
    "free claude rank tracker",
    "claude code rank",
    "claude usage ranking",
    "claude leaderboard",
    "track claude rank",
  ],
  alternates: { canonical: `${SITE}/claude-rank-tracker` },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE}/claude-rank-tracker`,
    siteName: "Viberank",
    type: "website",
    images: [
      `/api/og?title=${encodeURIComponent("Claude Rank Tracker")}&description=${encodeURIComponent("Track your Claude Code rank daily — free, one command")}`,
    ],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const FAQS = [
  {
    q: "What is a Claude rank tracker?",
    a: "A tool that tracks where your Claude usage ranks against other developers. Viberank ranks real Claude Code usage — tokens and API-equivalent spend measured by ccusage from your local logs — across 1,100+ developers, and updates your rank daily if you enable autosubmit. It's free and open source.",
  },
  {
    q: "How do I track my Claude rank?",
    a: "Run npx viberank-cli once to get on the board. Then mint a token at viberank.app/settings/tokens, run npx viberank-cli login and npx viberank-cli autosubmit — your usage submits daily via your OS scheduler and your rank stays current instead of freezing on the day you first submitted.",
  },
  {
    q: "Is the Claude rank tracker free?",
    a: "Yes — tracking your rank, your profile page, charts, and the README badge are all free. The code is MIT-licensed and open source on GitHub.",
  },
  {
    q: "Can I put my Claude rank in my GitHub README?",
    a: "Yes. Viberank serves a live badge at viberank.app/api/badge/{username} showing your rank, cost, or tokens — it updates automatically as your rank changes.",
  },
  {
    q: "Looking to track Google keyword rankings with Claude instead?",
    a: "That's a different tool category — SEO rank trackers. Viberank tracks your rank on the Claude usage leaderboard, not search-engine positions. If you want to know where your AI coding usage ranks, you're in the right place.",
  },
];

export default async function ClaudeRankTrackerPage() {
  let items: Submission[] = [];
  let totalUsers = 0;
  try {
    const dataLayer = await getServerDataLayer();
    const [lb, site] = await Promise.all([
      dataLayer.submissions.getLeaderboard({ sortBy: "cost", page: 0, pageSize: 5, tool: "claude" }),
      dataLayer.stats.getSiteStats(),
    ]);
    items = lb.items;
    totalUsers = site?.totalUsers ?? 0;
  } catch {
    // render static content
  }

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Leaderboard", item: SITE },
      { "@type": "ListItem", position: 2, name: "Claude Rank Tracker", item: `${SITE}/claude-rank-tracker` },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbLd, faqLd]) }}
      />

      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <p className="micro-label mb-3">Free tool</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">Claude Rank Tracker</h1>
        <p className="text-muted mb-8 max-w-2xl">
          Track where your Claude Code usage ranks{" "}
          {totalUsers > 0 ? `among ${totalUsers.toLocaleString()} developers` : "worldwide"} — measured from your
          real{" "}
          <a
            href="https://github.com/ryoppippi/ccusage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ccusage
          </a>{" "}
          data, updated daily, free. One command to join:
        </p>

        <div className="rounded-lg border border-accent/40 bg-surface-1 p-5 mb-10 max-w-2xl">
          <code className="font-mono text-accent text-base">npx viberank-cli</code>
          <p className="text-sm text-muted mt-2 mb-0">
            Reads your local Claude Code logs and submits usage totals only — code and prompts never leave your
            machine.
          </p>
        </div>

        {/* How it works */}
        <div className="grid gap-4 sm:grid-cols-3 mb-12 max-w-4xl">
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <Trophy className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium mb-1">See your rank</p>
            <p className="text-sm text-muted m-0">
              Global and <Link href="/tool/claude" className="text-accent hover:underline">Claude-only</Link>{" "}
              rankings by cost and tokens, plus your percentile, tier, and daily charts on your profile.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <RefreshCcw className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium mb-1">Track it daily</p>
            <p className="text-sm text-muted m-0">
              <code className="font-mono text-accent">viberank-cli autosubmit</code> registers with your OS
              scheduler, so your rank moves with your usage instead of freezing at your first submission.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <Shield className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium mb-1">Show it off</p>
            <p className="text-sm text-muted m-0">
              A live README badge at{" "}
              <code className="font-mono text-xs">/api/badge/{"{username}"}</code> shows your current rank, and
              GitHub sign-in adds a verified check.
            </p>
          </div>
        </div>

        {/* Live top-5 */}
        {items.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden mb-12 max-w-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-1 border-b border-border">
              <span className="micro-label">Current top 5 — Claude Code</span>
              <Link href="/tool/claude" className="text-xs text-accent hover:underline">
                Full leaderboard →
              </Link>
            </div>
            <div className="divide-y divide-border-subtle">
              {items.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/profile/${encodeURIComponent(s.githubUsername || s.username)}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-1 transition-colors group"
                >
                  <div className="w-6 text-center text-sm font-mono text-muted">{i + 1}</div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                      {s.githubUsername || s.username}
                    </span>
                    {s.verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  </div>
                  <div className="hidden sm:block w-20 flex-shrink-0">
                    <TierBadge totalCost={s.totalCost} size="xs" bare />
                  </div>
                  <div className="w-24 text-right text-sm font-mono font-semibold text-accent">
                    ${formatCurrency(s.totalCost)}
                  </div>
                  <div className="w-20 text-right text-sm font-mono text-muted hidden sm:block">
                    {formatNumber(s.totalTokens)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <section className="mb-12 max-w-3xl">
          <h2 className="font-mono text-xl font-bold tracking-tight mb-4">Claude rank tracker FAQ</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-lg border border-border bg-surface-1 p-4">
                <h3 className="font-medium mb-1.5">{f.q}</h3>
                <p className="text-sm text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-sm text-muted max-w-3xl">
          More on what the numbers mean:{" "}
          <Link href="/blog/how-to-check-claude-code-usage" className="text-accent hover:underline">
            how to check your Claude Code usage
          </Link>
          {", "}
          <Link href="/blog/how-much-does-claude-code-cost" className="text-accent hover:underline">
            what Claude Code actually costs
          </Link>
          {", and "}
          <Link href="/calculator" className="text-accent hover:underline">
            which plan your usage justifies
          </Link>
          .
        </p>
      </div>
      <Footer />
    </div>
  );
}
