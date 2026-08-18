import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, DollarSign, Users, Cpu, CalendarDays, Gauge, TrendingUp } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import type { MonthStats } from "@/lib/data/types";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { formatNumber, formatUsd, toolLabel, prettyModelName } from "@/lib/utils";

interface MonthParams {
  params: Promise<{ month: string }>;
}

const SITE = "https://www.viberank.app";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Reports for closed months never change; the current month updates hourly.
export const revalidate = 3600;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const getMonth = cache(async (month: string): Promise<MonthStats | null> => {
  try {
    const dataLayer = await getServerDataLayer();
    return await dataLayer.stats.getMonthStats(month);
  } catch {
    return null;
  }
});

export function generateStaticParams() {
  // Prerender the last three months; older months build on demand and stick
  // (their data no longer changes).
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return [current, shiftMonth(current, -1), shiftMonth(current, -2)].map((month) => ({ month }));
}

export async function generateMetadata({ params }: MonthParams): Promise<Metadata> {
  const { month: raw } = await params;
  const month = decodeURIComponent(raw);
  if (!/^\d{4}-\d{2}$/.test(month)) return {};
  const stats = await getMonth(month);
  const label = monthLabel(month);
  const title = stats && stats.users > 0
    ? `AI Coding Spend Report ${label}: ${formatUsd(Math.round(stats.cost))} Across ${stats.users} Developers | Viberank`
    : `AI Coding Spend Report ${label} | Viberank`;
  const description = stats && stats.users > 0
    ? `${label} on the Viberank leaderboard: ${formatUsd(Math.round(stats.cost))} in API-equivalent AI coding spend, ${formatNumber(stats.tokens)} tokens, median developer at ${formatUsd(Math.round(stats.medianUserCost))}. Per-tool and per-model breakdowns from real ccusage data.`
    : `Monthly AI coding usage report for ${label} from the Viberank leaderboard.`;
  const canonical = `${SITE}/stats/monthly/${month}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Viberank",
      type: "article",
      images: [
        `/api/og?title=${encodeURIComponent(`AI coding spend — ${label}`)}&description=${encodeURIComponent(
          stats && stats.users > 0
            ? `${formatUsd(Math.round(stats.cost))} tracked across ${stats.users} developers`
            : "Monthly report from the Viberank leaderboard"
        )}`,
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <p className="flex items-center gap-1.5 micro-label mb-1">
        {icon}
        {label}
      </p>
      <p className="font-mono text-xl font-bold text-foreground m-0">{value}</p>
      {sub && <p className="text-xs text-muted mt-1 mb-0">{sub}</p>}
    </div>
  );
}

export default async function MonthReportPage({ params }: MonthParams) {
  const { month: raw } = await params;
  const month = decodeURIComponent(raw);
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const stats = await getMonth(month);
  if (!stats || stats.users === 0) notFound();

  const label = monthLabel(month);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const isCurrent = month === currentMonth;
  const hasNext = next <= currentMonth;
  const cacheShare = stats.tokens > 0 ? Math.round((stats.cacheReadTokens / stats.tokens) * 100) : 0;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `AI coding usage — ${label} (Viberank)`,
      description: `Aggregated AI coding usage for ${label}: ${formatUsd(Math.round(stats.cost))} API-equivalent spend and ${formatNumber(stats.tokens)} tokens across ${stats.users} developers, measured from local ccusage logs of Claude Code, Codex, Gemini CLI and other agents.`,
      url: `${SITE}/stats/monthly/${month}`,
      creator: { "@type": "Organization", name: "Viberank", url: SITE },
      temporalCoverage: month,
      license: "https://opensource.org/licenses/MIT",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Stats", item: `${SITE}/stats` },
        { "@type": "ListItem", position: 2, name: "Monthly reports", item: `${SITE}/stats/monthly` },
        { "@type": "ListItem", position: 3, name: label, item: `${SITE}/stats/monthly/${month}` },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/stats/monthly" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          All monthly reports
        </Link>

        <p className="micro-label mb-3">Monthly report{isCurrent ? " · updating live" : ""}</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          AI coding spend — {label}
        </h1>
        <p className="text-muted mb-8 max-w-2xl">
          What {stats.users.toLocaleString()} developers actually spent on AI coding in {label}, measured from real{" "}
          <a href="https://github.com/ryoppippi/ccusage" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            ccusage
          </a>{" "}
          data across Claude Code, Codex, Gemini CLI and every other tracked agent.
          {isCurrent && " This month is still in progress — numbers grow as submissions come in."}
        </p>

        {/* Headline tiles */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-10">
          <StatTile icon={<DollarSign className="w-3.5 h-3.5" />} label="Total spend" value={formatUsd(Math.round(stats.cost))} sub="API-equivalent" />
          <StatTile icon={<Users className="w-3.5 h-3.5" />} label="Active developers" value={stats.users.toLocaleString()} sub={`${stats.activeDays} days with activity`} />
          <StatTile icon={<Cpu className="w-3.5 h-3.5" />} label="Tokens" value={formatNumber(stats.tokens)} sub={`${cacheShare}% cache reads`} />
          <StatTile icon={<Gauge className="w-3.5 h-3.5" />} label="Median developer" value={formatUsd(Math.round(stats.medianUserCost))} sub={`top 10% above ${formatUsd(Math.round(stats.p90UserCost))}`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-10">
          {/* Per-tool */}
          <div id="per-tool" className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-surface-1 border-b border-border micro-label">Spend by tool</div>
            <div className="divide-y divide-border-subtle">
              {stats.perTool.slice(0, 8).map((t) => (
                <Link key={t.tool} href={`/tool/${encodeURIComponent(t.tool)}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-1 transition-colors group">
                  <span className="flex-1 text-sm font-medium group-hover:text-accent transition-colors">{toolLabel(t.tool)}</span>
                  <span className="text-xs text-muted">{t.users} devs</span>
                  <span className="w-28 text-right text-sm font-mono font-semibold text-accent">{formatUsd(Math.round(t.cost))}</span>
                </Link>
              ))}
            </div>
            <p className="px-4 py-2.5 text-xs text-muted border-t border-border m-0">
              A day&apos;s spend counts toward every tool active that day, so tool figures can sum past the total.
            </p>
          </div>

          {/* Per-model */}
          <div id="per-model" className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-surface-1 border-b border-border micro-label">Spend by model</div>
            <div className="divide-y divide-border-subtle">
              {stats.perModel.slice(0, 8).map((m) => (
                <div key={m.model} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm font-mono truncate">{prettyModelName(m.model)}</span>
                  <span className="w-28 text-right text-sm font-mono font-semibold text-accent">{formatUsd(Math.round(m.cost))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top spenders */}
        <div id="top-spenders" className="rounded-lg border border-border overflow-hidden mb-10 max-w-3xl">
          <div className="px-4 py-2.5 bg-surface-1 border-b border-border micro-label">Top spenders — {label}</div>
          <div className="divide-y divide-border-subtle">
            {stats.topSpenders.map((u, i) => (
              <Link key={u.username} href={`/profile/${encodeURIComponent(u.username)}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-1 transition-colors group">
                <span className={`w-6 text-center text-sm font-mono ${i === 0 ? "text-[#f5b008] font-bold" : "text-muted"}`}>{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm font-medium truncate group-hover:text-accent transition-colors">{u.username}</span>
                <span className="text-xs text-muted hidden sm:block">{u.activeDays} days active</span>
                <span className="w-24 text-right text-sm font-mono text-muted hidden sm:block">{formatNumber(u.tokens)}</span>
                <span className="w-28 text-right text-sm font-mono font-semibold text-accent">{formatUsd(Math.round(u.cost))}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Month nav + CTA */}
        <div className="flex flex-wrap items-center gap-3 mb-10">
          <Link href={`/stats/monthly/${prev}`} className="px-3 py-1.5 rounded-md border bg-surface-1 border-border text-sm text-muted hover:text-foreground transition-colors">
            ← {monthLabel(prev)}
          </Link>
          {hasNext && (
            <Link href={`/stats/monthly/${next}`} className="px-3 py-1.5 rounded-md border bg-surface-1 border-border text-sm text-muted hover:text-foreground transition-colors">
              {monthLabel(next)} →
            </Link>
          )}
          <Link href="/stats" className="px-3 py-1.5 rounded-md border bg-surface-1 border-border text-sm text-muted hover:text-foreground transition-colors">
            All-time stats
          </Link>
        </div>

        <div className="rounded-lg border border-accent/40 bg-surface-1 p-6 max-w-3xl">
          <p className="font-medium mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            Be in next month&apos;s report
          </p>
          <p className="text-sm text-muted mb-3">
            One command reads your local logs and adds your usage to the board — only totals are submitted, never
            code or prompts. <code className="font-mono text-accent">viberank-cli autosubmit</code> keeps you counted
            every month.
          </p>
          <code className="font-mono text-accent text-sm">npx viberank-cli</code>
        </div>

        <p className="text-xs text-muted mt-8 max-w-3xl flex items-start gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Numbers cite this page as: Viberank, &quot;AI coding spend — {label}&quot;, {SITE}/stats/monthly/{month}.
            Costs are API-equivalent values computed by ccusage from model list prices; developers on flat-rate
            subscriptions pay less. Verified and unverified submissions included; flagged submissions excluded.
          </span>
        </p>
      </div>
      <Footer />
    </div>
  );
}
