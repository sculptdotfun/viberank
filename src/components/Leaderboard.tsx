"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, DollarSign, Zap, Calendar, Share2, X, BadgeCheck, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ShareCard = dynamic(() => import("./ShareCard"), { ssr: false });
import Avatar from "./Avatar";
import SponsorSlot from "./SponsorSlot";
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
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [allItems, setAllItems] = useState<Submission[]>(initialItems ?? []);
  const { data: session } = useSession();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const { data: liveStats } = useGlobalStats();
  const globalStats = liveStats ?? initialStats;

  const ITEMS_PER_PAGE = 25;
  const isDateFiltered = dateFrom && dateTo;

  // Filters ⇄ URL. Parsed once on mount (not useSearchParams — that would
  // opt the ISR'd home page out of static rendering), then mirrored back via
  // replaceState so any filtered view is a shareable link.
  const [urlSynced, setUrlSynced] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("sort") === "tokens") setSortBy("tokens");
    const urlTool = p.get("tool");
    if (urlTool) setTool(urlTool);
    if (p.get("verified") === "1") setVerifiedOnly(true);
    const from = p.get("from");
    const to = p.get("to");
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) setDateFrom(from);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) setDateTo(to);
    setUrlSynced(true);
  }, []);

  useEffect(() => {
    // urlSynced is still false during the mount commit, which keeps this from
    // wiping the URL params before the parse above lands in state.
    if (!urlSynced) return;
    const p = new URLSearchParams(window.location.search);
    const write = (key: string, value: string) => (value ? p.set(key, value) : p.delete(key));
    write("sort", sortBy === "tokens" ? "tokens" : "");
    write("tool", tool ?? "");
    write("verified", verifiedOnly ? "1" : "");
    write("from", dateFrom);
    write("to", dateTo);
    const qs = p.toString();
    if ((qs ? `?${qs}` : "") !== window.location.search) {
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, [urlSynced, sortBy, tool, verifiedOnly, dateFrom, dateTo]);

  // The server already rendered page 0 of the default view — don't re-fetch
  // it on mount. The hook only runs for non-default filters or later pages.
  const isSeededDefaultView =
    (initialItems?.length ?? 0) > 0 &&
    page === 0 &&
    sortBy === "cost" &&
    !tool &&
    !verifiedOnly &&
    !isDateFiltered;

  const { data: regularResult, isLoading } = useLeaderboard(
    !isDateFiltered && !isSeededDefaultView
      ? { sortBy, page, pageSize: ITEMS_PER_PAGE, tool: tool ?? undefined, verifiedOnly: verifiedOnly || undefined }
      : "skip"
  );

  const hasMore = regularResult?.hasMore ?? (isSeededDefaultView ? initialHasMore ?? false : false);

  const { data: dateFilteredResult } = useLeaderboardByDateRange(
    isDateFiltered
      ? { dateFrom, dateTo, sortBy, limit: 100, tool: tool ?? undefined, verifiedOnly: verifiedOnly || undefined }
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
  }, [sortBy, dateFrom, dateTo, tool, verifiedOnly]);

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
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
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

            <button
              onClick={() => setVerifiedOnly(v => !v)}
              aria-pressed={verifiedOnly}
              title="Only show GitHub-verified submissions"
              className={`px-2 py-1 text-xs font-mono font-medium rounded flex items-center gap-1 transition-colors ${
                verifiedOnly ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <BadgeCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Verified</span>
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

      <SponsorSlot />

      {/* Top-3 podium — only on the unfiltered board, where ranks are global */}
      {!tool && !verifiedOnly && !isDateFiltered && allItems.length >= 3 && (
        <div className="flex items-end justify-center gap-4 sm:gap-10 mb-8 pt-2">
          {[allItems[1], allItems[0], allItems[2]].map((s, col) => {
            const rank = col === 1 ? 1 : col === 0 ? 2 : 3;
            const medal = rank === 1 ? "#f5b008" : rank === 2 ? "#b8bcc4" : "#c2703f";
            const first = rank === 1;
            return (
              <Link
                key={s.id}
                href={`/profile/${encodeURIComponent(s.githubUsername || s.username)}`}
                className={`group flex flex-col items-center text-center ${first ? "" : "mb-1 sm:mb-2"}`}
              >
                <div className="relative">
                  <div
                    className={`rounded-full ${first ? "w-20 h-20" : "w-14 h-14"} overflow-hidden`}
                    style={{ boxShadow: `0 0 0 2px ${medal}, 0 0 ${first ? 28 : 16}px ${medal}33` }}
                  >
                    <Avatar
                      src={s.githubAvatar}
                      githubUsername={s.githubUsername}
                      name={s.githubName || s.username}
                      size={first ? "lg" : "md"}
                      priority
                      className="!w-full !h-full"
                    />
                  </div>
                  <span
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold px-1.5 py-px rounded-full bg-background border"
                    style={{ color: medal, borderColor: medal }}
                  >
                    {rank}
                  </span>
                </div>
                <span className={`mt-3.5 font-medium truncate max-w-[7rem] sm:max-w-[10rem] group-hover:text-accent transition-colors ${first ? "text-sm" : "text-xs"}`}>
                  {s.githubUsername || s.username}
                </span>
                <span className={`font-mono font-semibold text-accent ${first ? "text-base" : "text-sm"}`}>
                  {sortBy === "tokens" ? (
                    <>
                      {formatNumber(s.totalTokens)}
                      <span className="text-muted text-[10px] font-normal"> tok</span>
                    </>
                  ) : (
                    <>${formatNumber(s.totalCost)}</>
                  )}
                </span>
                <span className="mt-1">
                  <TierBadge totalCost={s.totalCost} size="xs" bare />
                </span>
              </Link>
            );
          })}
        </div>
      )}

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
                            <span className={`text-sm font-medium group-hover:text-accent transition-colors truncate ${!submission.verified ? "text-muted" : ""}`}>
                              {submission.githubUsername || submission.username}
                            </span>
                            {submission.verified ? (
                              <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            ) : (
                              <span
                                title="Submitted via CLI — identity not verified with GitHub"
                                className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-muted/15 text-muted flex-shrink-0"
                              >
                                cli
                              </span>
                            )}
                          </div>
                          {/* Tokens live here on mobile, where the column is hidden */}
                          <div className="text-xs text-muted font-mono sm:hidden">
                            {formatNumber(submission.totalTokens)} tokens
                          </div>
                          {submission.githubName && submission.githubName !== submission.githubUsername && (
                            <div className="text-xs text-muted truncate hidden sm:block">{submission.githubName}</div>
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
