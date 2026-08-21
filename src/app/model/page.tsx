import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import { buildModelEconomics, publishableModels } from "@/lib/model-economics";
import { formatNumber } from "@/lib/utils";
import { usd, pct } from "@/lib/cost-benchmark";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const revalidate = 3600;

const SITE = "https://www.viberank.app";
const TITLE = "AI Model Economics — Real Spend Per Developer";
const DESC =
  "What each AI coding model actually costs the developers using it. Spend per developer, adoption, and share of total spend — measured from real sessions, not list prices.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "ai model cost comparison",
    "claude opus real cost",
    "gpt-5 real cost",
    "model spend per developer",
    "ai coding model economics",
  ],
  alternates: { canonical: `${SITE}/model` },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE}/model`,
    siteName: "Viberank",
    images: [
      `/api/og?title=${encodeURIComponent("Model economics")}&description=${encodeURIComponent("What each model costs the people using it")}`,
    ],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default async function ModelIndex() {
  let models: ReturnType<typeof buildModelEconomics> = [];
  try {
    const dataLayer = await getServerDataLayer();
    const site = await dataLayer.stats.getSiteStats();
    if (site) models = publishableModels(buildModelEconomics(site.modelSpend ?? [], site.models ?? []));
  } catch {
    // render the shell
  }

  const byPerDev = [...models].sort((a, b) => b.spendPerDeveloper - a.spendPerDeveloper);
  const max = byPerDev[0]?.spendPerDeveloper ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <p className="micro-label mb-3">Model economics</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          What each model costs the people using it
        </h1>
        <p className="text-muted max-w-2xl mb-8 leading-relaxed">
          Price-per-token tables tell you what a model charges. They can&apos;t tell you what it ends up costing,
          because that depends on what people reach for it to do. These figures are measured from real sessions
          submitted by developers who track their own usage.
        </p>

        {models.length > 0 ? (
          <>
            <div className="rounded-lg border border-border overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="micro-label bg-surface-1 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-normal">Model</th>
                    <th className="text-right px-4 py-2.5 font-normal">Per developer</th>
                    <th className="text-right px-4 py-2.5 font-normal hidden sm:table-cell">Developers</th>
                    <th className="text-right px-4 py-2.5 font-normal">Share of spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono">
                  {byPerDev.map((m) => (
                    <tr key={m.slug} className="hover:bg-surface-1 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/model/${m.slug}`} className="text-foreground hover:text-accent transition-colors">
                          {m.name}
                        </Link>
                        <span
                          className="block mt-1.5 h-1 rounded-full bg-accent/70"
                          style={{ width: `${Math.max(2, (m.spendPerDeveloper / max) * 100)}%` }}
                          aria-hidden="true"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right text-accent font-semibold align-top">
                        {usd(m.spendPerDeveloper)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted hidden sm:table-cell align-top">
                        {formatNumber(m.developers)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted align-top">{pct(m.spendShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Models with fewer than 20 observed developers are omitted — too few to say anything honest about.
              Method and a free JSON endpoint on the{" "}
              <Link href="/data" className="text-accent hover:underline">
                data page
              </Link>
              .
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-border p-10 text-center">
            <p className="text-sm text-muted">Model figures are temporarily unavailable.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
