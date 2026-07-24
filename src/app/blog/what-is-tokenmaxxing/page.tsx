import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Flame, Building2, Scale, Trophy, Terminal } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What Is Tokenmaxxing? Inside the AI Token Leaderboard Craze (2026)",
  description:
    "Tokenmaxxing is racking up AI token usage to climb a leaderboard — the trend behind Meta's Claudeonomics, Uber's blown AI budget, and public boards like Viberank. What it means, where it went wrong, and how to measure yours.",
  alternates: { canonical: "https://www.viberank.app/blog/what-is-tokenmaxxing" },
  openGraph: {
    title: "What Is Tokenmaxxing? Inside the AI Token Leaderboard Craze",
    description:
      "The trend behind Meta's Claudeonomics and Uber's blown AI budget — and the public leaderboard where 1,000+ developers track $6.6M of real usage.",
    url: "https://www.viberank.app/blog/what-is-tokenmaxxing",
    type: "article",
    publishedTime: "2026-07-24T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [
      {
        url: "/api/og?title=What%20Is%20Tokenmaxxing%3F&description=Inside%20the%20AI%20Token%20Leaderboard%20Craze",
        width: 1200,
        height: 630,
        alt: "What Is Tokenmaxxing?",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is Tokenmaxxing? Inside the AI Token Leaderboard Craze",
    description:
      "The trend behind Meta's Claudeonomics and Uber's blown AI budget — and the public board where devs track real usage.",
    images: ["/api/og?title=What%20Is%20Tokenmaxxing%3F&description=Inside%20the%20AI%20Token%20Leaderboard%20Craze"],
  },
};

const FAQS = [
  {
    q: "What does tokenmaxxing mean?",
    a: "Tokenmaxxing is deliberately maximizing your AI token consumption — usually to climb a usage leaderboard. The word follows the '-maxxing' slang pattern and took off in 2026 when companies like Meta and Uber ran internal AI usage leaderboards.",
  },
  {
    q: "Is tokenmaxxing bad?",
    a: "Raw token count is a terrible target but a useful signal. Internal leaderboards that paid people to burn tokens backfired; public boards where developers voluntarily track real spend are closer to a fitness tracker than a KPI. Judge output, not tokens — but knowing your number beats guessing.",
  },
  {
    q: "How do I see my own token usage?",
    a: "If you use Claude Code, OpenAI Codex, Gemini CLI or similar agents, run npx ccusage@latest daily to read your local logs, or npx viberank-cli to compute it and rank yourself on the public Viberank leaderboard.",
  },
  {
    q: "What counts as heavy AI usage in 2026?",
    a: "On Viberank, crossing about $1,000 in API-equivalent spend puts you in the Flame tier; $15,000+ is Inferno, and $50,000+ is Supernova. The median active developer burns tens of millions of tokens per day, most of it cache reads.",
  },
];

export default function WhatIsTokenmaxxing() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "What Is Tokenmaxxing? Inside the AI Token Leaderboard Craze (2026)",
      description:
        "Tokenmaxxing is racking up AI token usage to climb a leaderboard — the trend behind Meta's Claudeonomics, Uber's blown AI budget, and public boards like Viberank.",
      image: "https://www.viberank.app/api/og?title=What%20Is%20Tokenmaxxing%3F",
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
            What Is Tokenmaxxing? Inside the AI Token Leaderboard Craze
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              July 24, 2026
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              7 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              <span className="font-semibold text-accent">Tokenmaxxing</span> is deliberately running up your AI
              token usage — usually to climb a leaderboard. In 2026 it went from an inside joke among{" "}
              <Link href="/blog/vibe-coding-revolution">vibe coders</Link> to a corporate phenomenon big enough to
              get its own Wikipedia entry, wreck at least one company&apos;s AI budget, and get Meta&apos;s internal
              leaderboard shut down. Here&apos;s where the term came from, why the corporate version failed, and how
              developers measure it for real.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Flame className="w-8 h-8 text-accent" />
            Where the word comes from
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The suffix does the work: like every other &quot;-maxxing&quot;, tokenmaxxing means optimizing one number
            as hard as you can — in this case, the tokens your AI coding agents chew through. A token is the unit
            LLM providers bill by; a heavy Claude Code or OpenAI Codex user can push hundreds of millions of them in
            a day once you count prompt-cache reads. When companies started publishing usage leaderboards to push AI
            adoption, employees did what leaderboards make people do: they maxxed the metric.
          </p>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The term spread through developer media in mid-2026 — the{" "}
            <a href="https://blog.pragmaticengineer.com/the-pulse-tokenmaxxing-as-a-weird-new-trend/" target="_blank" rel="noopener noreferrer">
              Pragmatic Engineer
            </a>{" "}
            called it &quot;a weird new trend,&quot;{" "}
            <a href="https://www.cio.com/article/4178320/tokenmaxxing-when-ai-adoption-metrics-go-bad.html" target="_blank" rel="noopener noreferrer">
              CIO
            </a>{" "}
            filed it under &quot;AI adoption metrics gone bad,&quot; and{" "}
            <a href="https://leaddev.com/ai/tokenmaxxing-and-the-search-for-ai-metrics-that-matter" target="_blank" rel="noopener noreferrer">
              LeadDev
            </a>{" "}
            used it as the poster child for measuring the wrong thing.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-accent" />
            The corporate leaderboard saga
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The reported numbers are staggering. Meta&apos;s internal board — nicknamed
            &quot;Claudeonomics&quot; — aggregated AI usage across more than 85,000 employees, ranked a top 250, and
            handed out tiers like &quot;Token Legend.&quot; In one 30-day stretch Meta employees reportedly burned{" "}
            <strong>60.2 trillion tokens</strong> — roughly $900M at list API prices. One Disney employee logged
            460,000 Claude interactions in nine days. Uber incentivized AI adoption through an internal leaderboard
            and burned through its entire 2026 AI budget in four months.
          </p>
          <div className="bg-card border-l-4 border-accent p-6 my-8">
            <p className="text-stone-200 m-0">
              The pattern is Goodhart&apos;s law on fast-forward: the moment token count became a target, it stopped
              measuring anything. People routed trivial tasks through frontier models, looped agents overnight, and
              optimized for the scoreboard instead of shipped software. Meta abolished its leaderboard after the
              backlash.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Scale className="w-8 h-8 text-accent" />
            So is tracking tokens pointless? No — targets are the problem
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            There&apos;s a difference between a mandated KPI and a fitness tracker. Nobody at Viberank gets a bonus
            for burning tokens; developers submit their own <code>ccusage</code> data because knowing your real
            number beats guessing. The data is genuinely useful: it tells you what your workflow costs at API
            prices (and therefore what your subscription is actually worth), which models eat your budget, and how
            your usage compares to other people shipping with the same tools.
          </p>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            It also punctures some myths. Across the{" "}
            <Link href="/stats">7.3 trillion tokens tracked on Viberank</Link>, about 95% are prompt-cache reads —
            tokens that cost roughly a tenth of the normal input price. A terrifying-looking token count usually
            translates to a much smaller bill, which is exactly the kind of thing you only learn by measuring.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-accent" />
            The public tokenmaxxing leaderboard
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            <Link href="/">Viberank</Link> is the opt-in, public version of the thing Meta tried to run internally:
            1,000+ developers ranked by real, validated usage across{" "}
            <Link href="/tool/claude">Claude Code</Link>, <Link href="/tool/codex">OpenAI Codex</Link>,{" "}
            <Link href="/tool/gemini">Gemini CLI</Link>, <Link href="/tool/copilot">Copilot</Link> and every other
            agent ccusage tracks — $6.6M in API-equivalent spend and counting. Spend earns a tier: Spark, Ember,
            Flame ($1K+), Blaze ($5K+), Inferno ($15K+), Supernova ($50K+). Submissions are sanity-checked
            server-side (token math, cost-per-token ratio bounds, date checks), and GitHub sign-in gets you a
            verified badge.
          </p>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Every profile shows a GitHub-style activity heatmap, per-model spend, and daily streaks — a
            scoreboard for the metric, plus the context that makes it honest.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-accent" />
            Measure your own tokenmaxxing
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-4">One command, read from your local logs:</p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx viberank-cli</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            It runs ccusage over Claude Code, Codex, Gemini CLI and friends, sums your real usage, and puts you on
            the board. Your code and prompts never leave your machine — only the usage totals do. Curious what
            normal looks like first? Start with{" "}
            <Link href="/blog/how-much-does-claude-code-cost">what Claude Code actually costs</Link> or the{" "}
            <Link href="/blog/state-of-ai-coding-2026">State of AI Coding Spend 2026</Link>.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Tokenmaxxing FAQ</h2>
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
