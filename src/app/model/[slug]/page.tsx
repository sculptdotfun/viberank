import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, DollarSign, TrendingUp } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import {
  buildModelEconomics,
  publishableModels,
  usageProfile,
  type ModelEconomics,
} from "@/lib/model-economics";
import { formatNumber } from "@/lib/utils";
import { usd, pct } from "@/lib/cost-benchmark";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const revalidate = 3600;

const SITE = "https://www.viberank.app";

interface Params {
  params: Promise<{ slug: string }>;
}

async function loadModels(): Promise<ModelEconomics[]> {
  try {
    const dataLayer = await getServerDataLayer();
    const site = await dataLayer.stats.getSiteStats();
    if (!site) return [];
    return buildModelEconomics(site.modelSpend ?? [], site.models ?? []);
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  return publishableModels(await loadModels()).map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const all = await loadModels();
  const model = all.find((m) => m.slug === slug);
  if (!model) return {};

  const title = `${model.name} — What Developers Actually Spend`;
  const description =
    model.developers > 0
      ? `${model.developers} developers on viberank used ${model.name}, spending ${usd(model.spendPerDeveloper)} each on average — ${pct(model.spendShare)} of all tracked AI coding spend. Measured from real usage, not list prices.`
      : `Real observed spend on ${model.name} across developers who measure their own AI coding usage.`;

  return {
    title,
    description,
    keywords: [
      `${model.name} cost`,
      `${model.name} real cost`,
      `${model.name} spend`,
      `${model.name} token usage`,
      `how much does ${model.name} cost`,
      "ai coding cost",
    ],
    alternates: { canonical: `${SITE}/model/${model.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE}/model/${model.slug}`,
      siteName: "Viberank",
      images: [
        `/api/og?title=${encodeURIComponent(model.name)}&description=${encodeURIComponent("What developers actually spend")}`,
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ModelPage({ params }: Params) {
  const { slug } = await params;
  const all = await loadModels();
  const model = all.find((m) => m.slug === slug);
  if (!model) notFound();

  const publishable = publishableModels(all);
  const profile = usageProfile(model, all);
  const rankBySpend = all.filter((m) => m.spendUsd > model.spendUsd).length + 1;
  const peers = publishable.filter((m) => m.slug !== model.slug).slice(0, 8);
  const cheapest = [...publishable].sort((a, b) => a.spendPerDeveloper - b.spendPerDeveloper)[0];
  const priciest = [...publishable].sort((a, b) => b.spendPerDeveloper - a.spendPerDeveloper)[0];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${model.name} observed spend`,
      description: `API-equivalent spend and developer adoption for ${model.name}, measured from real usage submitted to Viberank.`,
      url: `${SITE}/model/${model.slug}`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: "Viberank", url: SITE },
      distribution: [
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/api/stats` },
      ],
      variableMeasured: [
        { "@type": "PropertyValue", name: "Spend per developer", value: Math.round(model.spendPerDeveloper), unitCode: "USD" },
        { "@type": "PropertyValue", name: "Developers observed", value: model.developers },
        { "@type": "PropertyValue", name: "Share of tracked spend", value: Number((model.spendShare * 100).toFixed(1)), unitText: "PERCENT" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Leaderboard", item: SITE },
        { "@type": "ListItem", position: 2, name: "Model economics", item: `${SITE}/model` },
        { "@type": "ListItem", position: 3, name: model.name, item: `${SITE}/model/${model.slug}` },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <NavBar />

      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/model"
          className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Model economics
        </Link>

        <p className="micro-label mb-3">Observed spend</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-3">{model.name}</h1>
        <p className="text-muted max-w-2xl mb-8 leading-relaxed">
          What developers actually spend on {model.name} — measured from real sessions, not list prices. For specs
          and pricing tables, look elsewhere; this page only answers what the model costs the people using it.
        </p>

        {/* Headline economics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden mb-8">
          <div className="bg-surface-1 p-5">
            <div className="micro-label mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" /> Per developer
            </div>
            <div className="font-mono text-2xl font-bold text-accent">{usd(model.spendPerDeveloper)}</div>
            <div className="text-xs text-muted mt-1">across their tracked usage</div>
          </div>
          <div className="bg-surface-1 p-5">
            <div className="micro-label mb-1.5 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Developers
            </div>
            <div className="font-mono text-2xl font-bold text-foreground">{formatNumber(model.developers)}</div>
            <div className="text-xs text-muted mt-1">observed using it</div>
          </div>
          <div className="bg-surface-1 p-5">
            <div className="micro-label mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Share of spend
            </div>
            <div className="font-mono text-2xl font-bold text-foreground">{pct(model.spendShare)}</div>
            <div className="text-xs text-muted mt-1">#{rankBySpend} of all models tracked</div>
          </div>
        </div>

        {/* What the numbers say */}
        <section className="rounded-lg border border-border bg-surface-1 p-5 mb-10">
          <h2 className="font-mono text-base font-semibold tracking-tight mb-2">{profile.label}</h2>
          <p className="text-sm text-muted m-0 leading-relaxed">{profile.blurb}</p>
          {cheapest && priciest && cheapest.slug !== priciest.slug && (
            <p className="text-sm text-muted mt-3 mb-0 leading-relaxed">
              For scale, spend per developer across tracked models runs from{" "}
              <Link href={`/model/${cheapest.slug}`} className="text-accent hover:underline">
                {cheapest.name}
              </Link>{" "}
              at {usd(cheapest.spendPerDeveloper)} to{" "}
              <Link href={`/model/${priciest.slug}`} className="text-accent hover:underline">
                {priciest.name}
              </Link>{" "}
              at {usd(priciest.spendPerDeveloper)} — a spread list pricing alone never reveals, because it depends
              entirely on what people reach for the model to do.
            </p>
          )}
        </section>

        {/* Peer comparison */}
        {peers.length > 0 && (
          <section className="mb-10">
            <h2 className="font-mono text-lg font-bold tracking-tight mb-4">Against other models</h2>
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="micro-label bg-surface-1 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-normal">Model</th>
                    <th className="text-right px-4 py-2.5 font-normal">Per developer</th>
                    <th className="text-right px-4 py-2.5 font-normal hidden sm:table-cell">Developers</th>
                    <th className="text-right px-4 py-2.5 font-normal">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono">
                  <tr className="bg-accent-soft">
                    <td className="px-4 py-2.5 text-accent font-bold">{model.name}</td>
                    <td className="px-4 py-2.5 text-right text-accent font-bold">{usd(model.spendPerDeveloper)}</td>
                    <td className="px-4 py-2.5 text-right text-muted hidden sm:table-cell">
                      {formatNumber(model.developers)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">{pct(model.spendShare)}</td>
                  </tr>
                  {peers.map((m) => (
                    <tr key={m.slug} className="hover:bg-surface-1 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/model/${m.slug}`} className="text-foreground hover:text-accent transition-colors">
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-foreground">{usd(m.spendPerDeveloper)}</td>
                      <td className="px-4 py-2.5 text-right text-muted hidden sm:table-cell">
                        {formatNumber(m.developers)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted">{pct(m.spendShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Method */}
        <section className="mb-10">
          <h2 className="font-mono text-lg font-bold tracking-tight mb-3">How this is measured</h2>
          <p className="text-sm text-muted max-w-2xl leading-relaxed mb-3">
            Developers run <code className="font-mono text-accent">npx viberank-cli</code>, which reads token
            counts and API-equivalent costs that ccusage computes from their own local session logs. Spend here is
            what the usage would cost at model list prices — most people on the board pay a flat subscription
            instead, so this measures consumption rather than a bill.
          </p>
          {model.variants.length > 1 && (
            <p className="text-sm text-muted max-w-2xl leading-relaxed mb-3">
              Folded from {model.variants.length} raw identifiers:{" "}
              <span className="font-mono text-xs">{model.variants.join(", ")}</span> — the same model reached
              through different harnesses.
            </p>
          )}
          <p className="text-sm text-muted max-w-2xl leading-relaxed">
            Full methodology, caveats and a free JSON endpoint are on the{" "}
            <Link href="/data" className="text-accent hover:underline">
              data page
            </Link>
            . For the distribution across developers rather than models, see{" "}
            <Link href="/blog/how-much-does-claude-code-cost" className="text-accent hover:underline">
              what Claude Code actually costs
            </Link>
            .
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
}
