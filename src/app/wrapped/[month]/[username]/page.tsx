import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, Flame, CalendarDays, Trophy, Cpu, DollarSign, Zap } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import type { UserMonthStats } from "@/lib/data/types";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { formatNumber, formatUsd, prettyModelName, toolLabel } from "@/lib/utils";
import WrappedShare from "./WrappedShare";

interface WrappedParams {
  params: Promise<{ month: string; username: string }>;
}

const SITE = "https://www.viberank.app";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Past months are frozen; the current month grows until it closes.
export const revalidate = 3600;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

const getWrapped = cache(async (month: string, username: string): Promise<UserMonthStats | null> => {
  try {
    const dataLayer = await getServerDataLayer();
    return await dataLayer.stats.getUserMonthStats(month, username);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: WrappedParams): Promise<Metadata> {
  const { month: rawMonth, username: rawUser } = await params;
  const month = decodeURIComponent(rawMonth);
  const username = decodeURIComponent(rawUser);
  if (!/^\d{4}-\d{2}$/.test(month)) return {};

  const stats = await getWrapped(month, username);
  const label = monthLabel(month);
  const title = `${username}'s ${label} Wrapped | Viberank`;
  const description = stats
    ? `${username} in ${label}: ${formatUsd(Math.round(stats.cost))} of AI coding (API-equivalent), ${formatNumber(stats.tokens)} tokens, ${stats.activeDays} active days, rank #${stats.rank} of ${stats.totalActives}.`
    : `Monthly AI coding recap for ${username} on Viberank.`;
  const og = stats
    ? `/api/og?type=wrapped&username=${encodeURIComponent(username)}&label=${encodeURIComponent(label)}&cost=${Math.round(stats.cost)}&tokens=${encodeURIComponent(formatNumber(stats.tokens))}&rank=${stats.rank}&actives=${stats.totalActives}&days=${stats.activeDays}&streak=${stats.longestStreak}`
    : `/api/og?title=${encodeURIComponent("Monthly Wrapped")}`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/wrapped/${month}/${encodeURIComponent(username)}` },
    // Personal recaps are for sharing, not for search results.
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE}/wrapped/${month}/${encodeURIComponent(username)}`,
      siteName: "Viberank",
      type: "article",
      images: [{ url: og, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5">
      <p className="flex items-center gap-1.5 micro-label mb-1.5">
        {icon}
        {label}
      </p>
      <p className="font-mono text-2xl font-bold text-foreground m-0">{value}</p>
      {sub && <p className="text-xs text-muted mt-1 mb-0">{sub}</p>}
    </div>
  );
}

export default async function WrappedPage({ params }: WrappedParams) {
  const { month: rawMonth, username: rawUser } = await params;
  const month = decodeURIComponent(rawMonth);
  const username = decodeURIComponent(rawUser);
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const stats = await getWrapped(month, username);
  if (!stats) notFound();

  const label = monthLabel(month);
  const percentile = Math.max(1, Math.round((stats.rank / stats.totalActives) * 100));
  const topModel = stats.topModels[0];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href={`/profile/${encodeURIComponent(username)}`}
          className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {username}&apos;s profile
        </Link>

        <p className="micro-label mb-3">Monthly Wrapped</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          {username}&apos;s {label}
        </h1>
        <p className="text-muted mb-8">
          Rank <span className="text-accent font-mono font-semibold">#{stats.rank}</span> of{" "}
          {stats.totalActives.toLocaleString()} developers active in {label} — top {percentile}%. From real{" "}
          <a
            href="https://github.com/ryoppippi/ccusage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ccusage
          </a>{" "}
          data.
        </p>

        <div className="grid gap-3 grid-cols-2 mb-8">
          <StatTile
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="Spend"
            value={formatUsd(Math.round(stats.cost))}
            sub="API-equivalent"
          />
          <StatTile
            icon={<Cpu className="w-3.5 h-3.5" />}
            label="Tokens"
            value={formatNumber(stats.tokens)}
          />
          <StatTile
            icon={<CalendarDays className="w-3.5 h-3.5" />}
            label="Active days"
            value={String(stats.activeDays)}
            sub={`best day ${formatUsd(Math.round(stats.bestDayCost))}`}
          />
          <StatTile
            icon={<Flame className="w-3.5 h-3.5" />}
            label="Longest streak"
            value={`${stats.longestStreak} days`}
          />
        </div>

        {(topModel || stats.tools.length > 0) && (
          <div className="rounded-lg border border-border bg-surface-1 p-5 mb-8">
            {topModel && (
              <p className="text-sm mb-2">
                <span className="micro-label mr-2">Top model</span>
                <span className="font-mono text-foreground">{prettyModelName(topModel.model)}</span>
                <span className="text-muted"> — {formatUsd(Math.round(topModel.cost))}</span>
              </p>
            )}
            {stats.tools.length > 0 && (
              <p className="text-sm m-0">
                <span className="micro-label mr-2">Tools</span>
                <span className="text-foreground">{stats.tools.map(toolLabel).join(" · ")}</span>
              </p>
            )}
          </div>
        )}

        <WrappedShare username={username} month={month} label={label} stats={stats} percentile={percentile} />

        <div className="rounded-lg border border-accent/40 bg-surface-1 p-5 mt-10">
          <p className="font-medium mb-1 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            Want yours?
          </p>
          <p className="text-sm text-muted mb-3">
            One command puts your usage on the board — only totals leave your machine, and{" "}
            <code className="font-mono text-accent">viberank-cli autosubmit</code> keeps every month&apos;s Wrapped
            complete.
          </p>
          <code className="font-mono text-accent text-sm">npx viberank-cli</code>
        </div>

        <p className="text-sm text-muted mt-8">
          <Zap className="w-3.5 h-3.5 inline mr-1" />
          How everyone did: <Link href={`/stats/monthly/${month}`} className="text-accent hover:underline">the {label} report</Link>.
        </p>
      </div>
      <Footer />
    </div>
  );
}
