import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "viberank v2: the weekly league for AI coding";
const DESC =
  "viberank now runs in weeks. Every Monday 00:00 UTC a new week starts, verified people at human scale are ranked against each other, and a closed week is frozen 12 hours later. Why we changed it, how a week works, and how to join in 30 seconds.";
const URL = "https://www.viberank.app/blog/viberank-v2-weekly-league";
const OG =
  "/api/og?title=viberank%20v2&description=The%20weekly%20league%20for%20AI%20coding";
const PUBLISHED = "2026-11-26T00:00:00.000Z";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "viberank v2",
    "weekly ai coding leaderboard",
    "claude code leaderboard",
    "codex leaderboard",
    "ccusage leaderboard",
    "verified token leaderboard",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: "article",
    publishedTime: PUBLISHED,
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
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
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

        <h1>viberank v2: the weekly league for AI coding</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />November 26, 2026</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />4 min read</span>
        </div>

        <p>
          viberank now runs in weeks. Every Monday at 00:00 UTC a new week starts and everyone is back at zero.
          The home page ranks this week, among people at a human scale who have proved who they are. The old
          all-time board is still there, at <Link href="/records">/records</Link>.
        </p>

        <h2>Why we changed it</h2>
        <p>
          The all-time board had two problems. Nobody could win it, and not many people believed it.
        </p>
        <p>
          A lifetime total only grows. If you started this month on a $20 plan, you were never going to catch
          someone with two years of history, so there was little reason to come back. Most people didn&apos;t:
          94% of the people who submitted never returned to the site.
        </p>
        <p>
          The top of the board was the other problem. The #1 row showed about $1.8M of API-equivalent usage,
          and 7 of the top 10 carried an &quot;under review&quot; badge. A board whose first screen argues
          with itself isn&apos;t much of a yardstick.
        </p>
        <p>
          We also don&apos;t think &quot;who burned the most tokens&quot; is an interesting question on its own.
          The questions people keep asking us are smaller and more personal. Am I using my plan? What does a
          normal heavy week look like? Did I do more this week than last? A week is the right size for those.
          It&apos;s also the unit every paid plan already resets on.
        </p>

        <h2>How a week works</h2>
        <ul>
          <li>
            The week runs Monday 00:00 UTC to the next Monday 00:00 UTC. Only usage from those seven days counts
            toward it.
          </li>
          <li>
            Your row is pinned on the board, with the gap to the person above you (&quot;$27 behind
            @someone&quot;) and the bracket of people around your rank.
          </li>
          <li>
            On Monday you get a recap card: where you finished, how you moved, what you ran. Each closed week
            keeps a page, like <Link href="/week/2026-W48">/week/2026-W48</Link>.
          </li>
          <li>
            Twelve hours after a week closes, it is frozen. Late uploads still go into your profile and{" "}
            <Link href="/records">/records</Link>, but they never change a finished week.
          </li>
        </ul>
        <p>
          You can also run a private league for your team or friends. It sits on the same weekly board and
          resets on the same Monday.
        </p>

        <h2>The trust rules</h2>
        <p>Every entry lands on one of three boards, and the board says why.</p>
        <ul>
          <li>
            <strong>Ranked</strong> is the main board. You&apos;re on it when your submissions are verified with
            GitHub, nothing on your profile is under review, and your week is at most 10 plan-equivalents. One
            plan-equivalent is $1,300 of API-equivalent usage in a week, about one top-tier subscription used to
            its limit (the measurement behind it is in{" "}
            <a href="https://github.com/sculptdotfun/viberank/issues/195">#195</a>).
          </li>
          <li>
            <strong>Open</strong> is everyone else below that line: unverified submissions and entries under
            review. They stay public, with the reason printed on the row. When a review clears, the entry moves
            to Ranked.
          </li>
          <li>
            <strong>Fleets</strong> is for anything above 10 plan-equivalents a week: teams under one handle,
            relays, agent farms. They&apos;re listed and measured, just not ranked against one person.
          </li>
        </ul>
        <p>
          These rules don&apos;t make faking impossible. viberank reads logs on your own machine, and a careful
          person can forge those. What the rules do is keep a forged number off the main board unless it is
          signed, plausible for one human, and survives a look. The details, including the per-day checks every
          submission goes through, are in{" "}
          <Link href="/blog/how-viberank-checks-submissions">how viberank checks submissions</Link>.
        </p>

        <h2>Join in 30 seconds</h2>
        <pre>
          <code>npx viberank-cli</code>
        </pre>
        <p>
          That reads your local usage with <a href="https://github.com/ryoppippi/ccusage">ccusage</a> (Claude
          Code, Codex, Gemini CLI, OpenCode and the rest), verifies you with GitHub from the terminal, submits,
          and prints where you stand this week. Say yes to autosubmit and it keeps itself up to date. Only daily
          totals leave your machine: tokens, models and API-equivalent cost. No prompts, no code.
        </p>
        <p>Other ways in:</p>
        <ul>
          <li>
            The Claude Code plugin syncs when a session ends and puts your rank in the status line, like{" "}
            <code>vr #41/126 ▲6 · $27 to @palewave</code>.
          </li>
          <li>
            <code>npx viberank-cli status</code> prints the same line for any status bar.
          </li>
          <li>The MCP server has a <code>get_standing</code> tool, so you can ask your agent where you are.</li>
          <li>
            A README badge shows your weekly rank:{" "}
            <code className="break-all">https://www.viberank.app/api/badge/&lt;you&gt;?style=v2&amp;range=week</code>
          </li>
          <li>
            A <code>/vs/you/friend</code> link puts two people side by side for the week. Send it to whoever you
            think you&apos;re ahead of.
          </li>
        </ul>
        <p>
          Every option, with copy buttons, is on <Link href="/start">/start</Link>. This week&apos;s board is at{" "}
          <Link href="/week">/week</Link>.
        </p>

        <h2>What&apos;s next</h2>
        <p>
          Wrapped 2026 opens on December 10: your year in AI coding, on one card. If you submit regularly
          between now and then, it has more to work with, because Claude Code deletes local transcripts after
          30 days by default and anything already submitted stays.
        </p>
        <p>
          If something on the board looks wrong, open an issue on{" "}
          <a href="https://github.com/sculptdotfun/viberank/issues">GitHub</a>. A lot of what&apos;s in v2 came
          from people who did exactly that.
        </p>
      </article>
    </>
  );
}
