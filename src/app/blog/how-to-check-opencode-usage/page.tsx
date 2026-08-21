import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Terminal, FolderOpen, DollarSign, Trophy } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "How to Check OpenCode Usage: Tokens, Costs & Stats (2026)";
const DESC =
  "OpenCode has no built-in usage meter, but one command fixes that: npx ccusage@latest daily reads OpenCode's local session logs into per-day token counts and real API costs. Here's how, plus dashboards and the public leaderboard.";
const URL = "https://www.viberank.app/blog/how-to-check-opencode-usage";
const OG =
  "/api/og?title=How%20to%20Check%20OpenCode%20Usage&description=Tokens%2C%20costs%20%26%20session%20stats%20from%20your%20local%20logs";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "opencode check usage",
    "how to check opencode usage",
    "opencode token usage",
    "opencode cost tracking",
    "opencode usage stats",
    "check opencode token usage",
    "opencode ccusage",
    "opencode leaderboard",
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
    q: "How do I check my OpenCode token usage?",
    a: "Run npx ccusage@latest daily in your terminal. It reads OpenCode's local session storage (~/.local/share/opencode/storage/message/) and reports per-day token counts and estimated costs, alongside any other coding agents you use. OpenCode core has no built-in usage command.",
  },
  {
    q: "Does OpenCode have a built-in /usage or /status command?",
    a: "No — unlike Claude Code's /usage or Codex's /status, OpenCode core doesn't ship a usage meter. Community options fill the gap: the ccusage CLI for daily/monthly reports, the opencode-stats terminal dashboard, and the TokenScope plugin for per-session breakdowns.",
  },
  {
    q: "How is OpenCode cost calculated?",
    a: "From token counts times model list prices (ccusage uses LiteLLM's pricing data). Because OpenCode is bring-your-own-provider, this is close to your real bill if you pay per token with an API key — or an API-equivalent value if you route through a Claude or ChatGPT subscription.",
  },
  {
    q: "Is there an OpenCode leaderboard?",
    a: "Yes — Viberank tracks OpenCode usage submitted by developers via ccusage, with a dedicated board at viberank.app/tool/opencode. Run npx viberank-cli to add yours; only usage totals are submitted, never code or prompts.",
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
            How to Check Your OpenCode Usage
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              August 18, 2026
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />5 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              The short answer: OpenCode core has <strong>no built-in usage command</strong> — but it logs every
              session locally, and <span className="font-semibold text-accent">npx ccusage@latest daily</span> turns
              those logs into per-day token counts and costs in one command. Here&apos;s that route, the dashboard
              alternatives, and how to see where your burn ranks.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-accent" />
            The one-command answer: ccusage
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-2">
            <div>
              <code className="text-accent font-mono">npx ccusage@latest daily</code>
              <span className="text-muted text-sm ml-3"># per-day tokens + cost, OpenCode included</span>
            </div>
            <div>
              <code className="text-accent font-mono">npx ccusage@latest monthly</code>
              <span className="text-muted text-sm ml-3"># monthly rollup</span>
            </div>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">
              ccusage
            </a>{" "}
            reads OpenCode&apos;s session storage and computes tokens and costs from model list prices (via
            LiteLLM&apos;s pricing data), with subagent sessions included. Nothing is uploaded — it&apos;s all
            computed from your local files. And because the same command covers{" "}
            <Link href="/tool/claude">Claude Code</Link>, <Link href="/tool/codex">Codex</Link>,{" "}
            <Link href="/tool/gemini">Gemini CLI</Link> and <Link href="/tool/copilot">Copilot</Link>, you get one
            combined report across your whole agent stack.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-accent" />
            Where OpenCode keeps the data
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            OpenCode writes message-level records — model identifiers and per-turn input/output token usage — under{" "}
            <code>~/.local/share/opencode/storage/message/</code>. That&apos;s what ccusage parses. It also means
            your usage history lives (and dies) with that directory: wipe the machine, lose the history — one more
            reason to snapshot it somewhere (below).
          </p>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Prefer a live view over a report? Two community tools read the same data: the{" "}
            <a href="https://github.com/Cateds/opencode-stats" target="_blank" rel="noopener noreferrer">
              opencode-stats
            </a>{" "}
            terminal dashboard (totals, models, activity heatmap) and the{" "}
            <a href="https://github.com/ramtinJ95/opencode-tokenscope" target="_blank" rel="noopener noreferrer">
              TokenScope plugin
            </a>
            , which adds a <code>/tokenscope</code> command inside OpenCode for per-session breakdowns.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-accent" />
            Why cost tracking matters more on OpenCode
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            OpenCode is bring-your-own-provider. If you plug in an API key, the ccusage number is close to your{" "}
            <em>actual bill</em> — not the theoretical &quot;API-equivalent&quot; figure subscription users see. If
            you route through a Claude or ChatGPT plan instead, the number tells you what that plan is saving you.
            Either way, agentic sessions resend context every turn, so token counts look enormous; on{" "}
            <Link href="/stats">Viberank&apos;s 11T+ tracked tokens</Link>, ~95% are cheap prompt-cache reads, which
            is why a scary token count usually maps to a much smaller bill.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-accent" />
            Rank it: the OpenCode leaderboard
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-4">
            Once you can measure it, the next question is &quot;is that a lot?&quot; One command puts your totals on
            the <Link href="/tool/opencode">public OpenCode leaderboard</Link> — code and prompts never leave your
            machine:
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx viberank-cli</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Your profile charts daily spend, tokens, models, and streaks across every tool ccusage tracks — and it
            doubles as the off-machine snapshot of your usage history. Curious how OpenCode stacks up against the
            big agents? See <Link href="/compare/claude-vs-opencode">Claude Code vs OpenCode</Link> or{" "}
            <Link href="/compare/codex-vs-opencode">Codex vs OpenCode</Link> on live data.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">OpenCode usage FAQ</h2>
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
