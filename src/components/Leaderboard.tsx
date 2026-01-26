"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Award, DollarSign, Zap, Calendar, Share2, X, ChevronDown, BadgeCheck, Loader2, Terminal, Copy, Check, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ShareCard from "./ShareCard";
import Avatar from "./Avatar";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useLeaderboard, useLeaderboardByDateRange } from "@/lib/data/hooks/useSubmissions";
import { useGlobalStats } from "@/lib/data/hooks/useStats";
import type { Submission } from "@/lib/data/types";

type SortBy = "cost" | "tokens";

interface LeaderboardProps {
  onCopyCommand?: () => void;
  copiedToClipboard?: boolean;
}

export default function Leaderboard({ onCopyCommand, copiedToClipboard }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [showShareCard, setShowShareCard] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [allItems, setAllItems] = useState<Submission[]>([]);
  const { data: session } = useSession();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data: globalStats } = useGlobalStats();

  const ITEMS_PER_PAGE = 25;
  const isDateFiltered = dateFrom && dateTo;

  const { data: regularResult, isLoading } = useLeaderboard(
    !isDateFiltered ? { sortBy, page, pageSize: ITEMS_PER_PAGE } : "skip"
  );

  const { data: dateFilteredResult } = useLeaderboardByDateRange(
    isDateFiltered ? { dateFrom, dateTo, sortBy, limit: 100 } : "skip"
  );

  useEffect(() => {
    setAllItems([]);
    setPage(0);
  }, [sortBy, dateFrom, dateTo]);

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
    if (isDateFiltered || !regularResult?.hasMore) return;

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
  }, [regularResult?.hasMore, isLoading, isDateFiltered, allItems.length]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-gray-400" />;
    if (rank === 3) return <Award className="w-4 h-4 text-amber-600" />;
    return null;
  };

  const getRankStyle = (rank: number) => {
    if (rank <= 3) return "bg-surface-1/50";
    return "";
  };

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold">Claude Code Leaderboard</h1>
            <p className="text-sm text-muted mt-1">Who's spending the most on AI coding?</p>
          </div>
          {onCopyCommand && (
            <button
              onClick={onCopyCommand}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm bg-surface-1 hover:bg-surface-2 border border-border rounded-lg transition-colors"
            >
              <Terminal className="w-4 h-4 text-muted" />
              <code className="font-mono text-accent font-medium">npx viberank</code>
              {copiedToClipboard ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted" />
              )}
            </button>
          )}
        </div>

        {/* Aggregated Stats */}
        {globalStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-1 rounded-xl px-4 py-3 border border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                <Users className="w-3.5 h-3.5" />
                Users
              </div>
              <div className="text-lg font-bold">{formatNumber(globalStats.totalUsers)}</div>
            </div>
            <div className="bg-surface-1 rounded-xl px-4 py-3 border border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                Total Spent
              </div>
              <div className="text-lg font-bold font-mono text-accent">${formatCurrency(globalStats.totalCost)}</div>
            </div>
            <div className="bg-surface-1 rounded-xl px-4 py-3 border border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                <Zap className="w-3.5 h-3.5" />
                Total Tokens
              </div>
              <div className="text-lg font-bold font-mono">{formatNumber(globalStats.totalTokens)}</div>
            </div>
            <div className="bg-surface-1 rounded-xl px-4 py-3 border border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                <Trophy className="w-3.5 h-3.5" />
                Top Spender
              </div>
              <div className="text-lg font-bold font-mono truncate">${formatCurrency(globalStats.topCost)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-border bg-surface-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {[
              { label: "All", days: null },
              { label: "7d", days: 7 },
              { label: "30d", days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => setQuickFilter(days)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
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
              className={`p-1.5 rounded-md transition-colors ${showFilters ? "text-accent" : "text-muted hover:text-foreground"}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSortBy("cost")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                sortBy === "cost" ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Cost</span>
            </button>
            <button
              onClick={() => setSortBy("tokens")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                sortBy === "tokens" ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Zap className="w-4 h-4" />
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

      {/* List */}
      <div className="flex-1 overflow-auto">
        {allItems.length > 0 ? (
          <div>
            {/* Column Headers */}
            <div className="flex items-center gap-3 px-6 py-2 text-xs text-muted border-b border-border bg-surface-1 sticky top-0">
              <div className="w-10 text-center">#</div>
              <div className="flex-1">User</div>
              <div className="w-24 text-right">Cost</div>
              <div className="w-24 text-right hidden sm:block">Tokens</div>
              <div className="w-8" />
            </div>

            <div className="divide-y divide-border">
              {allItems.map((submission, index) => {
                const rank = index + 1;
                const isCurrentUser = session?.user?.username === submission.githubUsername;
                const rankIcon = getRankIcon(rank);

                return (
                  <Link
                    key={submission.id}
                    href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
                    className={`flex items-center gap-3 px-6 py-3.5 hover:bg-surface-1/80 transition-all cursor-pointer group ${getRankStyle(rank)} ${isCurrentUser ? "bg-accent/10 border-l-2 border-l-accent" : ""}`}
                  >
                    {/* Rank */}
                    <div className="w-10 flex-shrink-0 text-center">
                      {rankIcon || <span className="text-sm text-muted font-mono">{rank}</span>}
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar
                        src={submission.githubAvatar}
                        githubUsername={submission.githubUsername}
                        name={submission.githubName || submission.username}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium group-hover:text-accent transition-colors truncate">
                            {submission.githubUsername || submission.username}
                          </span>
                          {submission.verified && (
                            <div className="relative group/badge">
                              <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-card border border-border rounded text-[10px] text-muted whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none">
                                GitHub verified
                              </div>
                            </div>
                          )}
                        </div>
                        {submission.githubName && submission.githubName !== submission.githubUsername && (
                          <div className="text-xs text-muted truncate">{submission.githubName}</div>
                        )}
                      </div>
                    </div>

                    {/* Cost */}
                    <div className="w-24 text-right flex-shrink-0">
                      <div className="text-sm font-mono font-semibold text-accent">${formatCurrency(submission.totalCost)}</div>
                    </div>

                    {/* Tokens */}
                    <div className="w-24 text-right flex-shrink-0 hidden sm:block">
                      <div className="text-sm font-mono text-muted">{formatNumber(submission.totalTokens)}</div>
                    </div>

                    {/* Actions */}
                    <div className="w-8 flex-shrink-0">
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

              {!isDateFiltered && regularResult?.hasMore && (
                <div ref={loadMoreRef} className="py-4 text-center">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted" />
                </div>
              )}
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted" />
          </div>
        ) : (
          <div className="text-center py-16">
            <Trophy className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-base font-medium mb-1">No submissions yet</p>
            <p className="text-sm text-muted mb-4">Be the first on the leaderboard</p>
            <code className="text-sm font-mono text-accent">npx viberank</code>
          </div>
        )}
      </div>

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
              onClose={() => setShowShareCard(null)}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
