import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TierBadge from "@/components/TierBadge";
import { formatNumber, formatCurrency, toolLabel, toolBlurb, FEATURED_TOOLS } from "@/lib/utils";
import { COMPARE_MATCHUPS, matchupTitle } from "@/lib/compare";

interface ToolParams {
  params: Promise<{ tool: string }>;
}

const SITE = "https://www.viberank.app";

// Per-tool "how to check usage" guides — the query family these boards
// surface for in search ("<tool> check usage") deserves a one-click answer.
const TOOL_GUIDES: Record<string, { href: string; label: string }> = {
  claude: { href: "/blog/how-to-check-claude-code-usage", label: "How to check your Claude Code usage" },
  codex: { href: "/blog/how-to-check-codex-usage", label: "How to check your Codex usage (/status + ccusage)" },
  opencode: { href: "/blog/how-to-check-opencode-usage", label: "How to check your OpenCode usage" },
};

// These boards rank ahead of the how-to guides for "<tool> check usage" /
// "how to check <tool> token usage" — a query family with hundreds of
// impressions and effectively no clicks, because a ranking table is a bad
// answer to a how-to question. Rather than fight the ranking, answer the
// question on the page that already ranks. `builtin` is only set where the
// tool genuinely ships a usage meter.
const TOOL_USAGE: Record<string, { builtin?: string; builtinNote?: string; note?: string }> = {
  claude: {
    builtin: "/usage",
    builtinNote: "shows your 5-hour session and weekly limits, and when each resets",
  },
  codex: {
    builtin: "/status",
    builtinNote: "shows how much of your 5-hour and weekly rate limits you've used",
  },
  opencode: {
    note: "OpenCode core ships no usage meter — ccusage reads its local session storage instead.",
  },
};

// Regenerate per-tool boards hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  return FEATURED_TOOLS.map((t) => ({ tool: t.key }));
}

export async function generateMetadata({ params }: ToolParams): Promise<Metadata> {
  const { tool: raw } = await params;
  const tool = decodeURIComponent(raw).toLowerCase();
  const label = toolLabel(tool);
  const usage = TOOL_USAGE[tool];
  const title = `${label} Usage Leaderboard — Check Your Tokens & Spend`;
  // Lead with the command, because most of the queries reaching this page ask
  // how to check usage rather than who is winning.
  const description = usage?.builtin
    ? `Check your ${label} usage: type ${usage.builtin} in the CLI for limits, or npx ccusage@latest daily for tokens and real cost. Then see how you rank against 1,100+ developers.`
    : `Check your ${label} usage with npx ccusage@latest daily — per-day token counts and API-equivalent cost from your local logs. Then see how you rank against 1,100+ developers.`;
  const canonical = `${SITE}/tool/${encodeURIComponent(tool)}`;
  return {
    title,
    description,
    keywords: [
      `${label.toLowerCase()} leaderboard`,
      `${label.toLowerCase()} token usage`,
      `${label.toLowerCase()} usage tracker`,
      `how to check ${label.toLowerCase()} usage`,
      "ccusage",
      "ai token leaderboard",
      "tokenmaxxing",
      "vibe coding",
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Viberank",
      type: "website",
      images: [
        `/api/og?title=${encodeURIComponent(`${label} leaderboard`)}&description=${encodeURIComponent(`Who spends the most on ${label}, from real ccusage data`)}`,
      ],
    },
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
    {
      q: `How do I check my ${label} token usage without submitting?`,
      a: `Run npx ccusage@latest daily in your terminal — it parses ${label}'s local session logs into per-day token counts and API-equivalent costs, no account needed.`,
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
  const usage = TOOL_USAGE[tool];
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to check your ${label} token usage and cost`,
    description: `Read ${label}'s local session logs into per-day token counts and API-equivalent cost, then compare against other developers.`,
    totalTime: "PT2M",
    tool: [{ "@type": "HowToTool", name: "Node.js (npx)" }],
    step: [
      ...(usage?.builtin
        ? [{
            "@type": "HowToStep",
            name: `Check your limits with ${usage.builtin}`,
            text: `Type ${usage.builtin} inside a ${label} session — it ${usage.builtinNote}.`,
          }]
        : []),
      {
        "@type": "HowToStep",
        name: "Check tokens and cost with ccusage",
        text: `Run npx ccusage@latest daily in your terminal. It parses ${label}'s local logs into per-day input, output and cache token counts with API-equivalent USD cost. No account or API key needed.`,
      },
      {
        "@type": "HowToStep",
        name: "Compare against other developers",
        text: `Run npx viberank-cli to submit the same totals and see where your ${label} usage ranks. Only aggregate numbers are sent — never code or prompts.`,
        url: `${SITE}/tool/${encodeURIComponent(tool)}`,
      },
    ],
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbLd, howToLd, faqLd]) }} />

      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <p className="micro-label mb-3">Per-tool leaderboard</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">{label} Usage Leaderboard</h1>
        <p className="text-muted mb-6 max-w-2xl">
          Developers ranked by their {label} usage ({toolBlurb(tool)}) — by cost and tokens, from real{" "}
          <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">ccusage</a>{" "}
          data. Submit yours with <code className="font-mono text-accent">npx viberank-cli</code>.
        </p>

        {/* Answer-first: the "how do I check my usage" query family lands here
            before it lands on the guide, so answer it above the table. */}
        <section className="rounded-lg border border-border bg-surface-1 p-5 mb-8">
          <h2 className="font-mono text-base font-semibold tracking-tight mb-3">
            How to check your {label} usage
          </h2>
          <ol className="space-y-3 text-sm text-muted">
            {usage?.builtin && (
              <li>
                <span className="text-foreground font-medium">Limits</span> — type{" "}
                <code className="font-mono text-accent">{usage.builtin}</code> inside a {label} session. It{" "}
                {usage.builtinNote}.
              </li>
            )}
            <li>
              <span className="text-foreground font-medium">Tokens and cost</span> — run{" "}
              <code className="font-mono text-accent">npx ccusage@latest daily</code>. It reads {label}&apos;s local
              logs into per-day token counts and API-equivalent USD cost. No account or API key needed.
              {usage?.note && <span className="block mt-1 text-xs">{usage.note}</span>}
            </li>
            <li>
              <span className="text-foreground font-medium">Rank</span> — run{" "}
              <code className="font-mono text-accent">npx viberank-cli</code> to put those totals on the board below.
              Only aggregate numbers are submitted, never code or prompts.
            </li>
          </ol>
          {TOOL_GUIDES[tool] && (
            <Link href={TOOL_GUIDES[tool].href} className="inline-block mt-4 text-sm text-accent hover:underline">
              {TOOL_GUIDES[tool].label} — full guide →
            </Link>
          )}
        </section>

        {/* Browse other tools */}
        <div className="flex flex-wrap items-center gap-2 mb-8 text-sm">
          <span className="micro-label">Browse</span>
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

        {/* Head-to-head comparisons involving this tool */}
        <div className="flex flex-wrap items-center gap-2 -mt-4 mb-8 text-sm">
          <span className="micro-label">Compare</span>
          {COMPARE_MATCHUPS.filter((m) => m.a === tool || m.b === tool).map((m) => (
            <Link
              key={m.slug}
              href={`/compare/${m.slug}`}
              className="px-2.5 py-1 rounded-md border bg-surface-1 border-border text-muted hover:text-foreground transition-colors"
            >
              {matchupTitle(m)}
            </Link>
          ))}
        </div>

        {items.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden mb-12">
            <div className="flex items-center gap-3 px-4 py-2.5 micro-label bg-surface-1 border-b border-border">
              <div className="w-8 text-center">#</div>
              <div className="flex-1">User</div>
              <div className="hidden sm:block w-24">Tier</div>
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
                  <div className={`w-8 text-center text-sm font-mono ${i === 0 ? "text-[#f5b008] font-bold" : i === 1 ? "text-[#b8bcc4] font-bold" : i === 2 ? "text-[#c2703f] font-bold" : "text-muted"}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                      {s.githubUsername || s.username}
                    </span>
                    {s.verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  </div>
                  <div className="hidden sm:block w-24 flex-shrink-0">
                    <TierBadge totalCost={s.totalCost} size="xs" bare />
                  </div>
                  <div className="w-28 text-right text-sm font-mono font-semibold text-accent">${formatCurrency(s.totalCost)}</div>
                  <div className="w-24 text-right text-sm font-mono text-muted hidden sm:block">{formatNumber(s.totalTokens)}</div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-10 text-center mb-12">
            <p className="font-medium mb-1">No {label} submissions yet</p>
            <p className="text-sm text-muted">Be the first — run <code className="font-mono text-accent">npx viberank-cli</code></p>
          </div>
        )}

        {/* FAQ */}
        <section>
          <h2 className="font-mono text-xl font-bold tracking-tight mb-4">{label} leaderboard FAQ</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-lg border border-border bg-surface-1 p-4">
                <h3 className="font-medium mb-1.5">{f.q}</h3>
                <p className="text-sm text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
