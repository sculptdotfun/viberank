import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Terminal, Gauge, Trophy, DollarSign } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Check Codex Usage: /status, Token Counts & Costs (2026)",
  description:
    "Two commands answer it: /status inside Codex CLI shows how much of your 5-hour and weekly limits you've used, and npx ccusage@latest daily turns your local logs into token counts and real costs.",
  alternates: { canonical: "https://www.viberank.app/blog/codex-token-usage-leaderboard" },
  openGraph: {
    title: "How to Check Codex Usage: /status, Token Counts & Costs (2026)",
    description:
      "Read your Codex CLI logs with ccusage, understand what sessions cost, and rank yourself on the public Codex leaderboard.",
    url: "https://www.viberank.app/blog/codex-token-usage-leaderboard",
    type: "article",
    publishedTime: "2026-07-24T00:00:00.000Z",
    modifiedTime: "2026-08-18T00:00:00.000Z",
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
    title: "How to Check Codex Usage: /status, Token Counts & Costs (2026)",
    description: "Read your Codex CLI logs with ccusage and rank yourself on the public Codex leaderboard.",
    images: ["/api/og?title=Codex%20Token%20Usage&description=Track%20it%2C%20cost%20it%2C%20rank%20it"],
  },
};

const FAQS = [
  {
    q: "How do I check my OpenAI Codex token usage?",
    a: "Two ways: type /status inside a Codex CLI session to see how much of your 5-hour and weekly rate limits you've used, or run npx ccusage@latest daily to parse Codex's local session logs (JSONL under ~/.codex) into per-day token counts and API-equivalent costs.",
  },
  {
    q: "How do I check how many tokens I have left in Codex?",
    a: "Codex doesn't meter you in tokens — it meters percentage of a 5-hour session window and a weekly cap. /status shows the live percentages for both. Reset timestamps and any banked usage credits are on your ChatGPT account's web usage page, not in the CLI.",
  },
  {
    q: "Where do I check my Codex credits?",
    a: "On your ChatGPT/OpenAI account's usage page in the browser. The CLI's /status shows rate-limit percentages only; credit balances and window reset times are web-only for now.",
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
      headline: "How to Check Codex Usage: /status, Token Counts & Costs (2026)",
      description:
        "Check your OpenAI Codex CLI token usage and costs with ccusage, and see how you rank on the public Codex leaderboard.",
      image: "https://www.viberank.app/api/og?title=Codex%20Token%20Usage",
      datePublished: "2026-07-24T00:00:00.000Z",
      dateModified: "2026-08-18T00:00:00.000Z",
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
            How to Check Your Codex Usage: Limits, Tokens & Costs
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
              The short answer: type <code>/status</code> inside Codex CLI to see how much of your 5-hour and
              weekly rate limits you&apos;ve used, and run{" "}
              <span className="font-semibold text-accent">npx ccusage@latest daily</span> in your terminal to turn
              Codex&apos;s local logs into daily token counts and dollar figures. This guide covers both — plus what
              the numbers mean and how to stack yours against the 190+ developers on the{" "}
              <Link href="/tool/codex">public Codex leaderboard</Link>.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Gauge className="w-8 h-8 text-accent" />
            Checking your limits: <code className="text-accent">/status</code>
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Inside any Codex CLI session, type <code>/status</code>. It shows your current position against both
            rate-limit windows — the rolling 5-hour session and the weekly cap — as live percentages. (You need to
            send at least one message in the session first, or there&apos;s no rate-limit state to report.) What it
            doesn&apos;t show: reset timestamps or banked credits — those live on your ChatGPT account&apos;s web
            usage page. And it says nothing about tokens or dollars, which is what the next command is for.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-accent" />
            Checking tokens and costs: ccusage
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
