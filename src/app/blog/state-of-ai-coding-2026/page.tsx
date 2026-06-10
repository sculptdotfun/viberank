import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "State of AI Coding Spend 2026: Benchmarks From 800 Developers and $2.3M of Usage";
const DESC = "How much do developers really spend on AI coding agents? Percentiles, daily burn rates, model mix, and power-user benchmarks from 29,000 days of real Claude Code, Codex, and Gemini CLI usage.";
const OG = "/api/og?title=State%20of%20AI%20Coding%20Spend%202026&description=Benchmarks%20from%20800%20developers%20%26%20%242.3M%20of%20usage";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["ai coding spend", "claude code cost benchmark", "ai coding statistics 2026", "developer ai usage data", "claude code tokens", "ai agent cost", "state of ai coding", "ccusage"],
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://www.viberank.app/blog/state-of-ai-coding-2026",
    type: "article",
    publishedTime: "2026-06-10T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG] },
};

export default function Post() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: TITLE,
    description: DESC,
    image: "https://www.viberank.app" + OG,
    datePublished: "2026-06-10T00:00:00.000Z",
    dateModified: "2026-06-10T00:00:00.000Z",
    author: { "@type": "Organization", name: "Viberank", url: "https://www.viberank.app" },
    publisher: {
      "@type": "Organization",
      name: "Viberank",
      url: "https://www.viberank.app",
      logo: { "@type": "ImageObject", url: "https://www.viberank.app/icon.svg" },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="prose prose-invert prose-neutral max-w-3xl mx-auto">
        <Link href="/blog" className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors mb-8 no-underline">
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <h1>State of AI Coding Spend 2026</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />June 10, 2026</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />8 min read</span>
        </div>

        <p>
          Everyone has an opinion about what AI coding agents cost. We have data. The{" "}
          <Link href="/">Viberank leaderboard</Link> now holds usage submitted by <strong>~800 developers</strong> —{" "}
          <strong>29,000 individual coding days</strong>, <strong>2.5 trillion tokens</strong>, and{" "}
          <strong>$2.3M in API-equivalent value</strong> — measured locally by{" "}
          <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">ccusage</a> from
          real Claude Code, Codex, and Gemini CLI logs. This is what heavy AI-assisted development actually looks
          like in 2026.
        </p>

        <h2>The headline distribution</h2>
        <p>Total tracked usage value per developer (lifetime on the board, API-equivalent pricing):</p>
        <table>
          <thead><tr><th>Percentile</th><th>Usage value</th></tr></thead>
          <tbody>
            <tr><td>25th</td><td>$379</td></tr>
            <tr><td><strong>Median</strong></td><td><strong>$1,285</strong></td></tr>
            <tr><td>75th</td><td>$3,128</td></tr>
            <tr><td>90th</td><td>$6,494</td></tr>
            <tr><td>99th</td><td>$30,720</td></tr>
            <tr><td>Top user</td><td>$56,694 (81B tokens)</td></tr>
          </tbody>
        </table>
        <p>
          The mean ($2,904) sits more than twice the median — AI coding spend is a classic power-law. The middle of
          the pack burns about what a mid-tier MacBook costs per year; the top 50 users have each consumed more than{" "}
          <strong>$10,000</strong> of compute value.
        </p>

        <h2>Daily burn rate: the new normal is ~$30/day</h2>
        <p>Across all 29,000 tracked coding days:</p>
        <ul>
          <li>Median active day: <strong>$29</strong> of usage</li>
          <li>90th percentile day: <strong>$215</strong></li>
          <li>99th percentile day: <strong>$708</strong></li>
          <li>Single biggest day we've seen: <strong>$3,820</strong></li>
          <li><strong>3,054 days</strong> (11% of all tracked days) exceeded $200 — i.e. a full Claude Max subscription's monthly price, burned in one day</li>
        </ul>
        <p>
          The median submitter is active on <strong>26 days</strong> per submission window — this isn't weekend
          tinkering, it's daily-driver usage.
        </p>

        <h2>Most power users have outgrown their subscription price</h2>
        <p>
          Normalizing each developer's usage to a monthly rate: roughly <strong>half run at $1,000+/month</strong> in
          API-equivalent value, and ~73% run above $400/month. Since most of these developers pay $100–200/month for
          a flat Claude Max plan, the arbitrage is stark: the median heavy user extracts <strong>5–10× the sticker
          price</strong> of their subscription in raw compute value. Flat-rate plans made always-on agentic coding
          economically rational — and the usage curves show developers responded exactly as you'd expect.
        </p>

        <h2>Model mix: Opus is the workhorse, not the treat</h2>
        <ul>
          <li><strong>96%</strong> of developers used a Sonnet-class model</li>
          <li><strong>90%</strong> used Opus — the most expensive tier is now the default for serious work, not a special occasion</li>
          <li><strong>64%</strong> used Haiku somewhere in their workflow (subagents, cheap passes)</li>
          <li>Cache reads dominate token volume — that's how users hit billions of tokens without proportional cost</li>
        </ul>

        <h2>Multi-agent developers are still early — but they're the biggest spenders</h2>
        <p>
          About <strong>9%</strong> of the board reports usage from more than one coding agent (Codex, Gemini CLI,
          OpenCode and friends alongside Claude Code). They're disproportionately represented at the very top of the
          leaderboard: several of the top-10 spenders run three or more agents in parallel. If you want a preview of
          the median 2027 workflow, look at the current multi-tool tail — see our{" "}
          <Link href="/blog/codex-vs-claude-code-vs-gemini-cli">Codex vs Claude Code vs Gemini CLI comparison</Link>.
        </p>

        <h2>Who these developers are</h2>
        <p>
          Cross-referencing public GitHub data for the board: the median account is <strong>~9 years old</strong>, a
          third have 50+ public repositories, and spend <em>rises</em> with experience — developers with 13+ year-old
          GitHub accounts have the highest median usage. Geographically (by site traffic): US ~31%, <strong>South
          Korea ~13%</strong> — the strongest per-capita AI-coding adoption signal we see anywhere — then the UK,
          India, and Canada. AI-assisted coding at this intensity is a senior-engineer phenomenon, not a shortcut for
          beginners.
        </p>

        <h2>Methodology & honest caveats</h2>
        <ul>
          <li><strong>Source:</strong> developers run ccusage locally against their own agent logs and submit the result. GitHub-OAuth submissions are verified (blue check); CLI submissions are self-reported.</li>
          <li><strong>"Spend" means API-equivalent value</strong> — what the tokens would cost at list API prices. Most users actually pay a flat subscription, so real out-of-pocket cost is usually far lower.</li>
          <li><strong>Selection bias is real:</strong> people who submit to a usage leaderboard skew heavy. Read these numbers as benchmarks for serious users, not population averages.</li>
        </ul>

        <h2>Where do you rank?</h2>
        <p>
          One command measures your real usage and puts you on the board:
        </p>
        <pre><code>npx viberank-cli</code></pre>
        <p>
          Curious what drives the bill — or how to shrink it? Read{" "}
          <Link href="/blog/how-much-does-claude-code-cost">how much Claude Code costs</Link> and{" "}
          <Link href="/blog/reduce-ai-coding-costs">9 ways to cut your AI coding bill</Link>.
        </p>
      </article>
    </>
  );
}
