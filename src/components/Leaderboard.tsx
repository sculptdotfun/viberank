"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Award, DollarSign, Zap, Calendar, Share2, X, ChevronDown, ArrowUpRight, ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ShareCard from "./ShareCard";
import Avatar from "./Avatar";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useLeaderboard, useLeaderboardByDateRange } from "@/lib/data/hooks/useSubmissions";

type SortBy = "cost" | "tokens";

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [showShareCard, setShowShareCard] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const { data: session } = useSession();

  const ITEMS_PER_PAGE = 25;

  // Use date range query when filters are active, otherwise use regular paginated query
  const isDateFiltered = dateFrom && dateTo;

  const { data: regularResult } = useLeaderboard(
    !isDateFiltered
      ? { sortBy, page, pageSize: ITEMS_PER_PAGE }
      : "skip"
  );

  const { data: dateFilteredResult } = useLeaderboardByDateRange(
    isDateFiltered
      ? { dateFrom, dateTo, sortBy, limit: ITEMS_PER_PAGE }
      : "skip"
  );

  // Use the appropriate result based on which query ran
  const result = isDateFiltered ? dateFilteredResult : regularResult;

  // Use data directly from backend - no client-side slicing needed
  const paginatedSubmissions = result?.items;
  // Regular query has totalPages, date filtered query doesn't - ensure it's always a number
  const totalPages = (!isDateFiltered && regularResult?.totalPages) || 1;

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
      >
        <Trophy className="w-5 h-5 text-yellow-500" />
      </motion.div>
    );
    if (rank === 2) return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
      >
        <Medal className="w-5 h-5 text-gray-400" />
      </motion.div>
    );
    if (rank === 3) return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
      >
        <Award className="w-5 h-5 text-orange-600" />
      </motion.div>
    );
    return <span className="text-lg font-semibold text-muted">{rank}</span>;
  };

  // Quick filter functions
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
    setPage(0); // Reset to first page when filtering
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setQuickFilter(null)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                !dateFrom && !dateTo
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card/50"
              }`}
            >
              All Time
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setQuickFilter(7)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                dateFrom && dateTo && 
                new Date(dateTo).getTime() - new Date(dateFrom).getTime() === 7 * 24 * 60 * 60 * 1000
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card/50"
              }`}
            >
              7 Days
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setQuickFilter(30)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                dateFrom && dateTo && 
                Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000)) === 30
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card/50"
              }`}
            >
              30 Days
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                showFilters || (dateFrom && dateTo)
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              Custom
              <motion.div
                animate={{ rotate: showFilters ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3 h-3" />
              </motion.div>
            </motion.button>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSortBy("cost")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                sortBy === "cost"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card/50"
              }`}
            >
              <DollarSign className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              Cost
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSortBy("tokens")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                sortBy === "tokens"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card/50"
              }`}
            >
              <Zap className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              Tokens
            </motion.button>
          </div>
        </div>

        {/* Custom Date Range */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap items-center gap-3 px-3 py-2 bg-card/30 rounded-lg overflow-hidden"
            >
            <span className="text-sm text-muted">Date range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1 text-sm bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <span className="text-sm text-muted">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1 text-sm bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="p-1 hover:bg-card rounded transition-colors"
              >
                <X className="w-4 h-4 text-muted hover:text-foreground" />
              </button>
            )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Leaderboard Table */}
      <div className="space-y-3">
        {paginatedSubmissions ? (
          <>
            {/* Desktop View */}
            <div className="hidden sm:block">
              <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr className="bg-background/30 border-b border-border/50">
                      <th className="text-left py-4 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Rank</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Developer</th>
                      <th className="text-right py-4 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Spent</th>
                      <th className="text-right py-4 px-6 text-xs font-semibold text-muted uppercase tracking-wider">Tokens</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                <tbody>
                  {paginatedSubmissions.map((submission, index) => {
                    const actualRank = page * ITEMS_PER_PAGE + index + 1;
                    const isCurrentUser = session?.user?.username === submission.githubUsername || 
                                         session?.user?.email === submission.username;
                    
                    return (
                      <motion.tr
                        key={submission.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
                        className={`group relative border-b border-border/50 transition-all hover:bg-card/50 ${
                          isCurrentUser ? "bg-accent/5 hover:bg-accent/10" : ""
                        }`}
                      >
                        <td className="py-5 px-6">
                          <div className="flex items-center">
                            <span className="text-lg font-semibold text-muted">{actualRank}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar
                                src={submission.githubAvatar}
                                githubUsername={submission.githubUsername}
                                name={submission.githubName || submission.username}
                                size="md"
                              />
                              {actualRank <= 3 && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center">
                                  {getRankDisplay(actualRank)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Link 
                                  href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
                                  className="font-medium hover:text-accent transition-colors"
                                >
                                  {submission.githubUsername || submission.username}
                                </Link>
                                {submission.verified && (
                                  <div className="group/badge relative inline-flex">
                                    <BadgeCheck className="w-4 h-4 text-blue-500" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover/badge:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                      Verified via GitHub authentication
                                    </div>
                                  </div>
                                )}
                              </div>
                              {submission.githubName && submission.githubName !== submission.githubUsername && (
                                <p className="text-xs text-muted mt-0.5">
                                  {submission.githubName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div>
                            <p className="font-mono font-semibold text-foreground">
                              ${formatCurrency(submission.totalCost)}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              ${(submission.dailyBreakdown.length > 0 ? submission.totalCost / submission.dailyBreakdown.length : 0).toFixed(0)}/day
                            </p>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div>
                            <p className="font-mono text-sm font-medium">
                              {formatNumber(submission.totalTokens)}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {submission.dailyBreakdown.length} days
                            </p>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center justify-end gap-2">
                            {isCurrentUser && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowShareCard(submission.id)}
                                className="p-1.5 rounded-lg hover:bg-card/50 transition-all opacity-0 group-hover:opacity-100"
                                title="Share your rank"
                              >
                                <Share2 className="w-3.5 h-3.5 text-muted hover:text-accent" />
                              </motion.button>
                            )}
                            <Link
                              href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
                              className="p-1.5 rounded-lg hover:bg-card/50 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5 text-muted hover:text-foreground" />
                            </Link>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

            {/* Mobile View */}
            <div className="sm:hidden space-y-3">
              {paginatedSubmissions.map((submission, index) => {
                const actualRank = page * ITEMS_PER_PAGE + index + 1;
                const isCurrentUser = session?.user?.username === submission.githubUsername || 
                                     session?.user?.email === submission.username;
                
                return (
                  <motion.div
                    key={submission.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    className={`p-4 rounded-xl border transition-all shadow-sm ${
                      isCurrentUser
                        ? "border-accent/30 bg-accent/5 shadow-accent/10"
                        : "border-border/50 bg-card/30 hover:bg-card/50 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-7 h-7 flex-shrink-0">
                          <span className="text-base font-bold text-muted">{actualRank}</span>
                        </div>
                        <Avatar
                          src={submission.githubAvatar}
                          githubUsername={submission.githubUsername}
                          name={submission.githubName || submission.username}
                          size="md"
                          className="flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <Link 
                            href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
                            className="group inline-flex items-center gap-1 font-medium hover:text-accent transition-colors text-sm truncate"
                          >
                            <span className="truncate">{submission.githubUsername || submission.username}</span>
                            {submission.verified && (
                              <div className="group/badge relative inline-flex flex-shrink-0">
                                <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover/badge:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                  Verified via GitHub authentication
                                </div>
                              </div>
                            )}
                          </Link>
                          {submission.githubName && submission.githubName !== submission.githubUsername && (
                            <p className="text-xs text-muted truncate">
                              {submission.githubName}
                            </p>
                          )}
                        </div>
                      </div>
                      {isCurrentUser && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowShareCard(submission.id)}
                          className="p-1.5 -mr-1 flex-shrink-0"
                        >
                          <Share2 className="w-4 h-4 text-muted" />
                        </motion.button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted mb-0.5">Total Cost</p>
                          <p className="font-mono font-semibold text-sm">
                            ${formatCurrency(submission.totalCost)}
                          </p>
                          <p className="text-[10px] text-muted/70">
                            ${(submission.dailyBreakdown.length > 0 ? submission.totalCost / submission.dailyBreakdown.length : 0).toFixed(0)}/day
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted mb-0.5">Tokens</p>
                          <p className="font-mono text-sm">
                            {formatNumber(submission.totalTokens)}
                          </p>
                          <p className="text-[10px] text-muted/70">
                            {submission.dailyBreakdown.length} days
                          </p>
                        </div>
                      </div>
                      {isCurrentUser && (
                        <div className="text-center pt-1">
                          <span className="text-xs text-accent font-medium">
                            This is you!
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Share Card Modal */}
            {showShareCard && paginatedSubmissions && paginatedSubmissions.find(s => s.id === showShareCard) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                onClick={() => setShowShareCard(null)}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <ShareCard
                    rank={paginatedSubmissions.findIndex(s => s.id === showShareCard) + 1 + (page * ITEMS_PER_PAGE)}
                    username={paginatedSubmissions.find(s => s.id === showShareCard)!.username}
                    totalCost={paginatedSubmissions.find(s => s.id === showShareCard)!.totalCost}
                    totalTokens={paginatedSubmissions.find(s => s.id === showShareCard)!.totalTokens}
                    dateRange={paginatedSubmissions.find(s => s.id === showShareCard)!.dateRange}
                    onClose={() => setShowShareCard(null)}
                  />
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-2 text-muted">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Loading leaderboard...
            </div>
          </div>
        )}
        
        {paginatedSubmissions && paginatedSubmissions.length === 0 && (
          <div className="text-center py-20">
            <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-lg text-muted">No submissions yet</p>
            <p className="text-sm text-muted mt-2">Be the first to submit your stats!</p>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-muted text-center sm:text-left">
              Page {page + 1} of {totalPages || 1}
            </p>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className={`p-1.5 rounded-lg transition-colors ${
                  page === 0 
                    ? "text-muted/50 cursor-not-allowed" 
                    : "text-muted hover:text-foreground hover:bg-card"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-0.5">
                {/* Always show first page */}
                <button
                  onClick={() => setPage(0)}
                  className={`px-2.5 py-1 text-xs sm:text-sm rounded-lg transition-colors ${
                    page === 0
                      ? "bg-accent text-white"
                      : "text-muted hover:text-foreground hover:bg-card"
                  }`}
                >
                  1
                </button>
                
                {/* Show ellipsis if needed */}
                {page > 2 && <span className="text-muted px-1 hidden sm:inline">...</span>}
                
                {/* Show current page and adjacent pages on desktop, only current on mobile */}
                {Array.from({ length: totalPages }, (_, i) => {
                  if (i === 0 || i === totalPages - 1) return null; // Already shown
                  
                  const showOnDesktop = i >= page - 1 && i <= page + 1;
                  const showOnMobile = i === page;
                  
                  if (showOnDesktop) {
                    return (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`px-2.5 py-1 text-xs sm:text-sm rounded-lg transition-colors ${
                          showOnMobile ? '' : 'hidden sm:inline-block'
                        } ${
                          i === page
                            ? "bg-accent text-white"
                            : "text-muted hover:text-foreground hover:bg-card"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  }
                  return null;
                })}
                
                {/* Show ellipsis if needed */}
                {page < totalPages - 3 && <span className="text-muted px-1 hidden sm:inline">...</span>}
                
                {/* Always show last page if more than 1 page */}
                {totalPages > 1 && (
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    className={`px-2.5 py-1 text-xs sm:text-sm rounded-lg transition-colors ${
                      page === totalPages - 1
                        ? "bg-accent text-white"
                        : "text-muted hover:text-foreground hover:bg-card"
                    }`}
                  >
                    {totalPages}
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className={`p-1.5 rounded-lg transition-colors ${
                  page === totalPages - 1
                    ? "text-muted/50 cursor-not-allowed" 
                    : "text-muted hover:text-foreground hover:bg-card"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}