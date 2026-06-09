import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "How Much Does Claude Code Cost? Real Data From 800+ Developers (2026)";
const DESC = "What does Claude Code actually cost per month? We break down real spend, tokens, and daily averages from 800+ developers on the Viberank leaderboard.";
const OG = "/api/og?title=How%20Much%20Does%20Claude%20Code%20Cost%3F&description=Real%20data%20from%20800%2B%20developers";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["how much does claude code cost", "claude code pricing", "claude code cost per month", "claude code token cost", "ai coding cost", "claude code usage", "ccusage"],
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://www.viberank.app/blog/how-much-does-claude-code-cost",
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

      <article className="prose prose-invert prose-neutral max-w-none">
        <Link href="/blog" className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors mb-8 no-underline">
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <h1>How Much Does Claude Code Cost? Real Data From 800+ Developers</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />June 9, 2026</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />6 min read</span>
        </div>

        <p>
          "How much does Claude Code cost?" is the question every developer asks before going all-in. The honest answer:
          it depends entirely on how heavily you use it — anywhere from a few dollars a month to thousands. Instead of guessing,
          we looked at <strong>real, submitted usage</strong> from 800+ developers on the{" "}
          <Link href="/">Viberank leaderboard</Link>.
        </p>

        <h2>The headline numbers</h2>
        <p>Aggregate usage across the Viberank leaderboard:</p>
        <ul>
          <li><strong>800+ developers</strong> tracked</li>
          <li><strong>$2.1M+</strong> in total spend</li>
          <li><strong>2.3 trillion</strong> tokens consumed</li>
          <li><strong>$56K+</strong> spent by the single top developer</li>
        </ul>
        <p>
          That top number is the eye-catching one, but it's the extreme tail. Most developers spend far less — the heavy hitters
          are running Claude Code as a full-time autonomous agent across large codebases, often around the clock.
        </p>

        <h2>What drives your Claude Code bill</h2>
        <p>Claude Code cost is just tokens × model price. Four things move the number:</p>
        <ol>
          <li><strong>Model choice.</strong> Opus costs materially more per token than Sonnet, which costs more than Haiku. Defaulting everything to Opus is the #1 reason bills balloon.</li>
          <li><strong>Context size.</strong> Bigger prompts and larger repos mean more input tokens every turn.</li>
          <li><strong>Cache reads.</strong> Claude Code leans heavily on prompt caching — cache-read tokens are cheap, which is why heavy users can rack up <em>billions</em> of tokens without a proportional bill.</li>
          <li><strong>Session length.</strong> Long agentic runs re-send context repeatedly. Frequency matters as much as size.</li>
        </ol>

        <h2>Estimating your own monthly cost</h2>
        <p>
          Rough buckets we see on the leaderboard:
        </p>
        <table>
          <thead><tr><th>Usage profile</th><th>Typical monthly spend</th></tr></thead>
          <tbody>
            <tr><td>Occasional (a few sessions/week)</td><td>~$20–80</td></tr>
            <tr><td>Daily driver (Sonnet-heavy)</td><td>~$100–400</td></tr>
            <tr><td>Power user (Opus, long sessions)</td><td>~$500–2,000</td></tr>
            <tr><td>Always-on agent</td><td>$2,000+</td></tr>
          </tbody>
        </table>
        <p className="text-sm text-muted">
          These are observed ranges from real submissions, not official pricing. Your mileage will vary with model and workflow.
        </p>

        <h2>See exactly what you spend</h2>
        <p>
          Don't estimate — measure. <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">ccusage</a>{" "}
          reads Claude Code's local logs and computes your exact tokens and USD. One command submits it to the leaderboard so you
          can see where you rank:
        </p>
        <pre><code>npx viberank-cli</code></pre>
        <p>
          Using more than one tool? The same data covers <Link href="/tool/codex">Codex</Link> and{" "}
          <Link href="/tool/gemini">Gemini CLI</Link> too — see the{" "}
          <Link href="/blog/codex-vs-claude-code-vs-gemini-cli">full cost comparison</Link>.
        </p>

        <h2>Spending too much?</h2>
        <p>
          If these numbers made you wince, read <Link href="/blog/reduce-ai-coding-costs">how to cut your AI coding bill</Link> —
          model routing and caching alone can cut a heavy Claude Code bill by half without slowing you down.
        </p>
      </article>
    </>
  );
}
