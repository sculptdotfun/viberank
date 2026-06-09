import Link from "next/link";
import {
  Calendar,
  Zap,
  ArrowLeft,
  ExternalLink,
  Activity,
  Github,
  DollarSign,
  CalendarDays,
  Trophy,
} from "lucide-react";
import { formatNumber, formatCurrency, toolLabel, sizedAvatarUrl } from "@/lib/utils";
import { getTierProgress } from "@/lib/tiers";
import { getServerDataLayer } from "@/lib/data";
import { getProfileCached } from "./getProfile";
import UsageChart from "./UsageChart";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import TierBadge from "@/components/TierBadge";

interface ProfileParams {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: ProfileParams) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const profileData = await getProfileCached(username);

  if (!profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Profile not found</h1>
          <p className="text-muted mb-6">No profile found for @{username}</p>
          <Link href="/" className="inline-flex items-center gap-2 text-accent hover:text-accent-hover transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const submissions = profileData.submissions ?? [];
  const latestSubmission = submissions[0];

  // Aggregate stats across all of the profile's submissions.
  const totalCost = submissions.reduce((s, sub) => s + sub.totalCost, 0);
  const totalTokens = submissions.reduce((s, sub) => s + sub.totalTokens, 0);
  const allDaily = submissions.flatMap((sub) => sub.dailyBreakdown ?? []);
  const daysActive = new Set(allDaily.map((d) => d.date)).size || 1;
  const avgDailyCost = totalCost / daysActive;

  // Per-day chart series (summed across submissions).
  const dailyMap = allDaily.reduce((acc, d) => {
    if (!acc[d.date]) acc[d.date] = { date: d.date, cost: 0, tokens: 0 };
    acc[d.date].cost += d.totalCost;
    acc[d.date].tokens += d.totalTokens;
    return acc;
  }, {} as Record<string, { date: string; cost: number; tokens: number }>);
  const dailySeries = Object.values(dailyMap);

  // Tools used across the profile (Claude sorts first).
  const tools = Array.from(new Set(submissions.flatMap((s) => s.tools ?? []))).sort();

  // Token breakdown (summed across submissions).
  const tokenAgg = submissions.reduce(
    (a, s) => ({
      input: a.input + (s.inputTokens ?? 0),
      output: a.output + (s.outputTokens ?? 0),
      cacheRead: a.cacheRead + (s.cacheReadTokens ?? 0),
      cacheCreation: a.cacheCreation + (s.cacheCreationTokens ?? 0),
    }),
    { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  );
  const maxDailyCost = allDaily.length > 0 ? Math.max(...allDaily.map((d) => d.totalCost)) : 0;

  const displayName = profileData.githubName || profileData.githubUsername || username;
  const handle = profileData.githubUsername || username;

  // Best submission drives both global rank and tier, matching the board.
  const bestCost = submissions.length > 0 ? Math.max(...submissions.map((s) => s.totalCost)) : 0;
  const tierInfo = getTierProgress(bestCost);

  // Global leaderboard position, based on the profile's best submission.
  let globalRank: number | null = null;
  try {
    if (Number.isFinite(bestCost) && bestCost > 0) {
      const dataLayer = await getServerDataLayer();
      globalRank = await dataLayer.submissions.getGlobalRank(bestCost);
    }
  } catch {
    // rank is nice-to-have; render without it on failure
  }

  const tokenRows = [
    { label: "Input", value: tokenAgg.input, color: "bg-accent" },
    { label: "Output", value: tokenAgg.output, color: "bg-blue-500" },
    { label: "Cache read", value: tokenAgg.cacheRead, color: "bg-emerald-500" },
    { label: "Cache creation", value: tokenAgg.cacheCreation, color: "bg-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Leaderboard
        </Link>

        {/* Profile header */}
        <div className="mb-8">
          <div className="flex items-start gap-5 mb-6">
            {profileData.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sizedAvatarUrl(profileData.avatar, 128)}
                alt={displayName}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full ring-2 ring-border/40"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                <TierBadge totalCost={bestCost} size="md" />
                {globalRank && (
                  <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-accent/12 text-accent leading-none">
                    #{globalRank}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                <a
                  href={`https://github.com/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-accent transition-colors"
                >
                  <Github className="w-4 h-4" />@{handle}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {new Date(profileData.createdAt).toLocaleDateString()}
                </span>
              </div>
              {tools.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {tools.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-medium px-2 py-1 rounded-md bg-surface-2 text-foreground/80 border border-border"
                    >
                      {toolLabel(t)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-1 border border-border rounded-lg p-4">
              <p className="flex items-center gap-1.5 micro-label mb-1"><DollarSign className="w-3.5 h-3.5" />Total spent</p>
              <p className="text-xl font-bold font-mono text-accent">${formatNumber(totalCost)}</p>
              <p className="text-xs text-muted mt-1">${formatCurrency(avgDailyCost)}/day avg</p>
            </div>
            <div className="bg-surface-1 border border-border rounded-lg p-4">
              <p className="flex items-center gap-1.5 micro-label mb-1"><Zap className="w-3.5 h-3.5" />Total tokens</p>
              <p className="text-xl font-bold font-mono">{formatNumber(totalTokens)}</p>
              <p className="text-xs text-muted mt-1">{formatNumber(Math.round(totalTokens / daysActive))}/day</p>
            </div>
            <div className="bg-surface-1 border border-border rounded-lg p-4">
              <p className="flex items-center gap-1.5 micro-label mb-1"><CalendarDays className="w-3.5 h-3.5" />Days active</p>
              <p className="text-xl font-bold">{daysActive}</p>
              <p className="text-xs text-muted mt-1">{profileData.totalSubmissions} submission{profileData.totalSubmissions === 1 ? "" : "s"}</p>
            </div>
            <div className="bg-surface-1 border border-border rounded-lg p-4">
              <p className="flex items-center gap-1.5 micro-label mb-1"><Trophy className="w-3.5 h-3.5" />Global rank</p>
              <p className="text-xl font-bold">{globalRank ? `#${globalRank}` : "—"}</p>
              <p className="text-xs text-muted mt-1 truncate">{tools.length ? `${tools.map(toolLabel).slice(0, 2).join(", ")}${tools.length > 2 ? " +" + (tools.length - 2) : ""}` : "by cost"}</p>
            </div>
          </div>

          {/* Tier progress */}
          <div className="bg-surface-1 border border-border rounded-lg p-4 mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <span className="micro-label">Tier progress</span>
              {tierInfo.next ? (
                <span className="font-mono text-xs text-muted">
                  ${formatNumber(Math.ceil(tierInfo.remaining))} to{" "}
                  <span style={{ color: tierInfo.next.color }}>
                    {tierInfo.next.glyph} {tierInfo.next.name.toUpperCase()}
                  </span>
                </span>
              ) : (
                <span className="font-mono text-xs" style={{ color: tierInfo.tier.color }}>
                  Top tier reached
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <TierBadge totalCost={bestCost} size="sm" />
              <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, tierInfo.progress * 100)}%`, background: tierInfo.tier.color }}
                />
              </div>
              {tierInfo.next && (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70">
                  {tierInfo.next.glyph} {tierInfo.next.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Usage chart (client island) */}
        <UsageChart daily={dailySeries} />

        {/* Token breakdown + insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-surface-1 border border-border rounded-lg p-5">
            <h2 className="text-base font-medium mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Token breakdown
            </h2>
            <div className="space-y-3">
              {tokenRows.map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted">{row.label}</span>
                    <span className="font-mono text-xs">{formatNumber(row.value)}</span>
                  </div>
                  <div className="w-full bg-surface-3 rounded-full h-1.5">
                    <div
                      className={`${row.color} h-1.5 rounded-full`}
                      style={{ width: `${totalTokens > 0 ? (row.value / totalTokens) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-1 border border-border rounded-lg p-5">
            <h2 className="text-base font-medium mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              Usage insights
            </h2>
            <div className="space-y-1">
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-xs text-muted">Most expensive day</span>
                <span className="font-mono text-xs">${formatCurrency(maxDailyCost)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-xs text-muted">Average daily cost</span>
                <span className="font-mono text-xs">${formatCurrency(avgDailyCost)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-xs text-muted">Total days tracked</span>
                <span className="font-mono text-xs">{daysActive} days</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-muted">Last updated</span>
                <span className="text-xs">
                  {latestSubmission?.submittedAt
                    ? new Date(latestSubmission.submittedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
