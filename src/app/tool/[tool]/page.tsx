import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import PageHead from "@/components/v2/PageHead";
import BoardWithMe from "@/components/v2/board/BoardWithMe";
import { loadBoard } from "@/components/v2/board/load";
import { toolLabel, toolBlurb, FEATURED_TOOLS } from "@/lib/utils";
import { COMPARE_MATCHUPS, matchupTitle } from "@/lib/compare";
import type { BoardSort } from "@/lib/v2/contract";

interface ToolParams {
  params: Promise<{ tool: string }>;
  searchParams?: Promise<{ sort?: string }>;
}

const SORTS: BoardSort[] = ["cost", "tokens", "efficiency"];

const SITE = "https://www.viberank.app";

// Per-tool "how to check usage" guides — the query family these boards
// surface for in search ("<tool> check usage") deserves a one-click answer.
const TOOL_GUIDES: Record<string, { href: string; label: string }> = {
  claude: { href: "/blog/how-to-check-claude-code-usage", label: "How to check your Claude Code usage" },
  codex: { href: "/blog/how-to-check-codex-usage", label: "How to check your Codex usage (/status + ccusage)" },
  opencode: { href: "/blog/how-to-check-opencode-usage", label: "How to check your OpenCode usage" },
};

// "<tool> pricing" is a bigger query than "<tool> check usage"; the board is
// where people comparing plans land, so point them at the measured answer.
const TOOL_PRICING: Record<string, { href: string; label: string }> = {
  claude: { href: "/blog/how-much-does-claude-code-cost", label: "Claude Code pricing vs what devs really spend" },
  codex: { href: "/blog/codex-pricing", label: "Codex pricing vs measured spend per developer" },
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

export default async function ToolPage({ params, searchParams }: ToolParams) {
  const { tool: raw } = await params;
  const tool = decodeURIComponent(raw).toLowerCase();
  const label = toolLabel(tool);

  // The sort comes from the URL (#200), so /tool/opencode?sort=efficiency is
  // a shareable, server-rendered view of the cheap-but-heavy cohort.
  const requested = (await searchParams)?.sort as BoardSort | undefined;
  const sort: BoardSort = requested && SORTS.includes(requested) ? requested : "cost";
  const { board, failed } = await loadBoard({ window: "all", cls: "ranked", sort, tool, limit: 50 });

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
    <div className="vr">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbLd, howToLd, faqLd]) }} />

      <NavBar />

      <main className="vr-in">
        <PageHead eyebrow={<Link href="/records" className="vr-ul">← All-time records</Link>} title={`${label} Usage Leaderboard`}>
          Developers ranked by their {label} usage ({toolBlurb(tool)}), by spend, tokens or tokens per dollar, from real{" "}
          <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer" className="vr-ul">ccusage</a>{" "}
          data. Put yours on it with <code className="vr-code">npx viberank-cli</code>.
        </PageHead>

        {/* Answer-first: the "how do I check my usage" query family lands here
            before it lands on the guide, so answer it above the board. */}
        <section className="vr-howto" aria-labelledby="howto-h">
          <h2 id="howto-h">How to check your {label} usage</h2>
          <ol>
            {usage?.builtin && (
              <li>
                <b>Limits</b>
                <span>
                  Type <code className="vr-code">{usage.builtin}</code> inside a {label} session. It {usage.builtinNote}.
                </span>
              </li>
            )}
            <li>
              <b>Tokens and cost</b>
              <span>
                Run <code className="vr-code">npx ccusage@latest daily</code>. It reads {label}&apos;s local logs into per-day
                token counts and API-equivalent USD cost. No account or API key needed.
                {usage?.note && <em>{usage.note}</em>}
              </span>
            </li>
            <li>
              <b>Rank</b>
              <span>
                Run <code className="vr-code">npx viberank-cli</code> to put those totals on the board below. Only aggregate
                numbers are submitted, never code or prompts.
              </span>
            </li>
          </ol>
          {(TOOL_GUIDES[tool] || TOOL_PRICING[tool]) && (
            <div className="vr-howto-links">
              {TOOL_GUIDES[tool] && <Link href={TOOL_GUIDES[tool].href} className="vr-ul">{TOOL_GUIDES[tool].label}</Link>}
              {TOOL_PRICING[tool] && <Link href={TOOL_PRICING[tool].href} className="vr-ul">{TOOL_PRICING[tool].label}</Link>}
            </div>
          )}
        </section>

        <nav className="vr-chips" aria-label="Other tools">
          <span className="k">Browse</span>
          {FEATURED_TOOLS.map((t) => (
            <Link key={t.key} href={`/tool/${t.key}`} aria-current={t.key === tool ? "page" : undefined}>
              {t.key === "claude" ? "Claude Code" : toolLabel(t.key)}
            </Link>
          ))}
        </nav>
        {COMPARE_MATCHUPS.some((m) => m.a === tool || m.b === tool) && (
          <nav className="vr-chips" aria-label="Comparisons">
            <span className="k">Compare</span>
            {COMPARE_MATCHUPS.filter((m) => m.a === tool || m.b === tool).map((m) => (
              <Link key={m.slug} href={`/compare/${m.slug}`}>{matchupTitle(m)}</Link>
            ))}
          </nav>
        )}

        <BoardWithMe initial={board} failed={failed} lockedTool={tool} syncUrl anchorId="board" />

        <section className="vr-sec" aria-labelledby="faq-h">
          <h2 className="vr-h2" id="faq-h">{label} leaderboard FAQ</h2>
          <div className="vr-faq">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
