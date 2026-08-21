import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Timer, CalendarClock, Gauge, Wrench, CreditCard } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "Claude Code Usage Limits: 5-Hour & Weekly Caps (2026)";
const DESC =
  "How Claude Code's rolling 5-hour session limit and weekly cap actually work in 2026, how to check where you stand with /usage and ccusage, and your options when you hit the wall.";
const URL = "https://www.viberank.app/blog/claude-code-usage-limits";
const OG =
  "/api/og?title=Claude%20Code%20Usage%20Limits%20Explained&description=5-hour%20sessions%2C%20weekly%20caps%2C%20and%20what%20to%20do%20when%20you%20hit%20them";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "claude code usage limits",
    "claude weekly limit",
    "claude code limit reset",
    "claude 5 hour limit",
    "claude code rate limit",
    "hit claude code limit",
    "claude pro limits",
    "claude max limits",
    "check claude code usage",
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
    q: "What are Claude Code's usage limits in 2026?",
    a: "Two layers: a rolling 5-hour session limit and a weekly cap on top, both shared across Claude Code and the Claude apps. Anthropic permanently doubled the 5-hour limits for Pro, Max, Team, and Enterprise plans in May 2026; the weekly caps stayed put. Exact allowances scale with your plan — Pro ($20/mo), Max 5x ($100/mo), or Max 20x ($200/mo).",
  },
  {
    q: "How do I check my Claude Code usage against the limits?",
    a: "Run /usage inside Claude Code — it shows your current session and weekly consumption and when each resets. The same view lives at claude.ai/settings/usage. For token-level history and API-equivalent cost, run npx ccusage@latest daily, which reads your local session logs.",
  },
  {
    q: "When does the Claude weekly limit reset?",
    a: "At a fixed time each week assigned to your account — it does not roll with your usage the way the 5-hour session window does. /usage shows your exact reset time.",
  },
  {
    q: "How do I keep working after hitting a Claude Code limit?",
    a: "Wait for the reset, enable usage credits (pay-as-you-go at standard API rates once your included limit runs out), switch that session to an API key, or upgrade your plan. Before upgrading, check your real usage — the Viberank calculator tells you which tier your actual consumption justifies.",
  },
  {
    q: "Do Claude Code limits apply if I pay with an API key?",
    a: "Subscription session and weekly caps don't apply to API billing — you pay per token against your organization's API rate limits instead. Heavy users on the Viberank leaderboard routinely consume thousands of dollars of API-equivalent usage per month on a $100–$200 subscription, which is why hitting subscription limits is so common.",
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
            Claude Code Usage Limits, Explained
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              August 18, 2026
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />8 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              You&apos;re mid-refactor and Claude Code stops: limit reached. If that&apos;s why you&apos;re here,
              the short version: there are <strong>two limits stacked on top of each other</strong> — a rolling
              5-hour session window and a weekly cap — and <code>/usage</code> shows exactly where you stand on
              both. Here&apos;s how the system works in 2026, how to see your real consumption, and every option
              you have when you hit the wall.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Timer className="w-8 h-8 text-accent" />
            Limit one: the rolling 5-hour session
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Every message you send starts or joins a 5-hour window. Your plan includes a certain amount of usage per
            window, shared across Claude Code, claude.ai, and the desktop and mobile apps. When the window expires, a
            fresh one starts with your next message — so &quot;wait for the reset&quot; is never more than a few
            hours away. In May 2026 Anthropic <strong>permanently doubled</strong> the 5-hour limits on Pro, Max,
            Team, and seat-based Enterprise plans, which moved the everyday pain from session limits to the weekly
            cap.
          </p>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            How much a session &quot;costs&quot; depends heavily on what you do with it: model choice, codebase
            size, and how much context each request drags along. The same hour of work can consume wildly different
            amounts of your allowance — which is why measuring your own usage (below) beats rules of thumb.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <CalendarClock className="w-8 h-8 text-accent" />
            Limit two: the weekly cap
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            On top of sessions sits a weekly limit covering all your usage across all models. Unlike the session
            window, the weekly reset is <strong>fixed, not rolling</strong> — it resets at a set time each week
            assigned to your account, whether you&apos;ve been coding or not. This is the limit heavy users actually
            plan around: burn hard early in your week and no amount of session discipline gets it back before the
            reset.
          </p>
          <div className="bg-card border-l-4 border-accent p-6 my-8">
            <p className="text-stone-200 m-0">
              Anthropic introduced weekly caps in mid-2025 after a wave of always-on agent loops, and has adjusted
              them since — including a temporary 50% boost in mid-2026. Treat exact allowances as a moving target;
              treat <code>/usage</code> as the source of truth for your account.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Gauge className="w-8 h-8 text-accent" />
            Checking where you stand
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-4">Three tools, three different questions:</p>
          <ul className="text-foreground text-lg leading-relaxed mb-6 space-y-3">
            <li>
              <strong><code>/usage</code> in Claude Code</strong> (or claude.ai/settings/usage) — am I about to hit
              a limit, and when does it reset? This is the official percent-used view of both the session and the
              week.
            </li>
            <li>
              <strong><code>npx ccusage@latest daily</code></strong> — what am I actually consuming? It reads your
              local session logs and computes per-day tokens and API-equivalent USD cost, per model. This is the
              number that tells you whether your subscription is a bargain.{" "}
              <Link href="/blog/how-to-check-claude-code-usage">Full guide here</Link>.
            </li>
            <li>
              <strong><code>npx viberank-cli</code></strong> — is my usage normal? It submits your ccusage totals to
              the <Link href="/">public leaderboard</Link>, where you can compare against 1,100+ developers.{" "}
              <Link href="/blog/how-much-does-claude-code-cost">Median heavy users</Link> burn far more than most
              people guess.
            </li>
          </ul>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            One number from the board worth knowing: across{" "}
            <Link href="/stats">11+ trillion tracked tokens</Link>, about 95% are prompt-cache reads that cost
            roughly a tenth of normal input tokens. A scary token count in ccusage usually maps to a much smaller
            real cost — and to less limit pressure than you&apos;d fear.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-accent" />
            Hit the limit? Your options, in order
          </h2>
          <ol className="text-foreground text-lg leading-relaxed mb-6 space-y-3 list-decimal pl-6">
            <li>
              <strong>Wait it out.</strong> Session windows refresh within hours; <code>/usage</code> shows your
              weekly reset time.
            </li>
            <li>
              <strong>Burn less per task.</strong> Route routine work to smaller models, keep context lean, start
              fresh conversations instead of dragging 100k-token histories.{" "}
              <Link href="/blog/reduce-ai-coding-costs">Nine concrete tactics here</Link> — the same habits that cut
              API bills stretch subscription limits.
            </li>
            <li>
              <strong>Enable usage credits.</strong> Pro and Max plans can keep working past the included limit at
              standard API rates, billed pay-as-you-go — no plan change required.
            </li>
            <li>
              <strong>Switch to an API key for the overflow.</strong> API billing has no session or weekly caps,
              just per-token pricing and org rate limits.
            </li>
            <li>
              <strong>Upgrade — but check the math first.</strong> Max 5x ($100/mo) and Max 20x ($200/mo) multiply
              your limits, and for heavy users they&apos;re dramatically cheaper than equivalent API usage. Whether{" "}
              <em>you&apos;re</em> a heavy user is an empirical question:{" "}
              <Link href="/calculator">drop your ccusage numbers into the calculator</Link> and see which tier your
              actual usage justifies, or read{" "}
              <Link href="/blog/is-claude-max-worth-it">our full Pro vs Max breakdown</Link>.
            </li>
          </ol>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-accent" />
            The subscription arbitrage, quantified
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Limits exist because flat-rate plans are a genuine arbitrage. On the{" "}
            <Link href="/tool/claude">Claude Code leaderboard</Link>, developers routinely show thousands of dollars
            of API-equivalent usage per month on a $100–$200 subscription — the top of the board is past{" "}
            <em>six figures</em> in tracked equivalent spend. If you keep slamming into weekly caps, you&apos;re
            almost certainly in the population for whom Max pays for itself many times over.
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx viberank-cli</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            One command puts your real numbers on the board — your code and prompts never leave your machine, only
            usage totals do.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Claude Code limits FAQ</h2>
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
