"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUpRight } from "lucide-react";
import TierBadge from "@/components/TierBadge";
import Avatar from "@/components/v2/Avatar";
import { getTierProgress } from "@/lib/tiers";
import { formatNumber, toolLabel } from "@/lib/utils";
import { isGithubHandle } from "@/lib/profile-index";
import type { ProfileSummary } from "@/lib/data/types";

interface ProfileSheetProps {
  /** The handle in the URL, used when the profile has no GitHub login. */
  requested: string;
  summary: ProfileSummary;
  globalRank: number | null;
}

/** The sheet's frame; the loading skeleton uses it too, so the swap never jumps. */
export function SheetFrame({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[560px] bg-panel border border-line-2 border-b-0 sm:border-b rounded-t-[18px] sm:rounded-[14px] shadow-2xl max-h-[88vh] sm:max-h-[82vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 p-3.5 border-line border-r border-b -mr-px -mb-px">
      <p className="font-mono text-xs text-ink-3 m-0">{label}</p>
      <p className="font-mono text-lg font-medium tracking-[-0.03em] text-ink mt-1 mb-0 truncate">{value}</p>
      {sub && <p className="font-mono text-[11px] text-ink-3 mt-0.5 mb-0 truncate">{sub}</p>}
    </div>
  );
}

export default function ProfileSheet({ requested, summary, globalRank }: ProfileSheetProps) {
  const router = useRouter();
  const tier = getTierProgress(summary.bestCost);
  const profileUrl = `/profile/${encodeURIComponent(summary.username)}`;
  const handle = summary.githubUsername || summary.username || requested;
  const displayName = summary.githubName || handle;
  const close = useCallback(() => router.back(), [router]);
  const sparkMax = Math.max(...summary.spark, 0);
  const sparkTotal = summary.spark.reduce((sum, v) => sum + v, 0);

  // Esc to close, and lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <SheetFrame onClose={close}>
      <div className="sticky top-0 z-10 bg-panel flex items-center justify-between px-5 pt-3 pb-2 border-b border-line">
        <span className="w-8" />
        <span className="w-10 h-1 rounded-full bg-line-2 sm:invisible" aria-hidden />
        <button
          onClick={close}
          aria-label="Close"
          className="w-8 h-8 inline-flex items-center justify-center text-ink-3 hover:text-ink hover:bg-raised rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 pt-5 pb-5 flex flex-col gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Avatar src={summary.avatar} github={summary.githubUsername} name={displayName} size={48} className="rounded-[12px]" priority />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink truncate m-0">{displayName}</h2>
              <TierBadge totalCost={summary.bestCost} size="sm" />
            </div>
            <p className="font-mono text-[12.5px] text-ink-3 mt-1 mb-0 truncate">
              {isGithubHandle(handle) ? (
                <a href={`https://github.com/${handle}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                  @{handle}
                </a>
              ) : (
                <span>@{handle}</span>
              )}
              {globalRank && (
                <>
                  {" · "}
                  <span className="text-ink">#{globalRank}</span> all-time
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 border border-line rounded-[12px] overflow-hidden">
          <Stat label="spend" value={`$${formatNumber(summary.totalCost)}`} sub="API-equivalent" />
          <Stat label="tokens" value={formatNumber(summary.totalTokens)} sub="all-time" />
          <Stat label="days active" value={String(summary.daysActive)} sub="with usage" />
        </div>

        <div className="border border-line rounded-[12px] p-3.5">
          <div className="flex items-baseline justify-between gap-2 mb-2.5">
            <p className="font-mono text-xs text-ink-3 m-0">last 30 days</p>
            <p className="font-mono text-xs text-ink-2 m-0">${formatNumber(sparkTotal)}</p>
          </div>
          {sparkMax > 0 ? (
            <div className="flex items-end gap-[2px] h-12" aria-label="Daily spend, last 30 days">
              {summary.spark.map((v, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-[2px] ${v > 0 ? "bg-heat" : "bg-line"}`}
                  style={{ height: v > 0 ? `${Math.max(6, (v / sparkMax) * 100)}%` : "2px" }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-2 m-0 h-12 flex items-center">No usage in the last 30 days.</p>
          )}
        </div>

        <div className="border border-line rounded-[12px] p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <p className="font-mono text-xs text-ink-3 m-0">tier progress</p>
            {tier.next ? (
              <p className="font-mono text-xs text-ink-3 m-0">
                ${formatNumber(Math.ceil(tier.remaining))} to{" "}
                <span style={{ color: tier.next.color }}>
                  {tier.next.glyph} {tier.next.name.toUpperCase()}
                </span>
              </p>
            ) : (
              <p className="font-mono text-xs m-0" style={{ color: tier.tier.color }}>
                Top tier reached
              </p>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-raised overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, tier.progress * 100)}%`, background: tier.tier.color }} />
          </div>
        </div>

        {summary.tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {summary.tools.map((t) => (
              <span key={t} className="font-mono text-xs px-2 py-1 rounded-md border border-line-2 text-ink-2">
                {toolLabel(t)}
              </span>
            ))}
          </div>
        )}

        {/* A plain anchor: the soft route is this sheet, so a document load
            is what brings up the full SSR page. */}
        <a
          href={profileUrl}
          className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-md bg-btn text-btn-ink text-sm font-medium hover:opacity-90 transition-opacity"
        >
          View full profile
          <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </SheetFrame>
  );
}
