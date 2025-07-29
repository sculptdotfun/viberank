"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, DollarSign, Cpu, Calendar, TrendingUp, User, Share2, Filter, Clock, X, CalendarDays } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession } from "next-auth/react";
import ShareCard from "./ShareCard";
import { formatNumber, formatCurrency, getGitHubAvatarUrl } from "@/lib/utils";

type SortBy = "cost" | "tokens";

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [showShareCard, setShowShareCard] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(true);
  const { data: session } = useSession();
  const submissions = useQuery(api.submissions.getLeaderboard, { 
    sortBy, 
    limit: 50,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) return (
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFC107] flex items-center justify-center text-xs font-bold text-black shadow-lg shadow-[#FFD700]/20">
        1
      </div>
    );
    if (rank === 2) return (
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E0E0E0] to-[#B0B0B0] flex items-center justify-center text-xs font-bold text-black shadow-lg shadow-[#C0C0C0]/20">
        2
      </div>
    );
    if (rank === 3) return (
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#CD7F32] to-[#A0522D] flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-[#CD7F32]/20">
        3
      </div>
    );
    return <span className="text-muted text-sm font-medium">{rank}</span>;
  };


  return (
    <div>
      {/* Sort Controls */}
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-light">Leaderboard</h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="flex gap-1 flex-1 sm:flex-initial">
              <button
                onClick={() => setSortBy("cost")}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-initial ${
                  sortBy === "cost"
                    ? "text-foreground border-b-2 border-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                By Cost
              </button>
              <button
                onClick={() => setSortBy("tokens")}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-initial ${
                  sortBy === "tokens"
                    ? "text-foreground border-b-2 border-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                By Tokens
              </button>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                showFilters || dateFrom || dateTo
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Filter className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="mb-4 sm:mb-6 overflow-hidden"
        >
          <div className="space-y-3">
            {/* Quick filters */}
            <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const today = new Date();
                const last7Days = new Date(today);
                last7Days.setDate(today.getDate() - 7);
                setDateFrom(last7Days.toISOString().split('T')[0]);
                setDateTo(today.toISOString().split('T')[0]);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all flex items-center gap-1.5 ${
                dateFrom && dateTo && 
                new Date(dateTo).getTime() - new Date(dateFrom).getTime() === 7 * 24 * 60 * 60 * 1000
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "bg-card hover:bg-card-hover text-muted hover:text-foreground border border-border/50"
              }`}
            >
              <Clock className="w-3 h-3" />
              Last 7 days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const last14Days = new Date(today);
                last14Days.setDate(today.getDate() - 14);
                setDateFrom(last14Days.toISOString().split('T')[0]);
                setDateTo(today.toISOString().split('T')[0]);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all flex items-center gap-1.5 ${
                dateFrom && dateTo && 
                Math.abs(new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000) === 14
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "bg-card hover:bg-card-hover text-muted hover:text-foreground border border-border/50"
              }`}
            >
              <Clock className="w-3 h-3" />
              Last 14 days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const last30Days = new Date(today);
                last30Days.setDate(today.getDate() - 30);
                setDateFrom(last30Days.toISOString().split('T')[0]);
                setDateTo(today.toISOString().split('T')[0]);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all flex items-center gap-1.5 ${
                dateFrom && dateTo && 
                Math.abs(new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000) >= 29 &&
                Math.abs(new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000) <= 31
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "bg-card hover:bg-card-hover text-muted hover:text-foreground border border-border/50"
              }`}
            >
              <Calendar className="w-3 h-3" />
              Last 30 days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                setDateFrom(thisMonth.toISOString().split('T')[0]);
                setDateTo(today.toISOString().split('T')[0]);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all flex items-center gap-1.5 ${(() => {
                if (!dateFrom || !dateTo) return false;
                const today = new Date();
                const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                
                return dateFrom === thisMonthStart.toISOString().split('T')[0] &&
                       dateTo === today.toISOString().split('T')[0];
              })()
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "bg-card hover:bg-card-hover text-muted hover:text-foreground border border-border/50"
              }`}
            >
              <Calendar className="w-3 h-3" />
              This month
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const last90Days = new Date(today);
                last90Days.setDate(today.getDate() - 90);
                setDateFrom(last90Days.toISOString().split('T')[0]);
                setDateTo(today.toISOString().split('T')[0]);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all flex items-center gap-1.5 ${
                dateFrom && dateTo && 
                Math.abs(new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000) >= 89 &&
                Math.abs(new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (24 * 60 * 60 * 1000) <= 91
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "bg-card hover:bg-card-hover text-muted hover:text-foreground border border-border/50"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Last 90 days
            </button>
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all ${
                !dateFrom && !dateTo
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "bg-card hover:bg-card-hover text-muted hover:text-foreground border border-border/50"
              }`}
            >
              All time
            </button>
            </div>
            
            {/* Custom date range */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted" />
                <span className="text-sm text-muted">Custom range:</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-card border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  placeholder="From"
                />
                <span className="text-muted text-sm">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-card border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  placeholder="To"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="p-1.5 hover:bg-card rounded-md transition-colors"
                    title="Clear dates"
                  >
                    <X className="w-4 h-4 text-muted hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <div className="mt-3 p-3 bg-accent/10 rounded-lg border border-accent/20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-accent">
                  Filtering results from {dateFrom && new Date(dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {dateFrom && dateTo && " to "}
                  {dateTo && new Date(dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <button
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-xs text-accent hover:text-accent/80 font-medium"
                >
                  Clear filter
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Leaderboard List */}
      <div className="space-y-2">
        {submissions ? (
          submissions.map((submission, index) => (
            <motion.div
              key={submission._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
              className="group"
            >
              {/* Mobile Card Layout */}
              <div className="sm:hidden bg-card rounded-lg p-4 relative border border-border/30 shadow-sm">
                {/* Rank Badge - Top Right */}
                <div className="absolute top-3 right-3">
                  {getRankBadge(index + 1)}
                </div>
                
                {/* User Info */}
                <div className="flex items-start gap-3 mb-3">
                  {submission.githubAvatar ? (
                    <img 
                      src={submission.githubAvatar} 
                      alt={submission.githubUsername || submission.username}
                      className="w-12 h-12 rounded-full bg-background"
                    />
                  ) : submission.githubUsername ? (
                    <img 
                      src={getGitHubAvatarUrl(submission.githubUsername, 48)} 
                      alt={submission.githubUsername}
                      className="w-12 h-12 rounded-full bg-background"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center">
                      <User className="w-6 h-6 text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-8">
                    <p className="font-medium text-foreground truncate">
                      {submission.githubUsername || submission.username}
                    </p>
                    {submission.githubName && submission.githubName !== submission.githubUsername && (
                      <p className="text-xs text-muted truncate">
                        {submission.githubName}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {submission.modelsUsed.map(m => m.includes("opus") ? "Opus" : "Sonnet").join(", ")}
                    </p>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background rounded-md p-2.5">
                    <p className="text-xs text-muted mb-0.5">Total Cost</p>
                    <p className="font-mono font-medium text-accent">
                      ${formatCurrency(submission.totalCost)}
                    </p>
                  </div>
                  <div className="bg-background rounded-md p-2.5">
                    <p className="text-xs text-muted mb-0.5">Tokens</p>
                    <p className="font-mono font-medium">
                      {formatNumber(submission.totalTokens)}
                    </p>
                  </div>
                </div>
                
                {/* Date Range & Share */}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted">
                    {submission.dateRange.start} → {submission.dateRange.end}
                  </p>
                  {(session?.user?.username === submission.githubUsername || 
                    session?.user?.email === submission.username) && (
                    <button
                      onClick={() => setShowShareCard(submission._id)}
                      className="p-1.5 rounded-md hover:bg-background transition-colors"
                      title="Share your rank"
                    >
                      <Share2 className="w-4 h-4 text-muted hover:text-accent" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Desktop Row Layout */}
              <div className="hidden sm:block p-4 rounded-lg bg-card/50 hover:bg-card border border-border/30 hover:border-border/50 transition-all hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="w-10 flex justify-center">
                    {getRankBadge(index + 1)}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {submission.githubAvatar ? (
                      <img 
                        src={submission.githubAvatar} 
                        alt={submission.githubUsername || submission.username}
                        className="w-10 h-10 rounded-full bg-card"
                      />
                    ) : submission.githubUsername ? (
                      <img 
                        src={getGitHubAvatarUrl(submission.githubUsername, 40)} 
                        alt={submission.githubUsername}
                        className="w-10 h-10 rounded-full bg-card"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center">
                        <User className="w-5 h-5 text-muted" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="font-medium text-foreground">
                          {submission.githubUsername || submission.username}
                        </p>
                        {submission.githubName && submission.githubName !== submission.githubUsername && (
                          <p className="text-sm text-muted">
                            {submission.githubName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                        <span>{submission.dateRange.start} → {submission.dateRange.end}</span>
                        <span>•</span>
                        <span>{submission.modelsUsed.map(m => m.includes("opus") ? "Opus" : "Sonnet").join(", ")}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-mono text-lg font-semibold text-accent">
                        ${formatCurrency(submission.totalCost)}
                      </p>
                      <p className="text-xs text-muted">total cost</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-medium">
                        {formatNumber(submission.totalTokens)}
                      </p>
                      <p className="text-xs text-muted">tokens</p>
                    </div>
                    
                    {/* Share button */}
                    {(session?.user?.username === submission.githubUsername || 
                      session?.user?.email === submission.username) && (
                      <button
                        onClick={() => setShowShareCard(submission._id)}
                        className="p-2 rounded-md hover:bg-card-hover transition-colors"
                        title="Share your rank"
                      >
                        <Share2 className="w-4 h-4 text-muted hover:text-accent" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Share Card Modal */}
              {showShareCard === submission._id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2"
                >
                  <ShareCard
                    rank={index + 1}
                    username={submission.username}
                    totalCost={submission.totalCost}
                    totalTokens={submission.totalTokens}
                    dateRange={submission.dateRange}
                    onClose={() => setShowShareCard(null)}
                  />
                </motion.div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-muted">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Loading leaderboard...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}