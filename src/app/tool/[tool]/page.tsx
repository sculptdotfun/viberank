import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import { formatNumber, formatCurrency, toolLabel, toolBlurb, FEATURED_TOOLS } from "@/lib/utils";

interface ToolParams {
  params: Promise<{ tool: string }>;
}

const SITE = "https://www.viberank.app";

// Regenerate per-tool boards hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  return FEATURED_TOOLS.map((t) => ({ tool: t.key }));
}

export async function generateMetadata({ params }: ToolParams): Promise<Metadata> {
  const { tool: raw } = await params;
  const tool = decodeURIComponent(raw).toLowerCase();
  const label = toolLabel(tool);
  const title = `${label} Usage Leaderboard — Track ${label} Spend & Tokens | Viberank`;
  const description = `See who's using ${label} (${toolBlurb(tool)}) the most. Ranked by cost and tokens from real ccusage data. Submit your own with npx viberank-cli.`;
  const canonical = `${SITE}/tool/${encodeURIComponent(tool)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: "Viberank", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ToolPage({ params }: ToolParams) {
  const { tool: raw } = await params;
  const tool = decodeURIComponent(raw).toLowerCase();
  const label = toolLabel(tool);

  let items: Awaited<ReturnType<Awaited<ReturnType<typeof getServerDataLayer>>["submissions"]["getLeaderboard"]>>["items"] = [];
  try {
    const dataLayer = await getServerDataLayer();
    const lb = await dataLayer.submissions.getLeaderboard({ sortBy: "cost", page: 0, pageSize: 50, tool });
    items = lb.items;
  } catch {
    // render empty state
  }

  const faqs = [
    {
      q: `What is the ${label} usage leaderboard?`,
      a: `It ranks developers by how much they've spent and how many tokens they've used with ${label} (${toolBlurb(tool)}), based on real usage data exported by ccusage.`,
    },
    {
      q: `How do I get on the ${label} leaderboard?`,
      a: `Run npx viberank-cli, which reads your local ccusage data (including ${label}) and submits it. Sign in with GitHub to get a verified badge.`,
    },
    {
      q: `How is ${label} usage measured?`,
      a: `ccusage reads ${label}'s local logs and computes tokens and USD cost from model pricing. Viberank aggregates that per developer and ranks it.`,
    },
  ];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
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
      { "@type": "ListItem", position: 2, name: `${label} Usage Leaderboard`, item: `${SITE}/tool/${encodeURIComponent(tool)}` },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbLd, faqLd]) }} />

      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center h-14">
            <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back to leaderboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{label} Usage Leaderboard</h1>
        <p className="text-muted mb-6 max-w-2xl">
          Developers ranked by their {label} usage ({toolBlurb(tool)}) — by cost and tokens, from real{" "}
          <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">ccusage</a>{" "}
          data. Submit yours with <code className="font-mono text-accent">npx viberank-cli</code>.
        </p>

        {/* Browse other tools */}
        <div className="flex flex-wrap items-center gap-2 mb-8 text-sm">
          <span className="text-muted">Browse:</span>
          {FEATURED_TOOLS.map((t) => (
            <Link
              key={t.key}
              href={`/tool/${t.key}`}
              className={`px-2.5 py-1 rounded-md border transition-colors ${
                t.key === tool ? "bg-accent text-white border-accent" : "bg-surface-1 border-border text-muted hover:text-foreground"
              }`}
            >
              {toolLabel(t.key)}
            </Link>
          ))}
        </div>

        {items.length > 0 ? (
          <div className="rounded-2xl border border-border overflow-hidden mb-12">
            <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-muted bg-surface-1 border-b border-border">
              <div className="w-8 text-center">#</div>
              <div className="flex-1">User</div>
              <div className="w-28 text-right">Cost</div>
              <div className="w-24 text-right hidden sm:block">Tokens</div>
            </div>
            <div className="divide-y divide-border-subtle">
              {items.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/profile/${encodeURIComponent(s.githubUsername || s.username)}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors group"
                >
                  <div className="w-8 text-center text-sm text-muted font-mono">{i + 1}</div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                      {s.githubUsername || s.username}
                    </span>
                    {s.verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  </div>
                  <div className="w-28 text-right text-sm font-mono font-semibold text-accent">${formatCurrency(s.totalCost)}</div>
                  <div className="w-24 text-right text-sm font-mono text-muted hidden sm:block">{formatNumber(s.totalTokens)}</div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border p-10 text-center mb-12">
            <p className="font-medium mb-1">No {label} submissions yet</p>
            <p className="text-sm text-muted">Be the first — run <code className="font-mono text-accent">npx viberank-cli</code></p>
          </div>
        )}

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-bold tracking-tight mb-4">{label} leaderboard FAQ</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-border bg-surface-1 p-4">
                <h3 className="font-medium mb-1.5">{f.q}</h3>
                <p className="text-sm text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
