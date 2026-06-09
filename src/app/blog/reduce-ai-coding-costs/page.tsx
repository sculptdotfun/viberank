import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "How to Cut Your AI Coding Bill: 9 Ways to Reduce Claude Code & Codex Costs";
const DESC = "Practical, proven ways to lower your AI coding costs — model routing, prompt caching, context hygiene, and more — without slowing down your workflow.";
const OG = "/api/og?title=Cut%20Your%20AI%20Coding%20Bill&description=9%20ways%20to%20reduce%20Claude%20Code%20%26%20Codex%20costs";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["reduce claude code cost", "lower ai coding cost", "claude code cheaper", "ai coding bill", "prompt caching", "claude code model routing", "save money claude code", "ccusage"],
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://www.viberank.app/blog/reduce-ai-coding-costs",
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

        <h1>How to Cut Your AI Coding Bill: 9 Ways to Reduce Claude Code & Codex Costs</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />June 9, 2026</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />7 min read</span>
        </div>

        <p>
          AI coding tools are worth it — but bills add up fast, and a lot of that spend is waste. After looking at usage from
          800+ developers on the <Link href="/">Viberank leaderboard</Link>, the same patterns separate the efficient users
          from the ones overpaying. Here are nine ways to cut your Claude Code, Codex, and Gemini CLI costs without slowing down.
        </p>

        <h2>1. Route models by task</h2>
        <p>
          The single biggest lever. Don't run everything on the most expensive model. Use a lighter model (Sonnet, Haiku, Gemini
          Flash, smaller GPT) for routine edits, scaffolding, and Q&A; reserve the top model (Opus, GPT-5) for hard reasoning.
          This alone can halve a heavy bill.
        </p>

        <h2>2. Lean on prompt caching</h2>
        <p>
          Cache-read tokens are dramatically cheaper than fresh input tokens. Keep stable context (system prompts, large files)
          consistent across turns so the tool can reuse the cache instead of re-billing full price every message.
        </p>

        <h2>3. Trim your context</h2>
        <p>
          Every irrelevant file you pull in is input tokens on every turn. Be surgical about what you load. Use focused file
          references instead of dumping whole directories.
        </p>

        <h2>4. Start fresh sessions</h2>
        <p>
          Long-running sessions re-send accumulated context repeatedly. When you switch tasks, start a new session so you're not
          paying to drag along an irrelevant history.
        </p>

        <h2>5. Watch reasoning tokens</h2>
        <p>
          Reasoning ("thinking") models on Gemini and Codex generate extra tokens you pay for. They're worth it for genuinely
          hard problems — but don't default to maximum reasoning for trivial edits.
        </p>

        <h2>6. Batch related work</h2>
        <p>
          Ask for several related changes in one well-scoped turn rather than many tiny back-and-forths that each re-pay for
          context. Fewer, denser turns are cheaper than many thin ones.
        </p>

        <h2>7. Measure before you optimize</h2>
        <p>
          You can't cut what you can't see. <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">ccusage</a>{" "}
          breaks down your spend by day and model so you know exactly where the money goes:
        </p>
        <pre><code>npx viberank-cli</code></pre>

        <h2>8. Compare tools on real cost</h2>
        <p>
          The same task can cost very differently across tools. See the{" "}
          <Link href="/blog/codex-vs-claude-code-vs-gemini-cli">Codex vs Claude Code vs Gemini CLI comparison</Link> and the
          live per-tool boards (<Link href="/tool/claude">Claude</Link>, <Link href="/tool/codex">Codex</Link>,{" "}
          <Link href="/tool/gemini">Gemini</Link>) to see what efficient usage actually looks like.
        </p>

        <h2>9. Set a benchmark and track it</h2>
        <p>
          Put yourself on the leaderboard and watch your daily average over time — it turns an invisible bill into a number you
          actively manage. Curious what "normal" looks like? See{" "}
          <Link href="/blog/how-much-does-claude-code-cost">how much Claude Code costs for 800+ developers</Link>.
        </p>

        <h2>The bottom line</h2>
        <p>
          Model routing + caching + context hygiene are 80% of the savings. Measure with{" "}
          <code>npx viberank-cli</code>, optimize the biggest line items, and re-check monthly.
        </p>
      </article>
    </>
  );
}
