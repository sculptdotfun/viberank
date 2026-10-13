import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import type { Submission } from "@/lib/data/types";
import type { BurnRow } from "@/lib/spend-curve";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TierBadge from "@/components/TierBadge";
import { formatNumber, formatCurrency, formatUsd, toolLabel } from "@/lib/utils";
import {
  COMPARE_FACTS,
  COMPARE_MATCHUPS,
  MIN_COHORT,
  buildMatchupStats,
  costSentence,
  matchupMetaTitle,
  matchupTitle,
  queryOrder,
  resolveMatchup,
  reversedTitle,
  searchLabel,
  whichToUse,
  type MatchupStats,
  type ToolCohort,
} from "@/lib/compare";

interface CompareParams {
  params: Promise<{ matchup: string }>;
}

const SITE = "https://www.viberank.app";

// Live usage numbers refresh hourly, same as the per-tool boards.
export const revalidate = 3600;

// Every matchup reads the same narrow submission rows. One fetch per hour is
// shared by all of them (and by generateMetadata + render), so building or
// revalidating the pages never pages through the table once per matchup.
const getCompareRows = unstable_cache(
  async (): Promise<BurnRow[]> => (await getServerDataLayer()).stats.getSpendRows(),
  ["compare-spend-rows"],
  { revalidate: 3600 }
);

async function loadMatchupStats(a: string, b: string): Promise<MatchupStats | null> {
  try {
    return buildMatchupStats(await getCompareRows(), a, b);
  } catch {
    return null;
  }
}

// Related long-form posts, by the tool they cover.
const RELATED_POSTS: Record<string, { href: string; label: string }> = {
  codex: { href: "/blog/codex-vs-claude-code-vs-gemini-cli", label: "Codex vs Claude Code vs Gemini CLI in depth" },
  gemini: { href: "/blog/codex-vs-claude-code-vs-gemini-cli", label: "Codex vs Claude Code vs Gemini CLI in depth" },
  cursor: { href: "/blog/cursor-vs-claude-code-vs-copilot", label: "Cursor vs Claude Code vs Copilot in depth" },
  copilot: { href: "/blog/cursor-vs-claude-code-vs-copilot", label: "Cursor vs Claude Code vs Copilot in depth" },
};

export function generateStaticParams() {
  return COMPARE_MATCHUPS.map((m) => ({ matchup: m.slug }));
}

export async function generateMetadata({ params }: CompareParams): Promise<Metadata> {
  const { matchup: slug } = await params;
  const resolved = resolveMatchup(decodeURIComponent(slug).toLowerCase());
  if (!resolved) return {};
  const { matchup } = resolved;
  const [first, second] = queryOrder(matchup);
  const a = searchLabel(first);
  const b = searchLabel(second);
  const stats = await loadMatchupStats(matchup.a, matchup.b);
  const title = matchupMetaTitle(matchup, stats?.developers ?? 0);
  const cost = stats ? costSentence(matchup, stats) : null;
  const description = cost
    ? `${matchupTitle(matchup)}, measured: ${cost}`
    : `${matchupTitle(matchup)} (or ${reversedTitle(matchup)}): measured monthly spend, tokens per day, overlap and pricing from developers' real ccusage data.`;
  const canonical = `${SITE}/compare/${matchup.slug}`;
  return {
    title,
    description,
    keywords: [
      `${a.toLowerCase()} vs ${b.toLowerCase()}`,
      `${b.toLowerCase()} vs ${a.toLowerCase()}`,
      `${a.toLowerCase()} or ${b.toLowerCase()}`,
      `${a.toLowerCase()} ${b.toLowerCase()} comparison`,
      `is ${a.toLowerCase()} better than ${b.toLowerCase()}`,
      `is ${a.toLowerCase()} cheaper than ${b.toLowerCase()}`,
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
        `/api/og?title=${encodeURIComponent(matchupTitle(matchup))}&description=${encodeURIComponent("Measured cost and usage from live ccusage data")}`,
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

function money(value: number | null): string {
  return value === null ? "—" : `${formatUsd(Math.round(value))}/mo`;
}

function MeasuredTable({ x, y, stats }: { x: ToolCohort; y: ToolCohort; stats: MatchupStats }) {
  const alsoX = x.tool === stats.a.tool ? stats.shareOfAUsingB : stats.shareOfBUsingA;
  const alsoY = y.tool === stats.a.tool ? stats.shareOfAUsingB : stats.shareOfBUsingA;
  const rows: { label: string; x: string; y: string }[] = [
    { label: "Developers measured", x: x.developers.toLocaleString(), y: y.developers.toLocaleString() },
    { label: "Median monthly spend (all tools)", x: money(x.medianMonthlyUsd), y: money(y.medianMonthlyUsd) },
    {
      label: "Median, single-tool devs",
      x: `${money(x.onlyMedianMonthlyUsd)} (n=${x.onlyDevelopers})`,
      y: `${money(y.onlyMedianMonthlyUsd)} (n=${y.onlyDevelopers})`,
    },
    {
      label: "Median tokens / day",
      x: x.medianTokensPerDay === null ? "—" : formatNumber(Math.round(x.medianTokensPerDay)),
      y: y.medianTokensPerDay === null ? "—" : formatNumber(Math.round(y.medianTokensPerDay)),
    },
    {
      label: "Also use the other",
      x: x.developers > 0 ? `${Math.round(alsoX * 100)}%` : "—",
      y: y.developers > 0 ? `${Math.round(alsoY * 100)}%` : "—",
    },
  ];
  return (
    <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="bg-surface-1 border-b border-border">
            <th className="text-left px-4 py-2.5 micro-label w-48"></th>
            <th className="text-left px-4 py-2.5 font-mono font-bold">{searchLabel(x.tool)}</th>
            <th className="text-left px-4 py-2.5 font-mono font-bold">{searchLabel(y.tool)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-4 py-3 micro-label">{r.label}</td>
              <td className="px-4 py-3 font-mono font-semibold text-accent">{r.x}</td>
              <td className="px-4 py-3 font-mono font-semibold text-accent">{r.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  // Columns, headings and copy follow search order ("Codex vs Claude Code");
  // the canonical slug keeps its original order so existing links hold.
  const [first, second] = queryOrder(matchup);
  const labelX = searchLabel(first);
  const labelY = searchLabel(second);
  const factsX = COMPARE_FACTS[first];
  const factsY = COMPARE_FACTS[second];

  let itemsX: Submission[] = [];
  let itemsY: Submission[] = [];
  let usersX = 0;
  let usersY = 0;
  try {
    const dataLayer = await getServerDataLayer();
    const [lbX, lbY, site] = await Promise.all([
      dataLayer.submissions.getLeaderboard({ sortBy: "cost", page: 0, pageSize: 10, tool: first }),
      dataLayer.submissions.getLeaderboard({ sortBy: "cost", page: 0, pageSize: 10, tool: second }),
      dataLayer.stats.getSiteStats(),
    ]);
    itemsX = lbX.items;
    itemsY = lbY.items;
    usersX = site?.tools.find((t) => t.tool === first)?.users ?? 0;
    usersY = site?.tools.find((t) => t.tool === second)?.users ?? 0;
  } catch {
    // render with static facts only
  }
  const stats = await loadMatchupStats(matchup.a, matchup.b);
  const cohortX = stats ? (first === matchup.a ? stats.a : stats.b) : null;
  const cohortY = stats ? (first === matchup.a ? stats.b : stats.a) : null;
  const verdict = stats ? whichToUse(matchup, stats) : [];
  const cost = stats ? costSentence(matchup, stats) : null;

  const topX = itemsX[0];
  const topY = itemsY[0];
  const title = matchupTitle(matchup);
  const reversed = reversedTitle(matchup);

  const faqs = [
    {
      q: `Is ${labelX} better than ${labelY}?`,
      a: `Neither wins across the board, and we don't publish benchmark scores we didn't run. What we can measure: ${
        usersX > 0 || usersY > 0
          ? `${labelX} has ${usersX.toLocaleString()} developers on the board and ${labelY} has ${usersY.toLocaleString()}`
          : "adoption, spend and overlap from live submissions"
      }${
        stats && stats.both > 0 ? `, and ${stats.both.toLocaleString()} developers use both` : ""
      }. Pick ${labelX} if ${factsX.pickIf}. Pick ${labelY} if ${factsY.pickIf}.`,
    },
    {
      q: `Is ${labelX} cheaper than ${labelY}?`,
      a: `On list price: ${labelX} is ${factsX.pricing.charAt(0).toLowerCase() + factsX.pricing.slice(1)}; ${labelY} is ${factsY.pricing.charAt(0).toLowerCase() + factsY.pricing.slice(1)}. ${
        cost ?? `Too few developers use only one of the two for a fair median cost comparison (we need at least ${MIN_COHORT} on each side).`
      } Run npx ccusage@latest daily to see what your own usage is worth.`,
    },
    {
      q: `${reversed}: which do developers actually use more?`,
      a: `On the Viberank leaderboard, ${usersX >= usersY ? labelX : labelY} currently has more developers submitting real usage data (${Math.max(usersX, usersY).toLocaleString()} vs ${Math.min(usersX, usersY).toLocaleString()}). Adoption shifts monthly — the numbers on this page update from live ccusage submissions.`,
    },
    {
      q: `Can I use both ${labelX} and ${labelY}?`,
      a: `Yes${
        stats && stats.both > 0 ? `: ${stats.both.toLocaleString()} developers on the board do` : ""
      }. ccusage reads local logs from every supported agent, and a single npx viberank-cli submission records your usage per tool, so your profile shows how your spend splits between them.`,
    },
    {
      q: `How is this comparison measured?`,
      a: `From developers who submit their ccusage data to Viberank: token counts and API-equivalent cost computed from local session logs, validated server-side. Each developer counts once (their largest submission), normalised to a 30-day month; submissions under 7 days are left out. Spend covers every tool the developer ran, so the single-tool rows are the cleanest read on one tool. Medians are hidden below ${MIN_COHORT} developers. It is what the usage would cost at list prices, not what anyone was billed.`,
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
      { "@type": "ListItem", position: 3, name: title, item: `${SITE}/compare/${matchup.slug}` },
    ],
  };

  const otherMatchups = COMPARE_MATCHUPS.filter((m) => m.slug !== matchup.slug);
  const related = RELATED_POSTS[first] ?? RELATED_POSTS[second] ?? RELATED_POSTS.codex;

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
          {title}: measured cost &amp; usage
        </h1>
        <p className="text-muted mb-8 max-w-2xl">
          {factsX.oneLiner} Versus: {factsY.oneLiner.charAt(0).toLowerCase() + factsY.oneLiner.slice(1)} Whether you
          searched {title} or {reversed}, this page compares them on what developers actually run:
          {stats && stats.developers > 0 ? ` ${stats.developers.toLocaleString()} developers'` : ""} monthly
          spend, tokens per day and overlap from{" "}
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

        {/* Measured: the data nobody else ranking for this query has */}
        {stats && cohortX && cohortY && stats.developers > 0 && (
          <section className="mb-10">
            <h2 className="font-mono text-xl font-bold tracking-tight mb-2">
              {title}, measured
            </h2>
            <p className="text-sm text-muted mb-4 max-w-2xl">
              API-equivalent spend per developer per month, one row per developer, normalised to 30 days. Spend
              covers every tool a developer runs; the single-tool row isolates one. Medians are hidden below{" "}
              {MIN_COHORT} developers. <Link href="/data" className="text-accent hover:underline">Methodology</Link>.
            </p>
            <MeasuredTable x={cohortX} y={cohortY} stats={stats} />
          </section>
        )}

        {/* Facts table */}
        <div className="rounded-lg border border-border overflow-hidden mb-10 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-surface-1 border-b border-border">
                <th className="text-left px-4 py-2.5 micro-label w-36"></th>
                <th className="text-left px-4 py-2.5 font-mono font-bold">{factsX.label}</th>
                <th className="text-left px-4 py-2.5 font-mono font-bold">{factsY.label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              <tr>
                <td className="px-4 py-3 micro-label">Maker</td>
                <td className="px-4 py-3">{factsX.provider}</td>
                <td className="px-4 py-3">{factsY.provider}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Pricing</td>
                <td className="px-4 py-3 text-muted">{factsX.pricing}</td>
                <td className="px-4 py-3 text-muted">{factsY.pricing}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Models</td>
                <td className="px-4 py-3 text-muted">{factsX.models}</td>
                <td className="px-4 py-3 text-muted">{factsY.models}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Devs on board</td>
                <td className="px-4 py-3 font-mono font-semibold text-accent">
                  {usersX > 0 ? usersX.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-accent">
                  {usersY > 0 ? usersY.toLocaleString() : "—"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 micro-label">Top spender</td>
                <td className="px-4 py-3 font-mono text-muted">
                  {topX ? `${formatUsd(topX.totalCost)} · ${formatNumber(topX.totalTokens)} tokens` : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-muted">
                  {topY ? `${formatUsd(topY.totalCost)} · ${formatNumber(topY.totalTokens)} tokens` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Which should you use? */}
        {verdict.length > 0 && (
          <section className="mb-10 max-w-3xl">
            <h2 className="font-mono text-xl font-bold tracking-tight mb-3">
              {labelX} or {labelY}: which should you use?
            </h2>
            <div className="space-y-3 text-sm text-muted">
              {verdict.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* Live boards side by side */}
        <div className="grid gap-6 lg:grid-cols-2 mb-10">
          <ToolBoard tool={first} items={itemsX} />
          <ToolBoard tool={second} items={itemsY} />
        </div>

        {/* CTA */}
        <div className="rounded-lg border border-accent/40 bg-surface-1 p-6 mb-12">
          <p className="font-medium mb-1">Where do you land?</p>
          <p className="text-sm text-muted mb-3">
            One command reads your local {labelX} and {labelY} logs and puts your real usage on the board — code and
            prompts never leave your machine.
          </p>
          <code className="font-mono text-accent text-sm">npx viberank-cli</code>
        </div>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="font-mono text-xl font-bold tracking-tight mb-4">{title} FAQ</h2>
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
            <Link href={related.href} className="text-accent hover:underline">
              {related.label}
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
