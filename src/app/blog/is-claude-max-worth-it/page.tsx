import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Scale, DollarSign, Calculator, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "Is Claude Max Worth It? Pro vs Max 5x vs Max 20x (2026)";
const DESC =
  "Stop guessing which Claude plan you need. Compare Pro ($20), Max 5x ($100), and Max 20x ($200) against your real API-equivalent usage — with benchmarks from 1,100+ developers on the Viberank leaderboard.";
const URL = "https://www.viberank.app/blog/is-claude-max-worth-it";
const OG =
  "/api/og?title=Is%20Claude%20Max%20Worth%20It%3F&description=Pro%20vs%20Max%2C%20decided%20with%20your%20own%20usage%20data";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "is claude max worth it",
    "claude pro vs max",
    "claude max 5x vs 20x",
    "claude max price",
    "claude code subscription",
    "claude pro limits",
    "claude max worth it reddit",
    "claude plan comparison",
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
    q: "What's the difference between Claude Pro, Max 5x, and Max 20x?",
    a: "All three include Claude Code and the Claude apps under the same two-layer limit system (rolling 5-hour sessions plus a weekly cap). Pro is $20/mo with the base allowance; Max 5x ($100/mo) is roughly five times Pro's usage; Max 20x ($200/mo) roughly twenty times. Higher tiers also get priority access during peak load.",
  },
  {
    q: "Is Claude Max worth $100 or $200 a month?",
    a: "It's arithmetic, not opinion: run npx ccusage@latest monthly and read your API-equivalent cost. If your monthly equivalent usage is a few hundred dollars or more — true for most active developers on the Viberank leaderboard — Max costs less than the API usage it replaces. If you're under ~$100/month equivalent, Pro plus occasional usage credits is usually the better deal.",
  },
  {
    q: "When should I stay on the API instead of a subscription?",
    a: "If your usage is spiky (heavy one week, silent for three), automated/CI-driven, or shared across a team billing one org key, pay-as-you-go API billing can beat a flat plan — you pay for exactly what you use and never hit weekly caps.",
  },
  {
    q: "What happens if I hit limits even on Max?",
    a: "Max 20x users do hit weekly caps — the leaderboard's heavy tail shows thousands of dollars of monthly API-equivalent usage. Options: enable usage credits to continue at standard API rates, offload overflow work to an API key, or spread heavy agentic runs across the weekly reset.",
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
          <h1 className="text-5xl font-bold text-foreground mb-4 leading-tight">Is Claude Max Worth It?</h1>

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
              &quot;Is Max worth it?&quot; is usually asked as a vibes question. It has an arithmetic answer: your
              usage has a precise API-equivalent dollar value, sitting in your local logs right now. If that number
              beats the subscription price, the plan is an arbitrage; if not, it&apos;s a donation. Here&apos;s how
              to run the math in two minutes — and what 1,100+ developers&apos; real numbers say about where the
              breakeven sits.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Scale className="w-8 h-8 text-accent" />
            The three plans in one paragraph
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            <strong>Pro ($20/mo)</strong>, <strong>Max 5x ($100/mo)</strong>, and <strong>Max 20x ($200/mo)</strong>{" "}
            all include Claude Code and the Claude apps under the same{" "}
            <Link href="/blog/claude-code-usage-limits">two-layer limit system</Link> — a rolling 5-hour session
            allowance and a weekly cap. The multipliers are the product: Max 5x buys roughly five times Pro&apos;s
            usage, Max 20x roughly twenty, plus priority during peak load. All three can enable{" "}
            <strong>usage credits</strong> to keep working past included limits at standard API rates — which means
            the real question isn&apos;t &quot;which plan lets me work?&quot; but &quot;which plan makes my usage
            cheapest?&quot;
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-accent" />
            Step 1: find your real number
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx ccusage@latest monthly</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            This reads Claude Code&apos;s local logs and prints what each month of your usage{" "}
            <em>would have cost at API prices</em>. No account needed, nothing leaves your machine.
            (<Link href="/blog/how-to-check-claude-code-usage">Full guide to checking usage here</Link>.) The rule
            of thumb once you have it:
          </p>
          <ul className="text-foreground text-lg leading-relaxed mb-6 space-y-3">
            <li>
              <strong>Under ~$100/mo equivalent</strong> — Pro, with usage credits absorbing the occasional heavy
              week.
            </li>
            <li>
              <strong>~$100–$500/mo equivalent</strong> — Max 5x already costs less than your usage is worth; limits
              stop being a weekly anxiety.
            </li>
            <li>
              <strong>$500+/mo equivalent</strong> — Max 20x is the obvious buy; at API prices you&apos;d pay several
              times its sticker.
            </li>
          </ul>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Or skip the rule of thumb entirely: <Link href="/calculator">the Viberank calculator</Link> takes your
            actual ccusage output and tells you which tier your usage justifies.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-accent" />
            Step 2: sanity-check against real developers
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            The striking thing in <Link href="/stats">Viberank&apos;s data</Link> — $10M+ of tracked API-equivalent
            spend across 1,100+ developers — is how quickly agentic workflows blow past Pro-sized usage. Most{" "}
            <em>active</em> developers on the board clear hundreds of dollars of monthly equivalent usage, and the
            heavy tail runs to thousands;{" "}
            <Link href="/blog/state-of-ai-coding-2026">the top 10% account for about half of all tracked spend</Link>.
            For that population, Max isn&apos;t an indulgence — it&apos;s the cheapest way to buy the usage
            they&apos;re already consuming. That&apos;s also exactly why{" "}
            <Link href="/blog/claude-code-usage-limits">weekly caps exist</Link>.
          </p>
          <div className="bg-card border-l-4 border-accent p-6 my-8">
            <p className="text-stone-200 m-0">
              Two honest exceptions: spiky usage (one intense week a month) and automation-heavy workflows often
              price out better on pay-as-you-go API billing, which has no session or weekly caps. And if your
              equivalent usage is genuinely under $20/mo, no subscription math will save you — you&apos;re fine.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-accent" />
            Step 3: decide once, then track it
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-4">
            Usage drifts — a new agentic workflow can triple your burn in a month. Put your numbers on the board and
            the decision stays current:
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <code className="text-accent font-mono">npx viberank-cli</code>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Your <Link href="/tool/claude">profile</Link> charts daily spend and rank against everyone else shipping
            with the same tools — and if the bill itself is the problem,{" "}
            <Link href="/blog/reduce-ai-coding-costs">here&apos;s how to shrink it</Link> without slowing down.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6">Claude Max FAQ</h2>
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
