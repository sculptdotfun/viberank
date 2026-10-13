import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";
import { getServerDataLayer } from "@/lib/data";
import {
  buildCostBenchmark,
  headlineClaim,
  percentile,
  shareAbove,
  usd,
  pct,
  CAVEATS,
  ANTHROPIC_PUBLISHED_RANGE,
  type CostBenchmark,
} from "@/lib/cost-benchmark";

// The whole point of this page is that its numbers are measured rather than
// quoted, so they have to stay current without anyone remembering to edit it.
export const revalidate = 3600;

// Leads with "pricing" because that is what people search (27K/mo for
// "claude code pricing" vs 4K for "claude code cost"); the measured data is
// the hook no plan-listing page can match. Slug stays for its link equity.
const TITLE = "Claude Code Pricing (2026): Plans vs What Devs Really Spend";
const DESC =
  "Claude Code pricing in 2026: Pro $20, Max 5x $100, Max 20x $200, or API per token — next to measured monthly spend from developers who track their own Claude Code usage.";
const OG =
  "/api/og?title=Claude%20Code%20Pricing%20(2026)&description=Plans%20vs%20measured%20spend%20per%20developer";

// Verified against Anthropic's own pages on 2026-10-13. Re-check before
// editing: plan prices change and these are quoted as fact.
const PRICING_SOURCES = {
  plans: "https://claude.com/pricing",
  max: "https://support.claude.com/en/articles/11049741-what-is-the-max-plan",
  api: "https://platform.claude.com/docs/en/about-claude/pricing",
} as const;
const URL = "https://www.viberank.app/blog/how-much-does-claude-code-cost";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "claude code pricing",
    "claude code price",
    "claude code cost",
    "how much does claude code cost",
    "claude code cost per month",
    "average claude code cost",
    "claude code cost per developer",
    "ai coding cost per developer",
    "claude code token cost",
    "ccusage",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: "article",
    publishedTime: "2026-06-09T00:00:00.000Z",
    modifiedTime: "2026-10-13T00:00:00.000Z",
    authors: ["Viberank Team"],
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG] },
};

function dataMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function loadBenchmark(): Promise<CostBenchmark> {
  try {
    const dataLayer = await getServerDataLayer();
    return buildCostBenchmark(await dataLayer.stats.getSpendRows());
  } catch {
    return buildCostBenchmark([]);
  }
}

export default async function Post() {
  const benchmark = await loadBenchmark();
  const hasData = benchmark.cohortSize > 0;
  const claim = headlineClaim(benchmark);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: TITLE,
      description: hasData ? claim : DESC,
      image: "https://www.viberank.app" + OG,
      datePublished: "2026-06-09T00:00:00.000Z",
      // The figures are re-measured hourly from live data; report the month they
      // were last refreshed in, not the day the prose was written.
      dateModified: dataMonthStart(),
      author: { "@type": "Organization", name: "Viberank", url: "https://www.viberank.app" },
      publisher: {
        "@type": "Organization",
        name: "Viberank",
        url: "https://www.viberank.app",
        logo: { "@type": "ImageObject", url: "https://www.viberank.app/icon.svg" },
      },
    },
    // The dataset is the reason this page deserves to rank. Mark it up as one
    // so answer engines and aggregators can cite the figures directly.
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Claude Code monthly spend distribution",
      description: `Monthly API-equivalent spend per developer across ${benchmark.cohortSize} developers who measure their own Claude Code usage with ccusage.`,
      url: URL,
      creator: { "@type": "Organization", name: "Viberank", url: "https://www.viberank.app" },
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      distribution: [
        {
          "@type": "DataDownload",
          encodingFormat: "application/json",
          contentUrl: "https://www.viberank.app/api/stats",
        },
      ],
      variableMeasured: benchmark.percentiles.map((entry) => ({
        "@type": "PropertyValue",
        name: `p${entry.p} monthly API-equivalent spend`,
        value: Math.round(entry.monthlyUsd),
        unitCode: "USD",
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Claude Code's pricing?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Claude Code is included in Claude's paid plans: Pro at $20/month ($17/month billed annually), Max 5x at $100/month and Max 20x at $200/month, or Team seats from $20/seat/month billed annually. Without a subscription it bills per token at API rates, e.g. Claude Opus 5.5 at $4 input / $20 output per million tokens.",
          },
        },
        {
          "@type": "Question",
          name: "How much does Claude Code cost per month?",
          acceptedAnswer: { "@type": "Answer", text: claim },
        },
        {
          "@type": "Question",
          name: "Why is this different from Anthropic's published figure?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Anthropic's $150–250 range describes enterprise deployments it bills directly. This measures API-equivalent cost from the local session logs of developers who opted to track and publish their usage — a heavier population, and a different quantity. Both numbers are real; they answer different questions.",
          },
        },
        {
          "@type": "Question",
          name: "Is this what developers actually pay?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Most developers on the board pay a flat Claude subscription of $20, $100 or $200 a month. These figures are what the same usage would cost at API list prices, which is the only way to compare consumption across plans and tools.",
          },
        },
      ],
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

        <h1>Claude Code Pricing (2026): Plans vs What Devs Really Spend</h1>

        <div className="flex items-center gap-3 text-sm text-muted not-prose mb-8">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />6 min read
          </span>
        </div>

        {hasData && (
          <div className="not-prose rounded-lg border border-accent/40 bg-surface-1 p-6 mb-10">
            <p className="text-lg text-foreground m-0 leading-relaxed">{claim}</p>
          </div>
        )}

        <h2>Claude Code plans and prices</h2>
        <p>
          Claude Code has no separate price: it comes with a paid Claude plan, or bills per token through the API.
          Current list prices from Anthropic:
        </p>
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Claude Code usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pro</td>
              <td>$20/mo ($17/mo billed annually)</td>
              <td>Included; session limit resets every 5 hours, plus a weekly limit</td>
            </tr>
            <tr>
              <td>Max 5x</td>
              <td>$100/mo</td>
              <td>5&times; Pro&apos;s per-session usage</td>
            </tr>
            <tr>
              <td>Max 20x</td>
              <td>$200/mo</td>
              <td>20&times; Pro&apos;s per-session usage</td>
            </tr>
            <tr>
              <td>Team (Standard seat)</td>
              <td>$25/seat/mo ($20 billed annually)</td>
              <td>Included</td>
            </tr>
            <tr>
              <td>API (pay as you go)</td>
              <td>Per million tokens, input / output</td>
              <td>Opus 5.5 $4 / $20 &middot; Sonnet 5.5 $2 / $10 &middot; Haiku 4.5 $1 / $5</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm">
          Sources:{" "}
          <a href={PRICING_SOURCES.plans} target="_blank" rel="noopener noreferrer">claude.com/pricing</a>,{" "}
          <a href={PRICING_SOURCES.max} target="_blank" rel="noopener noreferrer">What is the Max plan?</a>,{" "}
          <a href={PRICING_SOURCES.api} target="_blank" rel="noopener noreferrer">Claude API pricing</a>. Checked
          October 2026; Max prices are for web subscriptions. Limits are per plan, not per dollar, so how far a plan
          goes depends on how you use it. See <Link href="/blog/claude-code-usage-limits">Claude Code usage limits</Link>.
        </p>

        <h2>What developers really spend per month</h2>
        {hasData ? (
          <>
            <p>
              A plan price is a ceiling on what you pay, not a measure of what you use. Here is measured monthly
              API-equivalent spend per developer, computed by ccusage from local session logs, one row per person,
              across <strong>{benchmark.cohortSize.toLocaleString("en-US")} developers</strong>:
            </p>
            <table>
              <thead>
                <tr>
                  <th>Percentile</th>
                  <th>Monthly spend</th>
                  <th>What it looks like</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>p10</td>
                  <td>{usd(percentile(benchmark, 10))}</td>
                  <td>occasional sessions</td>
                </tr>
                <tr>
                  <td>p25</td>
                  <td>{usd(percentile(benchmark, 25))}</td>
                  <td>a few times a week</td>
                </tr>
                <tr>
                  <td>
                    <strong>median</strong>
                  </td>
                  <td>
                    <strong>{usd(percentile(benchmark, 50))}</strong>
                  </td>
                  <td>daily driver</td>
                </tr>
                <tr>
                  <td>p75</td>
                  <td>{usd(percentile(benchmark, 75))}</td>
                  <td>heavy, Opus-leaning</td>
                </tr>
                <tr>
                  <td>p90</td>
                  <td>{usd(percentile(benchmark, 90))}</td>
                  <td>long agentic runs</td>
                </tr>
                <tr>
                  <td>p99</td>
                  <td>{usd(percentile(benchmark, 99))}</td>
                  <td>always-on agent fleets</td>
                </tr>
              </tbody>
            </table>
            <p>
              The mean is {usd(benchmark.meanMonthlyUsd)} — well above the median, because the distribution has a
              long right tail. The top 10% of developers account for{" "}
              <strong>{pct(benchmark.topDecileShareOfSpend)}</strong> of all spend tracked here. If you take one
              thing from this page, take that: <em>&ldquo;average&rdquo; is the wrong statistic for AI coding
              cost</em>, and any page quoting a single average is hiding the shape.
            </p>

            <h2>Against the published range</h2>
            <p>
              Almost every page answering this question quotes the same number: <strong>$150–250 per developer per
              month</strong>, sourced from Anthropic&apos;s own enterprise guidance. It gets republished because it is
              the only published figure available — not because anyone checked it.
            </p>
            <p>
              Viberank can check it. Developers here submit real usage: token counts and API-equivalent costs computed
              by <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">ccusage</a>{" "}
              from their own local session logs. That makes this, as far as we know, the only independent distribution
              of what heavy AI coding actually costs.
            </p>
            <p>Share of developers burning more than each threshold:</p>
            <table>
              <thead>
                <tr>
                  <th>Threshold</th>
                  <th>Share above</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${ANTHROPIC_PUBLISHED_RANGE.low}/mo</td>
                  <td>{pct(shareAbove(benchmark, ANTHROPIC_PUBLISHED_RANGE.low))}</td>
                  <td>bottom of Anthropic&apos;s range</td>
                </tr>
                <tr>
                  <td>${ANTHROPIC_PUBLISHED_RANGE.high}/mo</td>
                  <td>
                    <strong>{pct(shareAbove(benchmark, ANTHROPIC_PUBLISHED_RANGE.high))}</strong>
                  </td>
                  <td>top of Anthropic&apos;s range</td>
                </tr>
                <tr>
                  <td>$400/mo</td>
                  <td>{pct(shareAbove(benchmark, 400))}</td>
                  <td>2&times; a Max 20x subscription</td>
                </tr>
                <tr>
                  <td>$1,000/mo</td>
                  <td>{pct(shareAbove(benchmark, 1000))}</td>
                  <td>5&times; a Max 20x subscription</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p>
            Live figures are temporarily unavailable. The current numbers are always on the{" "}
            <Link href="/stats">stats page</Link>.
          </p>
        )}

        <h2>Why the two numbers differ</h2>
        <p>
          Both are real; they measure different things, and saying so plainly matters more than the headline:
        </p>
        <ul>
          {CAVEATS.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
        <p>
          The self-selection is the big one. People who install a usage tracker and publish the result are not a
          random sample of Claude Code users — they skew heavy, and that is exactly why the median here sits well
          above enterprise guidance. What the distribution does show honestly is the <em>shape</em> of heavy usage,
          which no other public source publishes at all.
        </p>

        <h2>What actually drives the number</h2>
        <ol>
          <li>
            <strong>Model choice.</strong> Opus costs materially more per token than Sonnet, which costs more than
            Haiku. Defaulting everything to Opus is the single biggest reason bills balloon.
          </li>
          <li>
            <strong>Cache reads.</strong> About 95% of all tokens tracked here are prompt-cache reads, billed at a
            fraction of input price. This is why a developer can burn billions of tokens without a proportional
            bill — and why raw token counts badly overstate cost.
          </li>
          <li>
            <strong>Context size.</strong> Bigger repos and longer prompts mean more input tokens every turn.
          </li>
          <li>
            <strong>Session length.</strong> Long agentic runs re-send context repeatedly; frequency matters as
            much as size.
          </li>
        </ol>

        <h2>Measure your own</h2>
        <p>
          Don&apos;t estimate against someone else&apos;s median. ccusage reads Claude Code&apos;s local logs and
          computes your exact tokens and API-equivalent cost; one command puts it on the board so you can see which
          percentile above you actually land in:
        </p>
        <pre>
          <code>npx viberank-cli</code>
        </pre>
        <p>
          The <Link href="/calculator">subscription calculator</Link> takes the same number and tells you which
          Claude plan your usage justifies. If the answer stung, read{" "}
          <Link href="/blog/reduce-ai-coding-costs">how to cut your AI coding bill</Link> — model routing and
          caching alone can halve a heavy bill.
        </p>
        <p>
          Comparing agents? The same measurement for OpenAI&apos;s agent is in{" "}
          <Link href="/blog/codex-pricing">Codex pricing: plans vs measured spend</Link>.
        </p>

        <h2>Citing these numbers</h2>
        <p>
          The figures on this page regenerate hourly from live submissions. If you want them programmatically, the{" "}
          <Link href="/data">data page</Link> documents a free, unauthenticated JSON endpoint at{" "}
          <code>/api/stats</code>. Attribution to viberank.app is all we ask.
        </p>
      </article>
    </>
  );
}
