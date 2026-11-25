import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

const TITLE = "How Viberank Checks Submissions (and the Fake #1 We Removed)";
const DESC =
  "A synthetic $1.8M day briefly topped the AI coding leaderboard. What it was, why it got through, the per-day checks that stop it now, and what a leaderboard built on self-reported usage can and can't prove.";
const URL = "https://www.viberank.app/blog/how-viberank-checks-submissions";
const OG =
  "/api/og?title=How%20Viberank%20Checks%20Submissions&description=The%20fake%20%231%2C%20and%20the%20checks%20that%20stop%20it";
const PUBLISHED = "2026-10-13T00:00:00.000Z";
const MODIFIED = "2026-11-26T00:00:00.000Z";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "viberank verification",
    "ai coding leaderboard fake",
    "claude code leaderboard cheating",
    "is viberank real",
    "ccusage validation",
    "token leaderboard verification",
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
    dateModified: MODIFIED,
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

        <h1>How Viberank Checks Submissions (and the Fake #1 We Removed)</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />October 13, 2026</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />7 min read</span>
          <span>·</span>
          <span>Updated November 26, 2026</span>
        </div>

        <p>
          For a few days in October, the #1 spot on Viberank, on both cost and tokens, belonged to a profile with
          about $25,900 of real usage and one day worth <strong>$1,825,000</strong>. Two users reported it on GitHub
          (<a href="https://github.com/sculptdotfun/viberank/issues/182">#182</a>), with numbers that showed the
          profile didn&apos;t add up. They were right. Here is what that day was, why our checks let it in, what we
          changed, and what any leaderboard built on self-reported usage can and can&apos;t prove.
        </p>

        <h2>What the day was</h2>
        <p>
          Every submission is archived as it arrives, so we could read the original. The day carried 18.25 trillion
          tokens, all of them cache reads, with zero input or output. It was billed to a model called{" "}
          <code>synthetic-demo-not-a-real-model</code>. The payload said so itself: it was marked{" "}
          <code>&quot;synthetic&quot;: true</code> and described as a demonstration fixture where no actual usage
          occurred. It was sent without a sign-in token, so anyone could have sent it under that name. We
          don&apos;t assume who did.
        </p>
        <p>
          We deleted that one day and recomputed the profile from its remaining days. The rest of the profile&apos;s
          history is untouched.
        </p>

        <h2>Why it got through</h2>
        <p>
          The number wasn&apos;t random. <strong>$1,825,000 is exactly $5,000 × 365</strong>, the cap we placed on a
          report&apos;s total cost. Our cost-per-token floor charges each token at least $0.0000001, and 18.25
          trillion tokens × $0.0000001 is, again, exactly $1,825,000. The day sat precisely on two limits, and
          both checks use strict comparisons, so it passed both. Cache reads are excluded from our token ceiling,
          because heavy honest users legitimately read hundreds of billions of cached tokens, so that check
          didn&apos;t apply either.
        </p>
        <p>
          The real gap was simpler. The $5,000 figure was meant as a daily limit, but it was only ever applied to
          the total. Nothing looked at a single day, and nothing checked that a day&apos;s cost matched the models
          it claimed to come from.
        </p>

        <h2>What we check now</h2>
        <p>Every submission goes through these checks before it is stored:</p>
        <ul>
          <li>
            <strong>No single day over $150,000.</strong> We replayed all 4,960 archived submissions. The largest
            honest day on record is about $126,000, so real heavy users are unaffected. The only day this cap
            rejects is the synthetic one.
          </li>
          <li>
            <strong>Big days must add up.</strong> Any day over $5,000 must carry a per-model breakdown whose costs
            sum to the day&apos;s total within 10%. <a href="https://github.com/ryoppippi/ccusage">ccusage</a> always
            emits that breakdown, so only hand-built payloads fail. Smaller days are exempt, because older CLIs and
            web uploads omit it.
          </li>
          <li>
            <strong>Every token must be paid for at its model&apos;s price floor.</strong> Inflating tokens without
            inflating cost pushes a report under the floor, and inflating cost without tokens pushes it over the
            ceiling. Cheap model families (DeepSeek, MiniMax and others) get a lower floor, but only for their own
            tokens.
          </li>
          <li>
            <strong>Machine IDs are checked.</strong> They can&apos;t take names the server uses internally, so a
            client can&apos;t write into slots it doesn&apos;t own.
          </li>
          <li>
            <strong>Re-submits never double count.</strong> Each machine&apos;s usage for a day is stored once and
            only ever replaced by a larger reading of the same machine, so running the CLI daily is safe.
          </li>
        </ul>

        <h2>What a verified badge means</h2>
        <p>
          A profile is <strong>verified</strong> when its submissions are signed with a token from{" "}
          <code>npx viberank-cli login</code>, or uploaded while signed in with GitHub. Either way it proves the
          GitHub account owner sent them. Unverified submissions can&apos;t write to a verified profile.
        </p>

        <h2>Ranked, Open and Fleets</h2>
        <p>
          Since <Link href="/blog/viberank-v2-weekly-league">viberank v2</Link> (November 2026), the home board is
          the current week, and every entry sits on one of three boards with the reason shown:
        </p>
        <ul>
          <li>
            <strong>Ranked</strong>: GitHub-verified, nothing under review, and at most 10 plan-equivalents in
            the week. A plan-equivalent is $1,300 of API-equivalent usage a week, about one top-tier plan used to
            its limit (<a href="https://github.com/sculptdotfun/viberank/issues/195">#195</a>).
          </li>
          <li>
            <strong>Open</strong>: everyone else below that line. An unverified submission lands here, and so
            does an entry marked &quot;under review&quot;. The mark used to be a badge on a row that kept its
            rank. Now the entry keeps its profile and its place on Open, and moves to Ranked only after a
            maintainer clears it.
          </li>
          <li>
            <strong>Fleets</strong>: anything above 10 plan-equivalents a week, verified or not. Teams under one
            handle, relays and agent farms are measured here instead of ranked against one person.
          </li>
        </ul>
        <p>
          A week closes Monday 00:00 UTC and is <strong>frozen 12 hours later</strong>. After that, its result
          is a snapshot. Days that arrive late still count on your profile and on{" "}
          <Link href="/records">/records</Link>, the lifetime board, but they can&apos;t change a finished week.
          So a bulk upload can&apos;t rewrite past weeks.
        </p>

        <h2>What no usage leaderboard can prove</h2>
        <p>
          Viberank reads usage from your own machine&apos;s logs through ccusage. That is the only place the data
          exists: neither Anthropic nor OpenAI publishes per-user usage. So no check here can prove a number is
          real. They prove that it is internally consistent and plausible, priced the way ccusage prices it, and
          signed by the account it&apos;s shown under. A careful faker could still spread invented usage over many
          ordinary-looking days. That&apos;s why every submission is archived, why anomalies get a human look, and
          why reports like #182 matter.
        </p>
        <p>
          Dollar figures on Viberank are <strong>API-equivalent</strong>: what the tokens would cost at list API
          prices. Most heavy users are on flat subscriptions, so this measures usage, not money out of pocket.
        </p>

        <h2>If something looks wrong</h2>
        <p>
          Open an issue on <a href="https://github.com/sculptdotfun/viberank/issues">GitHub</a> with the profile and
          what doesn&apos;t add up. Profiles show per-day and per-model figures, so you can usually check a
          number against itself, as the two reporters did here. Every report gets read.
        </p>
        <p>
          The checks are in the open too: <code>validateCcData</code> in the{" "}
          <a href="https://github.com/sculptdotfun/viberank">source</a>, with the rules written up in{" "}
          <a href="https://github.com/sculptdotfun/viberank/blob/main/VALIDATION.md">VALIDATION.md</a>.
        </p>
      </article>
    </>
  );
}
