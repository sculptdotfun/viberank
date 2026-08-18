import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Gauge, Terminal, LineChart, RefreshCcw } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "How to Check Your Claude Code Usage (and Codex, Gemini CLI): /usage, ccusage & Your Real Costs";
const DESC =
  "Three ways to see exactly how much Claude Code you've used — the /usage command for limits, ccusage for token-level history and API-equivalent cost, and the leaderboard that tracks it daily.";
const URL = "https://www.viberank.app/blog/how-to-check-claude-code-usage";
const OG =
  "/api/og?title=How%20to%20Check%20Your%20Claude%20Code%20Usage&description=%2Fusage%2C%20ccusage%2C%20and%20your%20real%20API-equivalent%20costs";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "how to check claude code usage",
    "claude code token usage",
    "claude code usage command",
    "ccusage",
    "ccusage tutorial",
    "claude code cost tracking",
    "check codex usage",
    "check gemini cli usage",
    "ai coding usage tracker",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: "article",
    publishedTime: "2026-08-18T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG] },
};

const FAQS = [
  {
    q: "What's the fastest way to check Claude Code usage?",
    a: "Type /usage inside Claude Code. It shows how much of your 5-hour session and weekly limit you've consumed and when each resets. The same data is at claude.ai/settings/usage.",
  },
  {
    q: "How do I see my Claude Code usage in tokens and dollars?",
    a: "Run npx ccusage@latest daily. It parses Claude Code's local session logs (no account or API key needed) into per-day input/output/cache token counts and API-equivalent USD costs per model. Add --json for machine-readable output.",
  },
  {
    q: "Does ccusage work for OpenAI Codex and Gemini CLI too?",
    a: "Yes. ccusage reads local logs from Claude Code, Codex CLI, Gemini CLI, Copilot CLI, OpenCode and more, and can report each separately or aggregate them — one report across your whole AI toolchain.",
  },
  {
    q: "How do I track my usage over time automatically?",
    a: "Run npx viberank-cli once to put your usage on the public leaderboard, then viberank-cli login and viberank-cli autosubmit to keep it current daily via your OS scheduler. Your profile charts daily spend, tokens, models, and streaks.",
  },
  {
    q: "Is my code or conversation shared when I submit usage?",
    a: "No. ccusage computes totals locally from your logs, and viberank-cli submits only aggregate numbers — tokens, costs, dates, and models. Code and prompts never leave your machine.",
  },
];

export default function Post() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: TITLE,
      description: DESC,
      image: "https://www.viberank.app" + OG,
      datePublished: "2026-08-18T00:00:00.000Z",
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
            How to Check Your Claude Code Usage
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              August 18, 2026
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />7 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              There are three different questions hiding inside &quot;how much Claude Code have I used?&quot; —{" "}
              <em>am I near my limit</em>, <em>what is my usage actually worth in dollars</em>, and{" "}
              <em>is that a lot</em>. Each has its own tool: <code>/usage</code>, <code>ccusage</code>, and the{" "}
              <Link href="/">leaderboard</Link>. This guide covers all three, plus the same tricks for OpenAI Codex
              and Gemini CLI.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Gauge className="w-8 h-8 text-accent" />
            1. <code className="text-accent">/usage</code> — the limits view
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Inside any Claude Code session, type <code>/usage</code>. You get your current consumption against both
            limit layers — the rolling 5-hour session and the weekly cap — with reset times for each. The same
            dashboard lives at <strong>claude.ai/settings/usage</strong> if you&apos;d rather check from a browser.
            This is the view to reach for when you&apos;re rationing your week.
          </p>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            What it doesn&apos;t tell you: tokens, dollars, or history. Percentages of an unstated allowance are
            deliberately opaque — for the real numbers you need to read your own logs. (New to the limits system?{" "}
            <Link href="/blog/claude-code-usage-limits">Start with how the limits actually work</Link>.)
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-accent" />
            2. ccusage — tokens and real dollars
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-4">
            Claude Code writes detailed session logs to your machine. The open-source{" "}
            <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">
              ccusage
            </a>{" "}
            CLI parses them locally — no account, no API key:
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-2">
            <p className="m-0">
              <code className="text-accent font-mono">npx ccusage@latest daily</code>
              <span className="text-muted text-sm"> — per-day tokens and API-equivalent cost</span>
            </p>
            <p className="m-0">
              <code className="text-accent font-mono">npx ccusage@latest monthly</code>
              <span className="text-muted text-sm"> — monthly rollup, great for &quot;what would API billing cost me?&quot;</span>
            </p>
            <p className="m-0">
              <code className="text-accent font-mono">npx ccusage@latest blocks --live</code>
              <span className="text-muted text-sm"> — live dashboard of your current 5-hour block</span>
            </p>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The killer column is <strong>API-equivalent cost</strong>: what your usage would have cost at
            pay-as-you-go prices. That number is how you know whether your subscription is a rounding error or a
            10x bargain. Two caveats worth knowing: most tokens are prompt-cache reads (on{" "}
            <Link href="/stats">Viberank&apos;s 11T+ tracked tokens</Link>, about 95%), which cost roughly a tenth
            of normal input — so big token counts overstate cost. And ccusage reads whatever logs exist locally, so
            a wiped machine means lost history.
          </p>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The same command covers your other agents: ccusage reads local logs from{" "}
            <Link href="/tool/codex">Codex CLI</Link>, <Link href="/tool/gemini">Gemini CLI</Link>,{" "}
            <Link href="/tool/copilot">Copilot CLI</Link>, and <Link href="/tool/opencode">OpenCode</Link> too, and
            aggregates them into one report. Codex users:{" "}
            <Link href="/blog/codex-token-usage-leaderboard">we wrote up the Codex specifics separately</Link>.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <LineChart className="w-8 h-8 text-accent" />
            3. Viberank — history, charts, and context
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-4">
            ccusage answers &quot;what did I use?&quot; — the leaderboard answers &quot;<em>is that a lot?</em>&quot;
            One command:
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx viberank-cli</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            It runs ccusage across all your detected tools and submits the totals (never code or prompts) to{" "}
            <Link href="/">viberank.app</Link>. Your profile gets a GitHub-style activity heatmap, daily spend and
            token charts, per-model and per-tool breakdowns, and a global rank across 1,100+ developers. For
            calibration: <Link href="/blog/how-much-does-claude-code-cost">the data says</Link> typical active users
            burn hundreds of dollars of API-equivalent value per month, and the heavy tail goes far beyond that.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <RefreshCcw className="w-8 h-8 text-accent" />
            Keep it current automatically
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-4">
            A one-off check goes stale the day you run it. Two commands make tracking permanent:
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-2">
            <p className="m-0">
              <code className="text-accent font-mono">npx viberank-cli login</code>
              <span className="text-muted text-sm"> — paste a token from viberank.app/settings/tokens</span>
            </p>
            <p className="m-0">
              <code className="text-accent font-mono">npx viberank-cli autosubmit</code>
              <span className="text-muted text-sm"> — daily submission via launchd / systemd / Task Scheduler</span>
            </p>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            From there your usage history builds itself — and when you&apos;re deciding whether to upgrade plans,{" "}
            <Link href="/calculator">the calculator</Link> can answer with your real numbers instead of a guess.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Checking usage FAQ</h2>
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
