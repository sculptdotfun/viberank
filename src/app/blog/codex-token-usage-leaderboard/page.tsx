import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Terminal, Gauge, Trophy, DollarSign } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Track OpenAI Codex Token Usage (+ the Codex Leaderboard) 2026",
  description:
    "Check your OpenAI Codex CLI token usage and costs with ccusage, understand what your sessions burn, and see how you rank against 190+ Codex developers on the public Viberank leaderboard.",
  alternates: { canonical: "https://www.viberank.app/blog/codex-token-usage-leaderboard" },
  openGraph: {
    title: "How to Track OpenAI Codex Token Usage (+ the Codex Leaderboard)",
    description:
      "Read your Codex CLI logs with ccusage, understand what sessions cost, and rank yourself on the public Codex leaderboard.",
    url: "https://www.viberank.app/blog/codex-token-usage-leaderboard",
    type: "article",
    publishedTime: "2026-07-24T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [
      {
        url: "/api/og?title=Codex%20Token%20Usage&description=Track%20it%2C%20cost%20it%2C%20rank%20it",
        width: 1200,
        height: 630,
        alt: "Track OpenAI Codex token usage",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Track OpenAI Codex Token Usage (+ the Codex Leaderboard)",
    description: "Read your Codex CLI logs with ccusage and rank yourself on the public Codex leaderboard.",
    images: ["/api/og?title=Codex%20Token%20Usage&description=Track%20it%2C%20cost%20it%2C%20rank%20it"],
  },
};

const FAQS = [
  {
    q: "How do I check my OpenAI Codex token usage?",
    a: "Codex CLI writes session logs as JSONL under ~/.codex. Run npx ccusage@latest daily to parse them into per-day token counts and API-equivalent costs, alongside any other coding agents you use.",
  },
  {
    q: "Does Codex usage tracked this way match my OpenAI bill?",
    a: "Not exactly. ccusage computes API-equivalent cost from model list prices. If you use Codex through a ChatGPT plan, you don't pay per token — the number tells you what your usage would cost at API prices, which is the fairest way to compare across tools and plans.",
  },
  {
    q: "Is there a public leaderboard for Codex usage?",
    a: "Yes — Viberank ranks developers by real usage across Codex, Claude Code, Gemini CLI and more, with a Codex-only view at viberank.app/tool/codex. Run npx viberank-cli to join.",
  },
  {
    q: "Why does Codex burn tokens so fast?",
    a: "Agentic sessions resend context every turn: system prompt, file contents, tool results. Most of that is prompt-cache reads billed at a fraction of input price, so a big token number is usually a much smaller bill.",
  },
];

export default function CodexTokenUsage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "How to Track OpenAI Codex Token Usage (+ the Codex Leaderboard) 2026",
      description:
        "Check your OpenAI Codex CLI token usage and costs with ccusage, and see how you rank on the public Codex leaderboard.",
      image: "https://www.viberank.app/api/og?title=Codex%20Token%20Usage",
      datePublished: "2026-07-24T00:00:00.000Z",
      dateModified: "2026-07-24T00:00:00.000Z",
      author: { "@type": "Organization", name: "Viberank", url: "https://www.viberank.app" },
      publisher: {
        "@type": "Organization",
        name: "Viberank",
        url: "https://www.viberank.app",
        logo: { "@type": "ImageObject", url: "https://www.viberank.app/icon.svg" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="prose prose-invert prose-neutral max-w-3xl mx-auto">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors mb-8 no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <header className="mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-4 leading-tight">
            How to Track OpenAI Codex Token Usage — and Join the Codex Leaderboard
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              July 24, 2026
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              6 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              OpenAI&apos;s Codex CLI doesn&apos;t ship a usage dashboard, but it logs everything you need locally.
              This guide shows how to turn those logs into daily token counts and dollar figures with{" "}
              <span className="font-semibold text-accent">ccusage</span>, what the numbers actually mean, and how to
              stack yours against the 190+ developers tracking Codex on the{" "}
              <Link href="/tool/codex">public Codex leaderboard</Link>.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-accent" />
            Reading your Codex usage with ccusage
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Codex CLI writes each session as JSONL under <code>~/.codex</code> (or wherever{" "}
            <code>CODEX_HOME</code> points). ccusage parses those files, diffs the per-turn token counters, and
            rolls everything up into daily and monthly reports with API-equivalent costs:
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-2">
            <div>
              <code className="text-accent font-mono">npx ccusage@latest daily</code>
              <span className="text-muted text-sm ml-3"># per-day tokens + cost, all agents</span>
            </div>
            <div>
              <code className="text-accent font-mono">npx ccusage@latest monthly</code>
              <span className="text-muted text-sm ml-3"># monthly rollup</span>
            </div>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The same command covers Claude Code, Gemini CLI, Copilot CLI and OpenCode, so if you bounce between
            agents you get one combined view instead of four dashboards. For a deeper comparison of how the big
            three stack up on cost, see{" "}
            <Link href="/blog/codex-vs-claude-code-vs-gemini-cli">Codex vs Claude Code vs Gemini CLI</Link>.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Gauge className="w-8 h-8 text-accent" />
            What the numbers mean (and why they look huge)
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Agentic coding resends context on every turn — system prompt, file contents, tool output — so daily
            token counts in the tens or hundreds of millions are normal for heavy users. The saving grace is prompt
            caching: across all usage tracked on <Link href="/stats">Viberank</Link>, roughly 95% of tokens are
            cache reads billed at a fraction of the input price. That&apos;s also why ccusage reports{" "}
            <em>API-equivalent</em> cost: if you&apos;re on a ChatGPT plan your marginal cost is $0, and the number
            tells you what your plan is actually worth — many heavy Codex users clear their subscription price in
            value within days.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-accent" />
            The Codex leaderboard
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            196 developers currently track Codex usage on Viberank, alongside 990+ on Claude Code and 76 on Gemini
            CLI. The <Link href="/tool/codex">Codex board</Link> filters the global leaderboard to submissions that
            include Codex, ranked by API-equivalent spend and tokens; every profile breaks usage down per model and
            per tool, with an activity heatmap and streaks. If you&apos;re into{" "}
            <Link href="/blog/what-is-tokenmaxxing">tokenmaxxing</Link>, this is the scoreboard.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-accent" />
            Join in one command
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx viberank-cli</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            It runs ccusage locally, submits only the usage totals (never your code or prompts), and links the
            submission to your GitHub handle — sign in on the site for a verified badge. Spending too much? Start
            with <Link href="/blog/reduce-ai-coding-costs">9 ways to cut your AI coding bill</Link>.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Codex usage FAQ</h2>
          <div className="space-y-6">
            {FAQS.map((f) => (
              <div key={f.q} className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-lg font-semibold text-foreground mt-0 mb-2">{f.q}</h3>
                <p className="text-muted m-0">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}
