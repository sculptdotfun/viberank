import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Database, Quote, Code2 } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import {
  buildCostBenchmark,
  headlineClaim,
  percentile,
  shareAbove,
  usd,
  pct,
  CAVEATS,
} from "@/lib/cost-benchmark";
import { formatNumber } from "@/lib/utils";
import CitationBlock from "./CitationBlock";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const revalidate = 3600;

const SITE = "https://www.viberank.app";
const TITLE = "AI Coding Usage Data — Free, Cited, Updated Hourly";
const DESC =
  "The open dataset behind viberank: real API-equivalent spend and token usage from developers who measure their own AI coding. Free JSON endpoint, CC BY 4.0, no key required.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "ai coding usage dataset",
    "claude code spend data",
    "ai coding cost data",
    "token usage dataset",
    "developer ai spend statistics",
  ],
  alternates: { canonical: `${SITE}/data` },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE}/data`,
    siteName: "Viberank",
    images: [
      `/api/og?title=${encodeURIComponent("AI coding usage data")}&description=${encodeURIComponent("Free, cited, updated hourly")}`,
    ],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default async function DataPage() {
  let benchmark = buildCostBenchmark([]);
  let totals: { developers: number; cost: number; tokens: number; cacheShare: number } | null = null;

  try {
    const dataLayer = await getServerDataLayer();
    const [site, rows] = await Promise.all([
      dataLayer.stats.getSiteStats(),
      dataLayer.stats.getSpendRows(),
    ]);
    benchmark = buildCostBenchmark(rows);
    if (site) totals = {
      developers: site.totalUsers,
      cost: site.totalCost,
      tokens: site.totalTokens,
      cacheShare: site.totalTokens > 0 ? site.cacheReadTokens / site.totalTokens : 0,
    };
  } catch {
    // render the documentation even if the aggregates hiccup
  }

  const hasData = benchmark.cohortSize > 0;
  const accessed = new Date().toISOString().slice(0, 10);
  const citation = `Viberank, "AI coding usage data", ${SITE}/data (accessed ${accessed})`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Viberank AI coding usage data",
    description:
      "API-equivalent spend and token usage per developer across Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot, OpenCode and other coding agents, measured by ccusage from local session logs and submitted voluntarily.",
    url: `${SITE}/data`,
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: "Viberank", url: SITE },
    keywords: ["AI coding", "token usage", "developer spend", "Claude Code", "Codex", "ccusage"],
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${SITE}/api/stats`,
      },
    ],
    ...(hasData
      ? {
          variableMeasured: [
            {
              "@type": "PropertyValue",
              name: "Median monthly API-equivalent spend per developer",
              value: Math.round(benchmark.medianMonthlyUsd),
              unitCode: "USD",
            },
            {
              "@type": "PropertyValue",
              name: "Developers measured",
              value: benchmark.cohortSize,
            },
          ],
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <NavBar />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <p className="micro-label mb-3">Open data</p>
        <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground mb-3">
          AI coding usage data
        </h1>
        <p className="text-muted max-w-2xl mb-8 leading-relaxed">
          Most published figures for what AI coding costs are vendor estimates. These are measurements — token
          counts and API-equivalent costs computed by ccusage from developers&apos; own local session logs, then
          submitted here. Free to use, CC BY 4.0, no key required.
        </p>

        {hasData && (
          <div className="rounded-lg border border-accent/40 bg-surface-1 p-5 mb-10">
            <p className="text-foreground m-0 leading-relaxed">{headlineClaim(benchmark)}</p>
          </div>
        )}

        {/* Key figures */}
        {totals && (
          <section className="mb-12">
            <h2 className="font-mono text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-accent" />
              Key figures
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
              {[
                { label: "Developers", value: formatNumber(totals.developers) },
                { label: "Tracked spend", value: `$${formatNumber(Math.round(totals.cost))}` },
                { label: "Tokens", value: formatNumber(totals.tokens) },
                { label: "Cache reads", value: pct(totals.cacheShare) },
              ].map((s) => (
                <div key={s.label} className="bg-surface-1 p-4">
                  <div className="micro-label mb-1.5">{s.label}</div>
                  <div className="font-mono text-xl font-bold text-foreground">{s.value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Distribution */}
        {hasData && (
          <section className="mb-12">
            <h2 className="font-mono text-lg font-bold tracking-tight mb-4">
              Monthly spend per developer
            </h2>
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="micro-label bg-surface-1 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-normal">Percentile</th>
                    <th className="text-right px-4 py-2.5 font-normal">API-equivalent / month</th>
                    <th className="text-right px-4 py-2.5 font-normal hidden sm:table-cell">Share above</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono">
                  {[10, 25, 50, 75, 90, 99].map((p, i) => {
                    const thresholds = [150, 250, 400, 1000];
                    const t = thresholds[i];
                    return (
                      <tr key={p}>
                        <td className="px-4 py-2.5 text-muted">{p === 50 ? "median" : `p${p}`}</td>
                        <td
                          className={`px-4 py-2.5 text-right ${p === 50 ? "text-accent font-bold" : "text-foreground"}`}
                        >
                          {usd(percentile(benchmark, p))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted hidden sm:table-cell">
                          {t ? `${pct(shareAbove(benchmark, t))} above $${t}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted mt-3">
              n = {benchmark.cohortSize.toLocaleString("en-US")} developers · mean{" "}
              {usd(benchmark.meanMonthlyUsd)} · top decile holds {pct(benchmark.topDecileShareOfSpend)} of all
              tracked spend
            </p>
          </section>
        )}

        {/* API */}
        <section className="mb-12">
          <h2 className="font-mono text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent" />
            API
          </h2>
          <p className="text-muted text-sm mb-4 max-w-2xl">
            One endpoint, no authentication, CORS open, refreshed hourly. Returns site totals, the full spend
            distribution, per-tool and per-model breakdowns, and a monthly series.
          </p>
          <div className="rounded-lg border border-border bg-surface-1 p-4 mb-4 overflow-x-auto">
            <code className="font-mono text-sm text-accent whitespace-pre">
              curl https://www.viberank.app/api/stats
            </code>
          </div>
          <p className="text-muted text-sm max-w-2xl">
            Every response carries a <code className="font-mono text-accent">meta.citation</code> string and the
            methodology caveats below, so anything you publish from it can be attributed without extra work.
          </p>
        </section>

        {/* Citation */}
        <section className="mb-12">
          <h2 className="font-mono text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
            <Quote className="w-4 h-4 text-accent" />
            Cite this
          </h2>
          <CitationBlock citation={citation} />
          <p className="text-muted text-sm max-w-2xl">
            Licensed <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">CC BY 4.0</a>{" "}
            — use it commercially, republish the charts, quote the medians. Attribution to viberank.app is the only
            condition. If you&apos;re writing about AI coding costs and want a cut of the data we don&apos;t
            publish here, ask.
          </p>
        </section>

        {/* Methodology */}
        <section className="mb-12">
          <h2 className="font-mono text-lg font-bold tracking-tight mb-4">Methodology and limits</h2>
          <ul className="space-y-3 text-sm text-muted max-w-2xl">
            {CAVEATS.map((c) => (
              <li key={c} className="flex gap-3">
                <span className="text-accent flex-shrink-0">—</span>
                <span>{c}</span>
              </li>
            ))}
            <li className="flex gap-3">
              <span className="text-accent flex-shrink-0">—</span>
              <span>
                Submissions are validated server-side; only aggregate totals are accepted, never code or prompts.
                Accounts signed in with GitHub carry a verified badge.
              </span>
            </li>
          </ul>
        </section>

        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <p className="text-sm text-muted m-0">
            Related: the <Link href="/blog/how-much-does-claude-code-cost" className="text-accent hover:underline">full cost write-up</Link>,{" "}
            <Link href="/stats" className="text-accent hover:underline">site-wide stats</Link>, and{" "}
            <Link href="/stats/monthly" className="text-accent hover:underline">monthly reports</Link>.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
