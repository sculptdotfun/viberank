import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import type { Submission } from "@/lib/data/types";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TierBadge from "@/components/TierBadge";
import { formatNumber, formatCurrency, formatUsd, toolLabel } from "@/lib/utils";
import { COMPARE_FACTS, COMPARE_MATCHUPS, resolveMatchup, matchupTitle, compareLabel } from "@/lib/compare";

interface CompareParams {
  params: Promise<{ matchup: string }>;
}

const SITE = "https://www.viberank.app";

// Live usage numbers refresh hourly, same as the per-tool boards.
export const revalidate = 3600;

export function generateStaticParams() {
  return COMPARE_MATCHUPS.map((m) => ({ matchup: m.slug }));
}

export async function generateMetadata({ params }: CompareParams): Promise<Metadata> {
  const { matchup: slug } = await params;
  const resolved = resolveMatchup(decodeURIComponent(slug).toLowerCase());
  if (!resolved) return {};
  const { matchup } = resolved;
  const a = compareLabel(matchup.a);
  const b = compareLabel(matchup.b);
  const title = `${a} vs ${b} (2026): Real Usage, Cost & Adoption Compared | Viberank`;
  const description = `${a} or ${b}? Compare pricing, models, and real adoption — developer counts, top spenders, and API-equivalent cost from live ccusage data on the Viberank leaderboard.`;
  const canonical = `${SITE}/compare/${matchup.slug}`;
  return {
    title,
    description,
    keywords: [
      `${a.toLowerCase()} vs ${b.toLowerCase()}`,
      `${b.toLowerCase()} vs ${a.toLowerCase()}`,
      `${a.toLowerCase()} or ${b.toLowerCase()}`,
      `${a.toLowerCase()} ${b.toLowerCase()} comparison`,
      "ai coding tools compared",
      "ccusage",
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Viberank",
      type: "website",
      images: [
        `/api/og?title=${encodeURIComponent(`${a} vs ${b}`)}&description=${encodeURIComponent("Real usage, cost and adoption from live ccusage data")}`,
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function ToolBoard({ tool, items }: { tool: string; items: Submission[] }) {
  const label = toolLabel(tool);
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-1 border-b border-border">
        <span className="micro-label">Top {label} spenders</span>
        <Link href={`/tool/${tool}`} className="text-xs text-accent hover:underline">
          Full board →
        </Link>
      </div>
      {items.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {items.map((s, i) => (
            <Link
              key={s.id}
              href={`/profile/${encodeURIComponent(s.githubUsername || s.username)}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-1 transition-colors group"
            >
              <div className="w-6 text-center text-sm font-mono text-muted">{i + 1}</div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                  {s.githubUsername || s.username}
                </span>
                {s.verified && <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />}
              </div>
              <div className="hidden sm:block w-20 flex-shrink-0">
                <TierBadge totalCost={s.totalCost} size="xs" bare />
              </div>
              <div className="w-24 text-right text-sm font-mono font-semibold text-accent">
                ${formatCurrency(s.totalCost)}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-6 text-sm text-muted text-center">
          No {label} submissions yet — be the first with{" "}
          <code className="font-mono text-accent">npx viberank-cli</code>
        </p>
      )}
    </div>
  );
}

export default async function ComparePage({ params }: CompareParams) {
  const { matchup: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).toLowerCase();
  const resolved = resolveMatchup(slug);
  if (!resolved) notFound();
  if (!resolved.canonical) permanentRedirect(`/compare/${resolved.matchup.slug}`);

  const { matchup } = resolved;
  const labelA = compareLabel(matchup.a);
  const labelB = compareLabel(matchup.b);
  const factsA = COMPARE_FACTS[matchup.a];
  const factsB = COMPARE_FACTS[matchup.b];

  let itemsA: Submission[] = [];
  let itemsB: Submission[] = [];
  let usersA = 0;
  let usersB = 0;
  try {
    const dataLayer = await getServerDataLayer();
    const [lbA, lbB, site] = await Promise.all([
      dataLayer.submissions.getLeaderboard({ sortBy: "cost", page: 0, pageSize: 10, tool: matchup.a }),
      dataLayer.submissions.getLeaderboard({ sortBy: "cost", page: 0, pageSize: 10, tool: matchup.b }),
      dataLayer.stats.getSiteStats(),
    ]);
    itemsA = lbA.items;
    itemsB = lbB.items;
    usersA = site?.tools.find((t) => t.tool === matchup.a)?.users ?? 0;
    usersB = site?.tools.find((t) => t.tool === matchup.b)?.users ?? 0;
  } catch {
    // render with static facts only
  }

  const topA = itemsA[0];
  const topB = itemsB[0];

  const faqs = [
    {
      q: `${labelA} vs ${labelB}: which do developers actually use more?`,
      a: `On the Viberank leaderboard, ${usersA >= usersB ? labelA : labelB} currently has more developers submitting real usage data (${Math.max(usersA, usersB).toLocaleString()} vs ${Math.min(usersA, usersB).toLocaleString()}). Adoption shifts monthly — the numbers on this page update from live ccusage submissions.`,
    },
    {
      q: `Is ${labelA} or ${labelB} cheaper?`,
      a: `${labelA}: ${factsA.pricing}. ${labelB}: ${factsB.pricing}. The real answer depends on your volume — heavy agentic use can be worth thousands per month at API-equivalent prices, which is what makes flat-rate subscriptions such an arbitrage. Run npx ccusage@latest daily to see your own numbers.`,
    },
    {
      q: `Can I use both ${labelA} and ${labelB}?`,
      a: `Yes — many developers on the board do. ccusage reads local logs from every supported agent, and a single npx viberank-cli submission records your usage per tool, so your profile shows exactly how your spend splits between them.`,
    },
    {
      q: `How is this comparison measured?`,
      a: `Numbers come from developers who submit their ccusage data to Viberank — real token counts and API-equivalent costs computed from local session logs, validated server-side. It measures actual usage, not marketing claims.`,
    },
  ];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Leaderboard", item: SITE },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE}/compare` },
      { "@type": "ListItem", position: 3, name: matchupTitle(matchup), item: `${SITE}/compare/${matchup.slug}` },
    ],
  };

  const otherMatchups = COMPARE_MATCHUPS.filter((m) => m.slug !== matchup.slug);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbLd, faqLd]) }}
      />

      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/compare" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          All comparisons
        </Link>

        <p className="micro-label mb-3">Head to head</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          {labelA} vs {labelB}
        </h1>
        <p className="text-muted mb-8 max-w-2xl">
          {factsA.oneLiner} Versus: {factsB.oneLiner.charAt(0).toLowerCase() + factsB.oneLiner.slice(1)}{" "}
          Below: how they compare on the facts, and on real usage from{" "}
          <a
            href="https://github.com/ryoppippi/ccusage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ccusage
          </a>{" "}
          data submitted to the leaderboard.
        </p>

        {/* Facts table */}
        <div className="rounded-lg border border-border overflow-hidden mb-10 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-surface-1 border-b border-border">
                <th className="text-left px-4 py-2.5 micro-label w-36"></th>
                <th className="text-left px-4 py-2.5 font-mono font-bold">{labelA}</th>
                <th className="text-left px-4 py-2.5 font-mono font-bold">{labelB}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr>
                <td className="px-4 py-3 micro-label">Maker</td>
                <td className="px-4 py-3">{factsA.provider}</td>
                <td className="px-4 py-3">{factsB.provider}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Pricing</td>
                <td className="px-4 py-3 text-muted">{factsA.pricing}</td>
                <td className="px-4 py-3 text-muted">{factsB.pricing}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Models</td>
                <td className="px-4 py-3 text-muted">{factsA.models}</td>
                <td className="px-4 py-3 text-muted">{factsB.models}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Devs on board</td>
                <td className="px-4 py-3 font-mono font-semibold text-accent">
                  {usersA > 0 ? usersA.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-accent">
                  {usersB > 0 ? usersB.toLocaleString() : "—"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Top spender</td>
                <td className="px-4 py-3 font-mono text-muted">
                  {topA ? `${formatUsd(topA.totalCost)} · ${formatNumber(topA.totalTokens)} tokens` : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-muted">
                  {topB ? `${formatUsd(topB.totalCost)} · ${formatNumber(topB.totalTokens)} tokens` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Live boards side by side */}
        <div className="grid gap-6 lg:grid-cols-2 mb-10">
          <ToolBoard tool={matchup.a} items={itemsA} />
          <ToolBoard tool={matchup.b} items={itemsB} />
        </div>

        {/* CTA */}
        <div className="rounded-lg border border-accent/40 bg-surface-1 p-6 mb-12">
          <p className="font-medium mb-1">Where do you land?</p>
          <p className="text-sm text-muted mb-3">
            One command reads your local {labelA} and {labelB} logs and puts your real usage on the board — code and
            prompts never leave your machine.
          </p>
          <code className="font-mono text-accent text-sm">npx viberank-cli</code>
        </div>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="font-mono text-xl font-bold tracking-tight mb-4">
            {labelA} vs {labelB} FAQ
          </h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-lg border border-border bg-surface-1 p-4">
                <h3 className="font-medium mb-1.5">{f.q}</h3>
                <p className="text-sm text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* More comparisons + related reading */}
        <section className="mb-4">
          <h2 className="micro-label mb-3">More comparisons</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {otherMatchups.map((m) => (
              <Link
                key={m.slug}
                href={`/compare/${m.slug}`}
                className="px-2.5 py-1 rounded-md border bg-surface-1 border-border text-sm text-muted hover:text-foreground transition-colors"
              >
                {matchupTitle(m)}
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted">
            Related reading:{" "}
            <Link href="/blog/codex-vs-claude-code-vs-gemini-cli" className="text-accent hover:underline">
              Codex vs Claude Code vs Gemini CLI in depth
            </Link>
            {", "}
            <Link href="/blog/how-much-does-claude-code-cost" className="text-accent hover:underline">
              what Claude Code actually costs
            </Link>
            {", or "}
            <Link href="/calculator" className="text-accent hover:underline">
              which subscription your usage justifies
            </Link>
            .
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
}
