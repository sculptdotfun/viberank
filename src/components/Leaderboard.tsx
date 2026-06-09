"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Award, DollarSign, Zap, Calendar, Share2, X, BadgeCheck, Loader2, Terminal, Copy, Check, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ShareCard from "./ShareCard";
import Avatar from "./Avatar";
import { formatNumber, formatCurrency, toolLabel } from "@/lib/utils";
import { useLeaderboard, useLeaderboardByDateRange } from "@/lib/data/hooks/useSubmissions";
import { useGlobalStats } from "@/lib/data/hooks/useStats";
import type { Submission } from "@/lib/data/types";

type SortBy = "cost" | "tokens";

interface LeaderboardProps {
  onCopyCommand?: () => void;
  copiedToClipboard?: boolean;
}

// Small flat pills showing which tools a submission used.
function ToolChips({ tools, max = 3, className = "" }: { tools?: string[]; max?: number; className?: string }) {
  if (!tools || tools.length === 0) return null;
  const shown = tools.slice(0, max);
  const extra = tools.length - shown.length;
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {shown.map((t) => (
        <span
          key={t}
          className="text-[10px] font-medium leading-none px-1.5 py-1 rounded-md bg-surface-3 text-muted border border-border-subtle"
        >
          {toolLabel(t)}
        </span>
      ))}
      {extra > 0 && <span className="text-[10px] text-muted leading-none">+{extra}</span>}
    </div>
  );
}

const RANK_META = [
  { label: "1st", Icon: Trophy, color: "text-[#f5b008]" },
  { label: "2nd", Icon: Medal, color: "text-[#b8bcc4]" },
  { label: "3rd", Icon: Award, color: "text-[#c2703f]" },
];

function PodiumCard({
  submission,
  rank,
  isCurrentUser,
}: {
  submission: Submission;
  rank: number;
  isCurrentUser: boolean;
}) {
  const meta = RANK_META[rank - 1];
  const { Icon } = meta;
  const featured = rank === 1;
  return (
    <Link
      href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
      className={`group flex flex-col rounded-2xl border bg-surface-1 p-4 transition-colors hover:bg-surface-2 ${
        featured ? "border-accent/40 sm:p-5" : "border-border"
      } ${isCurrentUser ? "ring-1 ring-accent" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${meta.color}`} />
          <span className="text-xs font-semibold text-muted">{meta.label}</span>
        </div>
        {submission.verified ? (
          <BadgeCheck className="w-4 h-4 text-blue-500" />
        ) : (
          <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-muted/15 text-muted">cli</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Avatar
          src={submission.githubAvatar}
          githubUsername={submission.githubUsername}
          name={submission.githubName || submission.username}
          size={featured ? "lg" : "md"}
        />
        <div className="min-w-0">
          <div className="font-semibold truncate group-hover:text-accent transition-colors">
            {submission.githubUsername || submission.username}
          </div>
          {submission.githubName && submission.githubName !== submission.githubUsername && (
            <div className="text-xs text-muted truncate">{submission.githubName}</div>
          )}
        </div>
      </div>

      <div className="mt-auto">
        <div className={`font-mono font-bold text-accent ${featured ? "text-2xl" : "text-xl"}`}>
          ${formatCurrency(submission.totalCost)}
        </div>
        <div className="text-xs text-muted font-mono mt-0.5">{formatNumber(submission.totalTokens)} tokens</div>
        <ToolChips tools={submission.tools} className="mt-3" />
      </div>
    </Link>
  );
}

function StatCard({ icon: Icon, label, value, accent = false }: { icon: typeof Users; label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface-1 rounded-xl px-4 py-3.5 border border-border">
      <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`text-xl font-bold font-mono truncate ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

export default function Leaderboard({ onCopyCommand, copiedToClipboard }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [tool, setTool] = useState<string | null>(null);
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
    !isDateFiltered
      ? { sortBy, page, pageSize: ITEMS_PER_PAGE, tool: tool ?? undefined }
      : "skip"
  );

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

  const podiumCount = Math.min(3, allItems.length);
  const podium = allItems.slice(0, podiumCount);
  const rest = allItems.slice(podiumCount);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Claude Code, Codex &amp; AI Coding Leaderboard</h1>
            <p className="text-sm text-muted mt-1">Who's spending the most across AI coding tools?</p>
          </div>
          {onCopyCommand && (
            <button
              onClick={onCopyCommand}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm bg-surface-1 hover:bg-surface-2 border border-border rounded-lg transition-colors"
            >
              <Terminal className="w-4 h-4 text-muted" />
              <code className="font-mono text-accent font-medium">npx viberank-cli</code>
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
            <StatCard icon={Users} label="Users" value={formatNumber(globalStats.totalUsers)} />
            <StatCard icon={DollarSign} label="Total Spent" value={`$${formatNumber(globalStats.totalCost)}`} accent />
            <StatCard icon={Zap} label="Total Tokens" value={formatNumber(globalStats.totalTokens)} />
            <StatCard icon={Trophy} label="Top Spender" value={`$${formatNumber(globalStats.topCost)}`} />
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

            {availableTools.length > 1 && (
              <select
                value={tool ?? ""}
                onChange={(e) => setTool(e.target.value || null)}
                aria-label="Filter by tool"
                className={`px-2.5 py-1.5 text-sm font-medium rounded-md bg-surface-2 border border-border transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${
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

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {allItems.length > 0 ? (
          <div className="px-6 py-5">
            {/* Podium */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-end mb-6">
              {podium.map((submission, i) => {
                const rank = i + 1;
                const order = rank === 1 ? "order-1 sm:order-2" : rank === 2 ? "order-2 sm:order-1" : "order-3";
                return (
                  <div key={submission.id} className={order}>
                    <PodiumCard
                      submission={submission}
                      rank={rank}
                      isCurrentUser={session?.user?.username === submission.githubUsername}
                    />
                  </div>
                );
              })}
            </div>

            {/* Full table */}
            {rest.length > 0 && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-muted bg-surface-1 border-b border-border">
                  <div className="w-8 text-center">#</div>
                  <div className="flex-1">User</div>
                  <div className="hidden md:block w-44">Tools</div>
                  <div className="w-28 text-right">Cost</div>
                  <div className="w-24 text-right hidden sm:block">Tokens</div>
                  <div className="w-8" />
                </div>

                <div className="divide-y divide-border-subtle">
                  {rest.map((submission, i) => {
                    const rank = podiumCount + i + 1;
                    const isCurrentUser = session?.user?.username === submission.githubUsername;
                    return (
                      <Link
                        key={submission.id}
                        href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors cursor-pointer group ${isCurrentUser ? "bg-accent/10 border-l-2 border-l-accent" : ""}`}
                      >
                        <div className="w-8 flex-shrink-0 text-center text-sm text-muted font-mono">{rank}</div>

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

                        <div className="hidden md:block w-44">
                          <ToolChips tools={submission.tools} max={3} />
                        </div>

                        <div className="w-28 text-right flex-shrink-0">
                          <div className="text-sm font-mono font-semibold text-accent">${formatCurrency(submission.totalCost)}</div>
                        </div>

                        <div className="w-24 text-right flex-shrink-0 hidden sm:block">
                          <div className="text-sm font-mono text-muted">{formatNumber(submission.totalTokens)}</div>
                        </div>

                        <div className="w-8 flex-shrink-0 flex justify-end">
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

            {!isDateFiltered && regularResult?.hasMore && (
              <div ref={loadMoreRef} className="py-6 text-center">
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted" />
              </div>
            )}
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
            <code className="text-sm font-mono text-accent">npx viberank-cli</code>
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
