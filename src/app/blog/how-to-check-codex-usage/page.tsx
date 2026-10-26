import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Terminal, Gauge, Trophy, DollarSign } from "lucide-react";
import type { Metadata } from "next";

// "codex usage" (12K/mo) is answered first by OpenAI's own dashboard, so the
// page opens with where it is, then what we add on top. Figures below were
// verified against OpenAI's pages on 2026-10-13.
//
// Search Console, 28 days to 2026-10-26: 29.8K impressions at position 4.2 and
// 0.7% CTR; "codex usage dashboard" sat at 3.8 with 0.3%, and "check codex
// usage" never got a click. The title leads with the how-to the queries ask,
// adds limits, and promises both answers; the description gives them.
const TITLE = "How to Check Codex Usage & Limits: Dashboard + /status (2026)";
const DESC =
  "The Codex usage dashboard is chatgpt.com/codex/settings/usage. In the CLI, type /status for your 5-hour and weekly limits, /usage for tokens, ccusage for cost.";
const MODIFIED = "2026-10-26T00:00:00.000Z";
const DASHBOARD_URL = "https://chatgpt.com/codex/settings/usage";
const LIMITS_SOURCE = "https://learn.chatgpt.com/docs/pricing";
const OG =
  "/api/og?title=How%20to%20Check%20Codex%20Usage%20%26%20Limits&description=The%20dashboard%2C%20%2Fstatus%2C%20%2Fusage%20and%20real%20cost";

const PLUS_LIMITS = [
  { model: "GPT-6 Astra", messages: "5–45" },
  { model: "GPT-6.1 Sol", messages: "15–160" },
  { model: "GPT-6 Sol", messages: "15–150" },
  { model: "GPT-6 Luna", messages: "350–3,000" },
] as const;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "codex usage",
    "codex usage dashboard",
    "check codex usage",
    "how to check codex usage",
    "codex usage limit",
    "codex token usage",
  ],
  alternates: { canonical: "https://www.viberank.app/blog/how-to-check-codex-usage" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://www.viberank.app/blog/how-to-check-codex-usage",
    type: "article",
    publishedTime: "2026-07-24T00:00:00.000Z",
    modifiedTime: MODIFIED,
    authors: ["Viberank Team"],
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: [OG],
  },
};

const FAQS = [
  {
    q: "Where is the Codex usage dashboard?",
    a: "At chatgpt.com/codex/settings/usage. It shows your current Codex limits and when they reset. Inside an active Codex CLI session, /status shows your remaining limits too.",
  },
  {
    q: "What are the Codex usage limits?",
    a: "On Plus and Standard Business seats, OpenAI estimates local messages per five-hour window by model: GPT-6 Astra 5–45, GPT-6.1 Sol 15–160, GPT-6 Sol 15–150, GPT-6 Luna 350–3,000. Weekly limits may also apply. Pro plans currently have no five-hour limit.",
  },
  {
    q: "How do I check my OpenAI Codex token usage?",
    a: "Three ways. Type /usage inside a Codex CLI session (v0.140.0 and later) for lifetime tokens, peak day, streak and a daily activity heatmap. Type /status for how much of your 5-hour and weekly rate limits you've used. Or run npx ccusage@latest daily to parse Codex's local session logs (JSONL under ~/.codex) into per-day token counts and API-equivalent dollar costs across every agent you use.",
  },
  {
    q: "How do I check how many tokens I have left in Codex?",
    a: "Both views exist now. /usage reports your actual token totals — lifetime, peak day, streak — while /status reports how much of the 5-hour session window and weekly cap you have consumed, as percentages. Reset times and credits are in the Codex usage dashboard at chatgpt.com/codex/settings/usage.",
  },
  {
    q: "Where do I check my Codex credits?",
    a: "In the Codex usage dashboard at chatgpt.com/codex/settings/usage. In the CLI, /status shows rate-limit percentages and /usage shows token activity; credit balances and window reset times remain web-only.",
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
      headline: TITLE,
      description: DESC,
      image: "https://www.viberank.app" + OG,
      datePublished: "2026-07-24T00:00:00.000Z",
      dateModified: MODIFIED,
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
            Codex Usage: Dashboard, /status, Limits &amp; Real Costs
          </h1>

          <div className="flex items-center gap-6 text-sm text-muted mb-8">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Updated October 26, 2026
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              6 min read
            </span>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <p className="text-lg text-foreground m-0">
              Your Codex usage lives in the official{" "}
              <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
                Codex usage dashboard
              </a>{" "}
              at <code>chatgpt.com/codex/settings/usage</code>: current limits and when they reset. In the CLI,
              type <code>/status</code> for your remaining 5-hour and weekly limits, or <code>/usage</code>{" "}
              (v0.140.0+) for token activity. For costs in dollars, run{" "}
              <span className="font-semibold text-accent">npx ccusage@latest daily</span>. This guide covers all
              of it, the <a href="#codex-usage-limits">Codex usage limits</a> per plan, and how to stack yours
              against the developers on the <Link href="/tool/codex">public Codex leaderboard</Link>.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-accent" />
            Checking your tokens: <code className="text-accent">/usage</code>
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Codex CLI v0.140.0 added a <code>/usage</code> command, and it&apos;s now the fastest answer to
            &ldquo;how many tokens have I burned&rdquo;. Launch the TUI with <code>codex</code>, type{" "}
            <code>/usage</code> in the composer, and press Enter. You get four headline numbers — lifetime tokens,
            your peak day, your current streak with its best record, and your longest single task — above a
            GitHub-style contribution heatmap.
          </p>
          <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-2">
            <div>
              <code className="text-accent font-mono">/usage daily</code>
              <span className="text-muted text-sm ml-3"># 7&times;52 heatmap, contribution-graph style</span>
            </div>
            <div>
              <code className="text-accent font-mono">/usage weekly</code>
              <span className="text-muted text-sm ml-3"># weekly bar chart</span>
            </div>
            <div>
              <code className="text-accent font-mono">/usage cumulative</code>
              <span className="text-muted text-sm ml-3"># cumulative bars</span>
            </div>
          </div>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            What <code>/usage</code> still doesn&apos;t give you is <em>money</em>. It counts tokens, not
            API-equivalent dollars, and it only knows the machine it&apos;s running on. For cost, and for a
            combined view across every agent you use, you still want ccusage below.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Gauge className="w-8 h-8 text-accent" />
            Checking your limits: <code className="text-accent">/status</code>
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Inside any Codex CLI session, type <code>/status</code>. It shows your current position against both
            rate-limit windows — the rolling 5-hour session and the weekly cap — as live percentages. (You need to
            send at least one message in the session first, or there&apos;s no rate-limit state to report.) What it
            doesn&apos;t show: reset timestamps or banked credits — those live in the{" "}
            <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
              web usage dashboard
            </a>. And it says nothing about dollars, which is what ccusage is for. For token counts, use{" "}
            <code>/usage</code> above.
          </p>
        </section>

        <section className="mb-12" id="codex-usage-limits">
          <h2 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Gauge className="w-8 h-8 text-accent" />
            Codex usage limits
          </h2>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            OpenAI publishes limits as estimated local messages per five-hour window, which vary with task size.
            For Plus and Standard Business seats:
          </p>
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Local messages per 5 hours</th>
              </tr>
            </thead>
            <tbody>
              {PLUS_LIMITS.map((row) => (
                <tr key={row.model}>
                  <td>{row.model}</td>
                  <td>{row.messages}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-foreground text-lg leading-relaxed mb-6">
            Local messages and cloud chats share the allowance, and weekly limits may also apply. Pro plans
            currently have no five-hour limit. When you run out, you can buy credits or wait for the reset shown
            in the dashboard. Source:{" "}
            <a href={LIMITS_SOURCE} target="_blank" rel="noopener noreferrer">
              OpenAI Codex pricing
            </a>
            , checked October 2026. What each plan costs, and what Codex developers actually burn, is in{" "}
            <Link href="/blog/codex-pricing">Codex pricing: plans vs measured spend</Link>.
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
