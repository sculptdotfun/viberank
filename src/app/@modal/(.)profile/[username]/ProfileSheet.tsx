"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { X, Github, ArrowUpRight } from "lucide-react";
import TierBadge from "@/components/TierBadge";
import { getTierProgress } from "@/lib/tiers";
import { formatNumber, toolLabel, sizedAvatarUrl } from "@/lib/utils";

interface ProfileSheetProps {
  username: string;
  displayName: string;
  handle: string;
  avatar: string | null;
  totalCost: number;
  totalTokens: number;
  daysActive: number;
  bestCost: number;
  globalRank: number | null;
  tools: string[];
  /** Daily spend, oldest → newest, for the mini bar chart. */
  spark: number[];
}

export default function ProfileSheet(props: ProfileSheetProps) {
  const router = useRouter();
  const tierInfo = getTierProgress(props.bestCost);
  const profileUrl = `/profile/${encodeURIComponent(props.username)}`;

  const close = () => router.back();

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* The loading skeleton already played the big slide-up — real content
          swaps in with a quick fade so the sheet doesn't animate twice. */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative w-full max-w-2xl bg-surface-1 border border-border border-b-0 rounded-t-xl shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* Grab handle + close */}
        <div className="sticky top-0 bg-surface-1 pt-3 pb-2 px-5 flex items-center justify-between border-b border-border-subtle">
          <div className="w-8" />
          <div className="w-10 h-1 rounded-full bg-surface-4" aria-hidden />
          <button
            onClick={close}
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Identity */}
          <div className="flex items-center gap-4 mb-5">
            {props.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sizedAvatarUrl(props.avatar, 128)}
                alt={props.displayName}
                width={48}
                height={48}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-12 h-12 rounded-full ring-2 ring-border/40"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-surface-3" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight truncate">{props.displayName}</h2>
                <TierBadge totalCost={props.bestCost} size="sm" />
                {props.globalRank && (
                  <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-accent/12 text-accent leading-none">
                    #{props.globalRank}
                  </span>
                )}
              </div>
              <a
                href={`https://github.com/${props.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors"
              >
                <Github className="w-3.5 h-3.5" />@{props.handle}
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-background border border-border-subtle p-3">
              <p className="micro-label mb-1">Spent</p>
              <p className="font-mono font-bold text-accent">${formatNumber(props.totalCost)}</p>
            </div>
            <div className="rounded-lg bg-background border border-border-subtle p-3">
              <p className="micro-label mb-1">Tokens</p>
              <p className="font-mono font-bold">{formatNumber(props.totalTokens)}</p>
            </div>
            <div className="rounded-lg bg-background border border-border-subtle p-3">
              <p className="micro-label mb-1">Days</p>
              <p className="font-mono font-bold">{props.daysActive}</p>
            </div>
          </div>

          {/* Daily spend sparkline */}
          {props.spark.length > 1 && (
            <div className="rounded-lg bg-background border border-border-subtle p-3 mb-3">
              <p className="micro-label mb-2">Daily spend · last {props.spark.length} days</p>
              <div className="flex items-end gap-px h-12">
                {props.spark.map((v, i) => {
                  const max = Math.max(...props.spark) || 1;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-accent/70 min-h-[2px]"
                      style={{ height: `${Math.max(4, (v / max) * 100)}%`, opacity: v === 0 ? 0.15 : undefined }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Tier progress */}
          <div className="rounded-lg bg-background border border-border-subtle p-3 mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
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
            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, tierInfo.progress * 100)}%`, background: tierInfo.tier.color }}
              />
            </div>
          </div>

          {/* Tools */}
          {props.tools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-5">
              {props.tools.map((t) => (
                <span
                  key={t}
                  className="text-xs font-medium px-2 py-1 rounded-md bg-surface-2 text-foreground/80 border border-border"
                >
                  {toolLabel(t)}
                </span>
              ))}
            </div>
          )}

          {/* Full profile is a plain anchor — forces a document load of the
              SSR page since the soft route is already this sheet. */}
          <a
            href={profileUrl}
            className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            View full profile
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
