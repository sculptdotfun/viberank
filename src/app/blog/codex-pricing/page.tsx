import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";
import { getServerDataLayer } from "@/lib/data";
import {
  buildCostBenchmark,
  percentile,
  shareAbove,
  spendRowsForTool,
  usd,
  pct,
  MIN_PUBLISHABLE_COHORT,
  type CostBenchmark,
} from "@/lib/cost-benchmark";

// Measured figures should stay current without anyone editing the page.
export const revalidate = 3600;

const TITLE = "Codex Pricing (2026): Plans vs Measured Spend Per Developer";
const DESC =
  "Codex pricing in 2026: included with ChatGPT Plus ($20), Pro ($100–$500) and Business, or billed per token with an API key — next to the measured monthly spend of real Codex developers.";
const OG =
  "/api/og?title=Codex%20Pricing%20(2026)&description=Plans%20vs%20measured%20spend%20per%20developer";
const URL = "https://www.viberank.app/blog/codex-pricing";
const PUBLISHED = "2026-10-13T00:00:00.000Z";

// Verified against OpenAI's own pages on 2026-10-13. Plans and limits change
// often; re-check before editing, since these are quoted as fact.
const SOURCES = {
  plans: "https://learn.chatgpt.com/docs/pricing",
  api: "https://developers.openai.com/api/docs/pricing",
  dashboard: "https://chatgpt.com/codex/settings/usage",
} as const;

const PLANS = [
  { plan: "Free", price: "$0", codex: "GPT-6 Luna, subject to rollout" },
  { plan: "Go", price: "$8/mo", codex: "GPT-6 Luna, subject to rollout" },
  { plan: "Plus", price: "$20/mo", codex: "GPT-6.1 Sol and GPT-6 Luna; 5-hour and weekly limits" },
  { plan: "Pro", price: "$100, $200 or $500/mo", codex: "No five-hour limit currently" },
  {
    plan: "Business",
    price: "$25/user/mo ($20 billed annually, 2+ users)",
    codex: "Standard seats get the same limits as Plus",
  },
  { plan: "Enterprise & Edu", price: "Contact sales", codex: "Flexible pricing scales with credits" },
  { plan: "API key", price: "Per token", codex: "Billed at API rates, no plan limits" },
] as const;

const API_RATES = [
  { model: "GPT-6 Astra", input: "$10.00", cached: "$1.00", output: "$50.00" },
  { model: "GPT-6.1 Sol", input: "$2.00", cached: "$0.10", output: "$10.00" },
  { model: "GPT-6 Sol", input: "$2.00", cached: "$0.20", output: "$10.00" },
  { model: "GPT-6 Luna", input: "$0.10", cached: "$0.01", output: "$0.50" },
  { model: "GPT-5.3 Codex", input: "$1.75", cached: "$0.175", output: "$14.00" },
] as const;

const REPORTED = [10, 25, 50, 75, 90] as const;

interface CodexCohorts {
  /** Developers whose submissions used Codex and nothing else: cost is cleanly Codex's. */
  only: CostBenchmark;
  /** Anyone who used Codex, including alongside other agents. */
  includes: CostBenchmark;
}

async function loadCohorts(): Promise<CodexCohorts> {
  try {
    const dataLayer = await getServerDataLayer();
    const rows = await dataLayer.stats.getSpendRows();
    return {
      only: buildCostBenchmark(spendRowsForTool(rows, "codex", "only")),
      includes: buildCostBenchmark(spendRowsForTool(rows, "codex", "includes")),
    };
  } catch {
    return { only: buildCostBenchmark([]), includes: buildCostBenchmark([]) };
  }
}

const publishable = (b: CostBenchmark): boolean => b.cohortSize >= MIN_PUBLISHABLE_COHORT;

/** The single sentence an answer engine can lift. */
function codexClaim(cohorts: CodexCohorts): string {
  const plans =
    "Codex is included with ChatGPT Plus ($20/month), Pro ($100–$500/month) and Business ($25/user/month, $20 billed annually), or billed per token with an API key.";
  const primary = publishable(cohorts.only) ? cohorts.only : publishable(cohorts.includes) ? cohorts.includes : null;
  if (!primary) return plans;
  const who = primary === cohorts.only ? "Codex-only developers" : "developers who use Codex";
  return (
    `${plans} Measured across ${primary.cohortSize.toLocaleString("en-US")} ${who}, ` +
    `the median burns ${usd(primary.medianMonthlyUsd)}/month at API prices.`
  );
}

function cell(b: CostBenchmark, p: number): string {
  return publishable(b) ? usd(percentile(b, p)) : "—";
}

function SpendTable({ cohorts }: { cohorts: CodexCohorts }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Percentile</th>
          <th>Codex only ({cohorts.only.cohortSize.toLocaleString("en-US")} devs)</th>
          <th>Codex + other agents ({cohorts.includes.cohortSize.toLocaleString("en-US")} devs)</th>
        </tr>
      </thead>
      <tbody>
        {REPORTED.map((p) => (
          <tr key={p}>
            <td>{p === 50 ? <strong>median</strong> : `p${p}`}</td>
            <td>{p === 50 ? <strong>{cell(cohorts.only, p)}</strong> : cell(cohorts.only, p)}</td>
            <td>{cell(cohorts.includes, p)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "codex pricing",
    "codex price",
    "codex cost",
    "openai codex pricing",
    "codex cost per month",
    "codex api pricing",
    "chatgpt codex plans",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: "article",
    publishedTime: PUBLISHED,
    modifiedTime: PUBLISHED,
    authors: ["Viberank Team"],
    images: [{ url: OG, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG] },
};

export default async function Post() {
  const cohorts = await loadCohorts();
  const claim = codexClaim(cohorts);
  const hasData = publishable(cohorts.only) || publishable(cohorts.includes);
  const primary = publishable(cohorts.only) ? cohorts.only : cohorts.includes;

  const faqs = [
    { q: "How much does Codex cost?", a: claim },
    {
      q: "Is Codex free?",
      a: "ChatGPT Free and Go ($8/month) list GPT-6 Luna in Codex, subject to rollout. Plus at $20/month is the cheapest plan with the full Codex model lineup.",
    },
    {
      q: "What does Codex cost through the API?",
      a: "With an API key, Codex bills per token at API rates instead of plan limits. Per million tokens: GPT-6.1 Sol $2 input / $10 output, GPT-6 Astra $10 / $50, GPT-6 Luna $0.10 / $0.50, GPT-5.3 Codex $1.75 / $14.",
    },
    {
      q: "Where do I see my Codex usage and limits?",
      a: "In the Codex usage dashboard at chatgpt.com/codex/settings/usage, or with /status inside an active Codex CLI session.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: TITLE,
      description: claim,
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
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
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

        <h1>{TITLE}</h1>

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

        <div className="not-prose rounded-lg border border-accent/40 bg-surface-1 p-6 mb-10">
          <p className="text-lg text-foreground m-0 leading-relaxed">{claim}</p>
        </div>

        <h2>Codex plans and prices</h2>
        <p>
          OpenAI doesn&apos;t sell Codex on its own. It comes with a ChatGPT plan, or runs on an API key and bills
          per token:
        </p>
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Codex access</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((row) => (
              <tr key={row.plan}>
                <td>{row.plan}</td>
                <td>{row.price}</td>
                <td>{row.codex}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm">
          Source:{" "}
          <a href={SOURCES.plans} target="_blank" rel="noopener noreferrer">
            OpenAI Codex pricing
          </a>
          , checked October 2026. Plans that hit their limit can buy credits to keep going. The per-model message
          allowances are in{" "}
          <Link href="/blog/how-to-check-codex-usage#codex-usage-limits">Codex usage limits</Link>.
        </p>

        <h2>Codex API pricing</h2>
        <p>With an API key, Codex bills at OpenAI&apos;s standard API rates, per million tokens:</p>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Input</th>
              <th>Cached input</th>
              <th>Output</th>
            </tr>
          </thead>
          <tbody>
            {API_RATES.map((row) => (
              <tr key={row.model}>
                <td>{row.model}</td>
                <td>{row.input}</td>
                <td>{row.cached}</td>
                <td>{row.output}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm">
          Source:{" "}
          <a href={SOURCES.api} target="_blank" rel="noopener noreferrer">
            OpenAI API pricing
          </a>{" "}
          (Standard tier, prompts up to 272K tokens), checked October 2026.
        </p>

        <h2>What Codex developers really spend per month</h2>
        {hasData ? (
          <>
            <p>
              A plan price caps what you pay; it says nothing about how much you use. This is measured monthly
              API-equivalent spend per developer, computed by{" "}
              <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer">
                ccusage
              </a>{" "}
              from Codex&apos;s local session logs and submitted to Viberank, one row per person:
            </p>
            <SpendTable cohorts={cohorts} />
            <p>
              The &ldquo;Codex only&rdquo; column is the clean one: those developers used no other agent, so every
              dollar is Codex. The second column includes people who also run Claude Code or other tools, and a
              submission&apos;s cost isn&apos;t split by agent, so it overstates Codex&apos;s share. Cohorts under{" "}
              {MIN_PUBLISHABLE_COHORT} developers show &ldquo;—&rdquo;.
            </p>
            <p>
              At the median, that is {usd(primary.medianMonthlyUsd)} of API-priced usage a month, against $20 for
              Plus. {pct(shareAbove(primary, 250))} of this cohort burn more than $250 a month at API rates, which is
              more than even the $200 Pro plan costs.
            </p>
          </>
        ) : (
          <p>
            Live figures are temporarily unavailable. The current Codex board is at{" "}
            <Link href="/tool/codex">/tool/codex</Link>.
          </p>
        )}

        <h2>How to read these numbers</h2>
        <ul>
          <li>
            They are API-equivalent cost from local logs, not amounts billed. On a ChatGPT plan your marginal cost
            is $0 until you hit a limit; this is what the same usage would cost at API prices.
          </li>
          <li>
            The population self-selects: developers who chose to measure and publish their usage skew heavier than
            the average Codex user.
          </li>
          <li>
            One row per developer (their highest-cost submission), normalised to 30 days. Submissions under 7 days
            are excluded.
          </li>
        </ul>

        <h2>Check your own</h2>
        <p>
          Your plan&apos;s remaining limits are in the{" "}
          <a href={SOURCES.dashboard} target="_blank" rel="noopener noreferrer">
            Codex usage dashboard
          </a>{" "}
          or <code>/status</code> in the CLI (full walkthrough:{" "}
          <Link href="/blog/how-to-check-codex-usage">how to check Codex usage</Link>). For dollars, run ccusage,
          then put the result on the <Link href="/tool/codex">Codex leaderboard</Link> to see where you land:
        </p>
        <pre>
          <code>npx viberank-cli</code>
        </pre>
        <p>
          Weighing Codex against Anthropic&apos;s agent? Same method, bigger cohort:{" "}
          <Link href="/blog/how-much-does-claude-code-cost">Claude Code pricing vs real spend</Link>, and the
          head-to-head in <Link href="/blog/codex-vs-claude-code-vs-gemini-cli">Codex vs Claude Code vs Gemini CLI</Link>.
        </p>

        <h2>FAQ</h2>
        {faqs.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </article>
    </>
  );
}
