"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, DollarSign, Zap, Calendar, Share2, X, BadgeCheck, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ShareCard = dynamic(() => import("./ShareCard"), { ssr: false });
import Avatar from "./Avatar";
import TierBadge from "./TierBadge";
import { TIERS } from "@/lib/tiers";
import { formatNumber, formatCurrency, toolLabel } from "@/lib/utils";
import { useLeaderboard, useLeaderboardByDateRange } from "@/lib/data/hooks/useSubmissions";
import { useGlobalStats } from "@/lib/data/hooks/useStats";
import type { Submission, GlobalStats } from "@/lib/data/types";

type SortBy = "cost" | "tokens";

interface LeaderboardProps {
  // Server-fetched first page + stats so the board renders in the SSR HTML.
  initialItems?: Submission[];
  initialStats?: GlobalStats;
  initialHasMore?: boolean;
}

// Medal colors for the top three rank numbers.
const RANK_COLORS: Record<number, string> = {
  1: "text-[#f5b008]",
  2: "text-[#b8bcc4]",
  3: "text-[#c2703f]",
};

// Flat placeholder rows shown while a filter/sort change is fetching.
function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="py-5 space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-1 px-4 py-3 animate-pulse">
          <div className="w-8 h-4 rounded bg-surface-3" />
          <div className="w-8 h-8 rounded-full bg-surface-3" />
          <div className="flex-1 h-4 rounded bg-surface-3 max-w-[180px]" />
          <div className="w-24 h-4 rounded bg-surface-3" />
          <div className="w-20 h-4 rounded bg-surface-3 hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard({ initialItems, initialStats, initialHasMore }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [tool, setTool] = useState<string | null>(null);
  const [showShareCard, setShowShareCard] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [allItems, setAllItems] = useState<Submission[]>(initialItems ?? []);
  const { data: session } = useSession();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const { data: liveStats } = useGlobalStats();
  const globalStats = liveStats ?? initialStats;

  const ITEMS_PER_PAGE = 25;
  const isDateFiltered = dateFrom && dateTo;

  // The server already rendered page 0 of the default view — don't re-fetch
  // it on mount. The hook only runs for non-default filters or later pages.
  const isSeededDefaultView =
    (initialItems?.length ?? 0) > 0 &&
    page === 0 &&
    sortBy === "cost" &&
    !tool &&
    !isDateFiltered;

  const { data: regularResult, isLoading } = useLeaderboard(
    !isDateFiltered && !isSeededDefaultView
      ? { sortBy, page, pageSize: ITEMS_PER_PAGE, tool: tool ?? undefined }
      : "skip"
  );

  const hasMore = regularResult?.hasMore ?? (isSeededDefaultView ? initialHasMore ?? false : false);

  const { data: dateFilteredResult } = useLeaderboardByDateRange(
    isDateFiltered
      ? { dateFrom, dateTo, sortBy, limit: 100, tool: tool ?? undefined }
      : "skip"
  );

  // Tools available to filter by, sourced from the global per-tool stats.
  const availableTools = globalStats?.modelUsage
    ? Object.keys(globalStats.modelUsage).sort()
    : [];

  useEffect(() => {
    // Keep the server-seeded items on first render; only reset when a filter
    // actually changes (avoids clearing the SSR'd rows during hydration).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setAllItems([]);
    setPage(0);
  }, [sortBy, dateFrom, dateTo, tool]);

  useEffect(() => {
    if (isDateFiltered && dateFilteredResult?.items) {
      setAllItems(dateFilteredResult.items);
    } else if (!isDateFiltered && regularResult?.items) {
      if (page === 0) {
        setAllItems(regularResult.items);
      } else {
        setAllItems(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = regularResult.items.filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [regularResult, dateFilteredResult, page, isDateFiltered]);

  useEffect(() => {
    if (isDateFiltered || !hasMore) return;

    const currentRef = loadMoreRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isDateFiltered, allItems.length]);

  const setQuickFilter = (days: number | null) => {
    if (days === null) {
      setDateFrom("");
      setDateTo("");
    } else {
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - days);
      setDateFrom(from.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    }
  };

  const isQuickFilterActive = (days: number) => {
    if (!dateFrom || !dateTo) return false;
    const diff = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000));
    return diff === days;
  };

  return (
    <div>
      {/* Filter bar — sticky under the nav while scrolling the board */}
      <div className="sticky top-14 z-40 py-2.5 bg-background/95 backdrop-blur border-b border-border mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="micro-label mr-2 hidden lg:block">Leaderboard</span>
            {[
              { label: "All", days: null },
              { label: "7d", days: 7 },
              { label: "30d", days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => setQuickFilter(days)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  days === null
                    ? (!dateFrom && !dateTo ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2")
                    : (isQuickFilterActive(days) ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2")
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Custom date range"
              className={`p-1.5 rounded transition-colors ${showFilters ? "text-accent" : "text-muted hover:text-foreground"}`}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>

            {availableTools.length > 1 && (
              <select
                value={tool ?? ""}
                onChange={(e) => setTool(e.target.value || null)}
                aria-label="Filter by tool"
                className={`px-2 py-1 text-xs font-mono font-medium rounded bg-surface-2 border border-border transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${
                  tool ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <option value="">All tools</option>
                {availableTools.map((t) => (
                  <option key={t} value={t}>
                    {toolLabel(t)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortBy("cost")}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded flex items-center gap-1 transition-colors ${
                sortBy === "cost" ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cost</span>
            </button>
            <button
              onClick={() => setSortBy("tokens")}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded flex items-center gap-1 transition-colors ${
                sortBy === "tokens" ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tokens</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 pt-3 text-sm">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 bg-background border border-border rounded-md"
                />
                <span className="text-muted">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 bg-background border border-border rounded-md"
                />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-muted hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tier ladder key — desktop gets the sidebar ladder instead */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-5 px-0.5 lg:hidden">
        <span className="micro-label">Tiers</span>
        {TIERS.map((t) => (
          <span key={t.key} className="inline-flex items-baseline gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
            <span style={{ color: t.color }}>
              {t.glyph} {t.name}
            </span>
            <span className="text-muted/70 normal-case tracking-normal">
              {t.min === 0 ? "$0" : `$${formatNumber(t.min).replace(".0", "")}`}+
            </span>
          </span>
        ))}
      </div>

      {/* Board */}
      {allItems.length > 0 ? (
        <div>
          {/* Full table */}
          {allItems.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 micro-label bg-surface-1 border-b border-border">
                <div className="w-8 text-center">#</div>
                <div className="flex-1">User</div>
                <div className="hidden sm:block w-28">Tier</div>
                <div className="w-28 text-right">Cost</div>
                <div className="w-24 text-right hidden sm:block">Tokens</div>
                <div className="w-8" />
              </div>

              <div className="divide-y divide-border-subtle">
                {allItems.map((submission, i) => {
                  const rank = i + 1;
                  const isCurrentUser = session?.user?.username === submission.githubUsername;
                  return (
                    <Link
                      key={submission.id}
                      href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors cursor-pointer group ${isCurrentUser ? "bg-accent/10 border-l-2 border-l-accent" : ""}`}
                    >
                      <div
                        className={`w-8 flex-shrink-0 text-center text-sm font-mono ${
                          RANK_COLORS[rank] ? `${RANK_COLORS[rank]} font-bold` : "text-muted"
                        }`}
                      >
                        {rank}
                      </div>

                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar
                          src={submission.githubAvatar}
                          githubUsername={submission.githubUsername}
                          name={submission.githubName || submission.username}
                          size="sm"
                          priority={rank <= 10}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium group-hover:text-accent transition-colors truncate">
                              {submission.githubUsername || submission.username}
                            </span>
                            {submission.verified ? (
                              <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            ) : (
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-muted/15 text-muted flex-shrink-0">cli</span>
                            )}
                          </div>
                          {submission.githubName && submission.githubName !== submission.githubUsername && (
                            <div className="text-xs text-muted truncate">{submission.githubName}</div>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:block w-28 flex-shrink-0">
                        <TierBadge totalCost={submission.totalCost} size="xs" bare />
                      </div>

                      <div className="w-24 sm:w-28 text-right flex-shrink-0">
                        <div className="text-sm font-mono font-semibold text-accent">${formatCurrency(submission.totalCost)}</div>
                      </div>

                      <div className="w-24 text-right flex-shrink-0 hidden sm:block">
                        <div className="text-sm font-mono text-muted">{formatNumber(submission.totalTokens)}</div>
                      </div>

                      <div className="w-8 flex-shrink-0 justify-end hidden sm:flex">
                        {isCurrentUser && (
                          <button
                            onClick={(e) => { e.preventDefault(); setShowShareCard(submission.id); }}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-surface-2 rounded transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {!isDateFiltered && hasMore && (
            <div ref={loadMoreRef} className="py-6 text-center">
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted" />
            </div>
          )}
        </div>
      ) : isLoading ? (
        <SkeletonRows />
      ) : (
        <div className="text-center py-16">
          <Trophy className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-base font-medium mb-1">No submissions yet</p>
          <p className="text-sm text-muted mb-4">Be the first on the leaderboard</p>
          <code className="text-sm font-mono text-accent">npx viberank-cli</code>
        </div>
      )}

      {/* Share Modal */}
      {showShareCard && allItems.find(s => s.id === showShareCard) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowShareCard(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ShareCard
              rank={allItems.findIndex(s => s.id === showShareCard) + 1}
              username={allItems.find(s => s.id === showShareCard)!.username}
              totalCost={allItems.find(s => s.id === showShareCard)!.totalCost}
              totalTokens={allItems.find(s => s.id === showShareCard)!.totalTokens}
              dateRange={allItems.find(s => s.id === showShareCard)!.dateRange}
              tools={allItems.find(s => s.id === showShareCard)!.tools}
              onClose={() => setShowShareCard(null)}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
