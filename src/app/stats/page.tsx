import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Cpu, DollarSign, Users, Wrench, Zap, CalendarDays, Database, Flame } from "lucide-react";
import { formatNumber, formatCurrency, toolLabel, prettyModelName } from "@/lib/utils";
import { seriesColor } from "@/lib/chartColors";
import { TIERS } from "@/lib/tiers";
import { getServerDataLayer } from "@/lib/data";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

// Full-table aggregates are computed in-database (get_site_stats, migration
// 007); the hourly ISR window keeps those scans rare.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "AI Coding Usage Stats | Viberank",
  description:
    "Site-wide AI coding usage: total spend, tokens burned, cache hit share, and the most used models across Claude Code, Codex, Gemini CLI and more.",
  alternates: { canonical: "https://www.viberank.app/stats" },
  openGraph: {
    title: "AI Coding Usage Stats | Viberank",
    description:
      "Total spend, tokens burned, and the most used models across every coding agent tracked on Viberank.",
    url: "https://www.viberank.app/stats",
    siteName: "Viberank",
  },
};

function StatTile({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <p className="flex items-center gap-1.5 micro-label mb-1">
        {icon}
        {label}
      </p>
      <p className={`text-xl font-bold font-mono ${accent ? "text-accent" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

function BarList({
  rows,
  format,
}: {
  rows: { label: string; value: number }[];
  format: (value: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map(({ label, value }, i) => (
        <div key={label}>
          <div className="flex justify-between items-center mb-1.5 gap-2">
            <span className="flex items-center gap-1.5 text-xs font-mono truncate">
              <span className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: seriesColor(i) }} />
              {label}
            </span>
            <span className="font-mono text-xs text-muted flex-shrink-0">{format(value)}</span>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${Math.max((value / max) * 100, 1)}%`, background: seriesColor(i) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function StatsPage() {
  const dataLayer = await getServerDataLayer();
  const [site, global] = await Promise.all([
    dataLayer.stats.getSiteStats().catch(() => null),
    dataLayer.stats.getGlobalStats().catch(() => null),
  ]);

  const totalUsers = site?.totalUsers ?? global?.totalUsers ?? 0;
  const totalSubmissions = site?.totalSubmissions ?? global?.totalSubmissions ?? 0;
  const totalCost = site?.totalCost ?? global?.totalCost ?? 0;
  const totalTokens = site?.totalTokens ?? global?.totalTokens ?? 0;
  const exact = site !== null;

  const cacheShare = site && site.totalTokens > 0 ? site.cacheReadTokens / site.totalTokens : null;

  const tokenRows = site
    ? [
        { label: "Input", value: site.inputTokens, color: "bg-accent" },
        { label: "Output", value: site.outputTokens, color: "bg-blue-500" },
        { label: "Cache read", value: site.cacheReadTokens, color: "bg-emerald-500" },
        { label: "Cache creation", value: site.cacheCreationTokens, color: "bg-purple-500" },
      ]
    : [];

  // Raw model ids collapse to the same pretty name ("claude-sonnet-4-2025…"
  // variants etc.). Spend sums correctly; distinct-user counts don't, so keep
  // the max as a lower bound instead of overcounting.
  const modelUsers = new Map<string, number>();
  for (const { model, users } of site?.models ?? []) {
    // models_used elements aren't type-checked at ingest; skip junk instead
    // of crashing the ISR render on a null.
    if (typeof model !== "string" || !model) continue;
    const name = prettyModelName(model);
    modelUsers.set(name, Math.max(modelUsers.get(name) ?? 0, users));
  }
  const modelSpend = new Map<string, number>();
  for (const { model, cost } of site?.modelSpend ?? []) {
    if (typeof model !== "string" || !model) continue;
    const name = prettyModelName(model);
    modelSpend.set(name, (modelSpend.get(name) ?? 0) + Number(cost));
  }
  const topModelUsers = Array.from(modelUsers.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topModelSpend = Array.from(modelSpend.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const toolRows = (site?.tools ?? []).slice(0, 10);

  const monthly = (site?.monthly ?? []).map((m) => ({ ...m, cost: Number(m.cost) }));
  const maxMonthlyCost = Math.max(...monthly.map((m) => m.cost), 1);
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} '${String(y).slice(2)}`;
  };
  const tierCounts = new Map((site?.tiers ?? []).map((t) => [t.tier, t.users]));
  const tierTotal = (site?.tiers ?? []).reduce((s, t) => s + t.users, 0);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        <div className="mb-8">
          <p className="micro-label mb-3">Site-wide telemetry</p>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight">
            The state of the board<span className="cursor-block" aria-hidden />
          </h1>
          <p className="text-muted text-base mt-3 max-w-2xl">
            Aggregate AI coding usage across every developer on Viberank — Claude Code, OpenAI Codex,
            Gemini CLI, Copilot and every agent ccusage tracks.
            {site?.firstDate && site?.lastDate && (
              <> Tracking {site.firstDate} → {site.lastDate}.</>
            )}
          </p>
          {!exact && (
            <p className="text-xs text-muted/70 mt-2">
              Showing approximate totals (based on top {global?.basedOnTop ?? 500} submissions).
            </p>
          )}
        </div>

        {/* Headline tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <StatTile icon={<DollarSign className="w-3.5 h-3.5" />} label="Total spend" value={`$${formatNumber(totalCost)}`} accent sub="API-equivalent" />
          <StatTile icon={<Zap className="w-3.5 h-3.5" />} label="Tokens" value={formatNumber(totalTokens)} sub="all time" />
          <StatTile icon={<Users className="w-3.5 h-3.5" />} label="Developers" value={formatNumber(totalUsers)} sub="on the board" />
          <StatTile icon={<Database className="w-3.5 h-3.5" />} label="Submissions" value={formatNumber(totalSubmissions)} sub="tracked" />
          {site && (
            <StatTile icon={<CalendarDays className="w-3.5 h-3.5" />} label="Active days" value={formatNumber(site.activeDays)} sub="distinct dates" />
          )}
          {cacheShare !== null && (
            <StatTile
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              label="Cache read"
              value={`${Math.round(cacheShare * 100)}%`}
              sub="of all tokens"
            />
          )}
        </div>

        {/* Token split */}
        {site && (
          <div className="bg-surface-1 border border-border rounded-lg p-5 mb-4">
            <h2 className="text-base font-medium mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Token breakdown
            </h2>
            <div className="space-y-3">
              {tokenRows.map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted">{row.label}</span>
                    <span className="font-mono text-xs">
                      {formatNumber(row.value)}
                      <span className="text-muted/60"> · {site.totalTokens > 0 ? Math.round((row.value / site.totalTokens) * 100) : 0}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-surface-3 rounded-full h-1.5">
                    <div
                      className={`${row.color} h-1.5 rounded-full`}
                      style={{ width: `${site.totalTokens > 0 ? (row.value / site.totalTokens) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {cacheShare !== null && cacheShare > 0.3 && (
              <p className="text-[11px] text-muted/70 mt-3">
                {Math.round(cacheShare * 100)}% of all tokens are cache reads — prompt caching is doing
                most of the heavy lifting.
              </p>
            )}
          </div>
        )}

        {/* Monthly trend + tier distribution */}
        {(monthly.length > 1 || tierTotal > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {monthly.length > 1 && (
              <div className="bg-surface-1 border border-border rounded-lg p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-accent" />
                    Monthly spend
                  </h2>
                  <span className="micro-label">last {monthly.length} months · all developers</span>
                </div>
                <div className="flex items-end gap-1.5 sm:gap-2 h-44">
                  {monthly.map((m, i) => (
                    <div
                      key={m.month}
                      data-tip={`${monthLabel(m.month)} · $${formatNumber(m.cost)} · ${m.users} devs`}
                      className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0 h-full"
                    >
                      <div
                        className="w-full bg-accent/80 hover:bg-accent transition-colors rounded-t-sm"
                        style={{ height: `${Math.max((m.cost / maxMonthlyCost) * 130, 3)}px` }}
                      />
                      <span className={`text-[9px] font-mono text-muted/70 truncate ${i % 2 === 1 ? "invisible sm:visible" : ""}`}>
                        {monthLabel(m.month)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tierTotal > 0 && (
              <div className="bg-surface-1 border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-medium flex items-center gap-2">
                    <Flame className="w-4 h-4 text-accent" />
                    Tier ladder
                  </h2>
                  <span className="micro-label">by best submission</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden mb-4">
                  {TIERS.map((t) => {
                    const users = tierCounts.get(t.key) ?? 0;
                    if (users === 0) return null;
                    return (
                      <div
                        key={t.key}
                        style={{ width: `${(users / tierTotal) * 100}%`, background: t.color, minWidth: 3 }}
                      />
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {[...TIERS].reverse().map((t) => {
                    const users = tierCounts.get(t.key) ?? 0;
                    return (
                      <div key={t.key} className="flex items-center justify-between font-mono text-xs">
                        <span style={{ color: t.color }}>
                          {t.glyph} {t.name.toUpperCase()}
                        </span>
                        <span className="text-muted">
                          {formatNumber(users)}
                          <span className="text-muted/60"> · {tierTotal > 0 ? Math.round((users / tierTotal) * 100) : 0}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Models + tools */}
        {(topModelUsers.length > 0 || topModelSpend.length > 0 || toolRows.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {topModelUsers.length > 0 && (
              <div className="bg-surface-1 border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-medium flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-accent" />
                    Popular models
                  </h2>
                  <span className="micro-label">by users</span>
                </div>
                <BarList rows={topModelUsers.map(([label, value]) => ({ label, value }))} format={(v) => `${formatNumber(v)} devs`} />
              </div>
            )}

            {topModelSpend.length > 0 && (
              <div className="bg-surface-1 border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-accent" />
                    Top models
                  </h2>
                  <span className="micro-label">by spend</span>
                </div>
                <BarList rows={topModelSpend.map(([label, value]) => ({ label, value }))} format={(v) => `$${formatNumber(v)}`} />
              </div>
            )}

            {toolRows.length > 0 && (
              <div className="bg-surface-1 border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-medium flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-accent" />
                    Tools
                  </h2>
                  <span className="micro-label">by users</span>
                </div>
                <BarList
                  rows={toolRows.map((t) => ({ label: toolLabel(t.tool), value: t.users }))}
                  format={(v) => `${formatNumber(v)} devs`}
                />
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted/70 mt-6">
          Updated hourly. Spend is the API-equivalent cost reported by ccusage — most developers pay
          far less on subscription plans. Want on the board?{" "}
          <code className="font-mono text-accent">npx viberank-cli</code>
        </p>
      </div>
      <Footer />
    </div>
  );
}
