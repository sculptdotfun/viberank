"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, DollarSign, Zap, Calendar, User, Share2, Filter, Clock, X, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ShareCard from "./ShareCard";
import { formatNumber, formatCurrency, getGitHubAvatarUrl } from "@/lib/utils";

type SortBy = "cost" | "tokens";

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [showShareCard, setShowShareCard] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const { data: session } = useSession();

  const submissions = useQuery(api.submissions.getLeaderboard, { 
    sortBy, 
    limit: 50,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-orange-600" />;
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
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickFilter(null)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                !dateFrom && !dateTo
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setQuickFilter(7)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                dateFrom && dateTo && 
                new Date(dateTo).getTime() - new Date(dateFrom).getTime() === 7 * 24 * 60 * 60 * 1000
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setQuickFilter(30)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                dateFrom && dateTo && 
                Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000)) === 30
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                showFilters || (dateFrom && dateTo)
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Custom
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy("cost")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                sortBy === "cost"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Cost
            </button>
            <button
              onClick={() => setSortBy("tokens")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                sortBy === "tokens"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              <Zap className="w-4 h-4" />
              Tokens
            </button>
          </div>
        </div>

        {/* Custom Date Range */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap items-center gap-3 px-3 py-2 bg-card/30 rounded-lg"
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
      </div>

      {/* Leaderboard Table */}
      <div className="space-y-2">
        {submissions ? (
          <>
            {/* Desktop View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-border/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-card/30">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted">Rank</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted">User</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted">Total Cost</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted">Tokens</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted">Model</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission, index) => {
                    const isCurrentUser = session?.user?.username === submission.githubUsername || 
                                         session?.user?.email === submission.username;
                    
                    return (
                      <motion.tr
                        key={submission._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className={`border-b border-border/30 hover:bg-card/50 transition-colors ${
                          isCurrentUser ? "bg-accent/5" : ""
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center w-8">
                            {getRankDisplay(index + 1)}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {submission.githubAvatar ? (
                              <img 
                                src={submission.githubAvatar} 
                                alt={submission.githubUsername || submission.username}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : submission.githubUsername ? (
                              <img 
                                src={getGitHubAvatarUrl(submission.githubUsername, 40)} 
                                alt={submission.githubUsername}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center">
                                <User className="w-5 h-5 text-muted" />
                              </div>
                            )}
                            <div>
                              <Link 
                                href={`/profile/${submission.githubUsername || submission.username}`}
                                className="font-medium hover:text-accent transition-colors"
                              >
                                {submission.githubUsername || submission.username}
                              </Link>
                              {submission.githubName && submission.githubName !== submission.githubUsername && (
                                <p className="text-sm text-muted">
                                  {submission.githubName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className="font-mono font-semibold text-lg">
                            ${formatCurrency(submission.totalCost)}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className="font-mono text-muted">
                            {formatNumber(submission.totalTokens)}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-xs font-medium text-muted">
                            {submission.modelsUsed.map(m => m.includes("opus") ? "Opus" : "Sonnet").join(" + ")}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {isCurrentUser && (
                            <button
                              onClick={() => setShowShareCard(submission._id)}
                              className="p-2 rounded-lg hover:bg-card transition-colors"
                              title="Share your rank"
                            >
                              <Share2 className="w-4 h-4 text-muted hover:text-accent" />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="sm:hidden space-y-3">
              {submissions.map((submission, index) => {
                const isCurrentUser = session?.user?.username === submission.githubUsername || 
                                     session?.user?.email === submission.username;
                
                return (
                  <motion.div
                    key={submission._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`p-4 rounded-xl border ${
                      isCurrentUser 
                        ? "border-accent/30 bg-accent/5" 
                        : "border-border/50 bg-card/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8">
                          {getRankDisplay(index + 1)}
                        </div>
                        {submission.githubAvatar ? (
                          <img 
                            src={submission.githubAvatar} 
                            alt={submission.githubUsername || submission.username}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : submission.githubUsername ? (
                          <img 
                            src={getGitHubAvatarUrl(submission.githubUsername, 48)} 
                            alt={submission.githubUsername}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center">
                            <User className="w-6 h-6 text-muted" />
                          </div>
                        )}
                        <div>
                          <Link 
                            href={`/profile/${submission.githubUsername || submission.username}`}
                            className="font-medium hover:text-accent transition-colors"
                          >
                            {submission.githubUsername || submission.username}
                          </Link>
                          {submission.githubName && submission.githubName !== submission.githubUsername && (
                            <p className="text-sm text-muted">
                              {submission.githubName}
                            </p>
                          )}
                        </div>
                      </div>
                      {isCurrentUser && (
                        <button
                          onClick={() => setShowShareCard(submission._id)}
                          className="p-2"
                        >
                          <Share2 className="w-4 h-4 text-muted" />
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted mb-1">Total Cost</p>
                          <p className="font-mono font-semibold">
                            ${formatCurrency(submission.totalCost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted mb-1">Tokens</p>
                          <p className="font-mono">
                            {formatNumber(submission.totalTokens)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">
                          {submission.modelsUsed.map(m => m.includes("opus") ? "Opus" : "Sonnet").join(" + ")} user
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs text-accent font-medium">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Share Card Modal */}
            {showShareCard && submissions.find(s => s._id === showShareCard) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                onClick={() => setShowShareCard(null)}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <ShareCard
                    rank={submissions.findIndex(s => s._id === showShareCard) + 1}
                    username={submissions.find(s => s._id === showShareCard)!.username}
                    totalCost={submissions.find(s => s._id === showShareCard)!.totalCost}
                    totalTokens={submissions.find(s => s._id === showShareCard)!.totalTokens}
                    dateRange={submissions.find(s => s._id === showShareCard)!.dateRange}
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
        
        {submissions && submissions.length === 0 && (
          <div className="text-center py-20">
            <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-lg text-muted">No submissions yet</p>
            <p className="text-sm text-muted mt-2">Be the first to submit your stats!</p>
          </div>
        )}
      </div>
    </div>
  );
}