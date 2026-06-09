import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "Codex vs Claude Code vs Gemini CLI: AI Coding Cost & Usage Compared (2026)";
const DESC = "How OpenAI Codex, Claude Code, and Gemini CLI compare on cost, tokens, and real-world usage — backed by data from 800+ developers on the Viberank leaderboard.";
const OG = "/api/og?title=Codex%20vs%20Claude%20Code%20vs%20Gemini%20CLI&description=AI%20Coding%20Cost%20%26%20Usage%20Compared";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["codex vs claude code", "claude code vs gemini cli", "openai codex cli", "gemini cli", "ai coding cost comparison", "ccusage", "ai coding tools 2026", "claude code cost"],
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://www.viberank.app/blog/codex-vs-claude-code-vs-gemini-cli",
    type: "article",
    publishedTime: "2026-06-09T00:00:00.000Z",
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
    datePublished: "2026-06-09T00:00:00.000Z",
    dateModified: "2026-06-09T00:00:00.000Z",
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

        <h1>Codex vs Claude Code vs Gemini CLI: AI Coding Cost & Usage Compared (2026)</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />June 9, 2026</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />8 min read</span>
        </div>

        <p>
          Three command-line coding agents now dominate most developers' terminals: <strong>Claude Code</strong> (Anthropic),
          <strong> Codex</strong> (OpenAI), and <strong>Gemini CLI</strong> (Google). They all do the same core job — drive an LLM
          against your codebase from the terminal — but they differ in pricing model, token accounting, and how teams actually
          spend on them. This post compares all three using <strong>real usage data</strong> from the{" "}
          <Link href="/">Viberank leaderboard</Link>, where 800+ developers have submitted their actual costs.
        </p>

        <h2>The quick answer</h2>
        <ul>
          <li><strong>Claude Code</strong> — the most-used tool on Viberank by a wide margin, and the heaviest spenders use it. Strong agentic workflows, cache-heavy token usage.</li>
          <li><strong>Codex</strong> — fast-growing; GPT-class models with reasoning tokens. See the <Link href="/tool/codex">Codex leaderboard</Link>.</li>
          <li><strong>Gemini CLI</strong> — competitive token pricing and a large free-ish tier for many models; reasoning ("thinking") tokens inflate totals. See the <Link href="/tool/gemini">Gemini leaderboard</Link>.</li>
        </ul>

        <h2>How we compare them fairly</h2>
        <p>
          You can't eyeball costs across tools — pricing differs per model and changes often. The honest way is to measure{" "}
          <strong>actual tokens and actual USD</strong> from each tool's own logs. That's what{" "}
          <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">ccusage</a> does: it reads the
          local logs Claude Code, Codex, and Gemini CLI each write, then computes cost from model pricing. Viberank aggregates
          that per developer, so the comparison is apples-to-apples: dollars spent and tokens used, not marketing numbers.
        </p>
        <p>
          One important nuance: <strong>reasoning/thinking tokens</strong>. Gemini and Codex reasoning models count "thinking"
          tokens in their totals that aren't part of the usual input/output/cache split. So raw token counts skew higher for
          reasoning-heavy tools — which is exactly why <strong>cost (USD)</strong> is the fairer cross-tool ranking metric.
        </p>

        <h2>Cost model at a glance</h2>
        <table>
          <thead>
            <tr><th>Tool</th><th>Models</th><th>Token style</th><th>Best for</th></tr>
          </thead>
          <tbody>
            <tr><td>Claude Code</td><td>Claude Opus / Sonnet / Haiku</td><td>Heavy prompt caching (cache-read dominates)</td><td>Long agentic sessions, large repos</td></tr>
            <tr><td>Codex</td><td>GPT-5 / Codex family</td><td>Reasoning tokens billed as output</td><td>Fast iteration, OpenAI ecosystem</td></tr>
            <tr><td>Gemini CLI</td><td>Gemini 2.5 / 3 Pro & Flash</td><td>Thinking tokens inflate total</td><td>Cost-sensitive usage, big context</td></tr>
          </tbody>
        </table>

        <h2>What the real data shows</h2>
        <p>
          Across the Viberank leaderboard, collective spend has passed <strong>$2.1M</strong> over <strong>2.3 trillion tokens</strong>
          from 800+ developers. Claude Code is the dominant tool among top spenders, but multi-tool usage is rising fast — many of
          the highest-ranked developers now show <em>Claude + Codex + Gemini</em> side by side on their profiles. Browse the live,
          per-tool breakdowns:
        </p>
        <ul>
          <li><Link href="/tool/claude">Claude Code usage leaderboard</Link></li>
          <li><Link href="/tool/codex">Codex usage leaderboard</Link></li>
          <li><Link href="/tool/gemini">Gemini CLI usage leaderboard</Link></li>
          <li><Link href="/tool/copilot">GitHub Copilot CLI</Link> · <Link href="/tool/opencode">OpenCode</Link></li>
        </ul>

        <h2>Which should you use?</h2>
        <p>
          Most serious users don't pick one — they route work to whichever tool fits the task and let ccusage track all of it.
          If you want to see where you land (and what a realistic monthly bill looks like), see{" "}
          <Link href="/blog/how-much-does-claude-code-cost">how much Claude Code actually costs</Link> and{" "}
          <Link href="/blog/reduce-ai-coding-costs">how to cut your AI coding bill</Link>.
        </p>

        <h2>See your own numbers</h2>
        <p>
          Run one command to measure your usage across all three tools and put yourself on the board:
        </p>
        <pre><code>npx viberank-cli</code></pre>
        <p>
          It reads your local ccusage data (Claude Code, Codex, Gemini, and more) and submits it. Then compare yourself on the{" "}
          <Link href="/">global leaderboard</Link>.
        </p>
      </article>
    </>
  );
}
