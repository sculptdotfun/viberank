"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar, Zap, ArrowLeft, ExternalLink,
  TrendingUp, Code2, Activity, Github
} from "lucide-react";
import Link from "next/link";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from "react";
import { useProfile } from "@/lib/data/hooks/useProfiles";

export default function ProfilePage() {
  const params = useParams();
  const username = decodeURIComponent(params.username as string);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"7d" | "30d" | "all">("30d");

  const { data: profileData, isLoading } = useProfile(username);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-light mb-2">Profile not found</h1>
          <p className="text-muted mb-6">No profile found for @{username}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-accent hover:text-accent-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to leaderboard
          </Link>
        </motion.div>
      </div>
    );
  }

  // Ensure submissions is always an array
  const submissions = profileData.submissions ?? [];
  const latestSubmission = submissions[0];

  // Calculate statistics with safe defaults
  const totalCost = submissions.reduce((sum, sub) => sum + sub.totalCost, 0);
  const totalTokens = submissions.reduce((sum, sub) => sum + sub.totalTokens, 0);
  const allDailyBreakdowns = submissions.flatMap(sub => sub.dailyBreakdown ?? []);
  const daysActive = new Set(allDailyBreakdowns.map(d => d.date)).size || 1;
  const avgDailyCost = totalCost / daysActive;

  // Prepare chart data
  const dailyDataMap = allDailyBreakdowns.reduce((acc, day) => {
    if (!acc[day.date]) {
      acc[day.date] = { date: day.date, cost: 0, tokens: 0 };
    }
    acc[day.date].cost += day.totalCost;
    acc[day.date].tokens += day.totalTokens;
    return acc;
  }, {} as Record<string, { date: string; cost: number; tokens: number }>);

  const sortedDailyData = Object.values(dailyDataMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(selectedTimeRange === "7d" ? -7 : selectedTimeRange === "30d" ? -30 : 0);

  // Get primary model used - count from daily breakdowns for more accurate representation
  const allModelsUsed = allDailyBreakdowns.flatMap(d => d.modelsUsed ?? []);
  const modelCounts = allModelsUsed.reduce((acc, model) => {
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const primaryModel = Object.entries(modelCounts).sort(([,a], [,b]) => b - a)[0]?.[0];

  // Get token breakdown from latest submission
  const inputTokens = latestSubmission?.inputTokens ?? 0;
  const outputTokens = latestSubmission?.outputTokens ?? 0;
  const cacheReadTokens = latestSubmission?.cacheReadTokens ?? 0;
  const cacheCreationTokens = latestSubmission?.cacheCreationTokens ?? 0;
  const latestDailyBreakdown = latestSubmission?.dailyBreakdown ?? [];
  const maxDailyCost = latestDailyBreakdown.length > 0
    ? Math.max(...latestDailyBreakdown.map(d => d.totalCost))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to leaderboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Profile Header */}
          <div className="mb-8">
            <div className="flex items-start gap-5 mb-6">
              {profileData.avatar && (
                <img
                  src={profileData.avatar}
                  alt={profileData.githubName || username}
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-semibold mb-2">
                  {profileData.githubName || username}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
                  <a
                    href={`https://github.com/${profileData.githubUsername || username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-accent transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    @{profileData.githubUsername || username}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {new Date(profileData.createdAt).toLocaleDateString()}
                  </span>
                  {primaryModel && (
                    <span className="flex items-center gap-1">
                      <Code2 className="w-4 h-4" />
                      {primaryModel.includes("opus-4-5") ? "Opus 4.5" :
                       primaryModel.includes("opus") ? "Opus 4" :
                       primaryModel.includes("sonnet-4-5") ? "Sonnet 4.5" :
                       primaryModel.includes("sonnet") ? "Sonnet 4" :
                       primaryModel.includes("haiku") ? "Haiku 4.5" : "Claude"} user
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted mb-1">Total Spent</p>
                <p className="text-xl font-semibold font-mono">${formatCurrency(totalCost)}</p>
                <p className="text-xs text-muted mt-1">${formatCurrency(avgDailyCost)}/day avg</p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted mb-1">Total Tokens</p>
                <p className="text-xl font-semibold font-mono">{formatNumber(totalTokens)}</p>
                <p className="text-xs text-muted mt-1">{formatNumber(Math.round(totalTokens / daysActive))}/day</p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted mb-1">Days Active</p>
                <p className="text-xl font-semibold">{daysActive}</p>
                <p className="text-xs text-muted mt-1">{profileData.totalSubmissions} submissions</p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted mb-1">Global Rank</p>
                <p className="text-xl font-semibold">-</p>
                <p className="text-xs text-muted mt-1">Coming soon</p>
              </div>
            </div>
          </div>

          {/* Usage Chart */}
          <div className="bg-card border border-border rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                Usage Over Time
              </h2>
              <div className="flex gap-1">
                {(["7d", "30d", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      selectedTimeRange === range
                        ? "bg-accent text-white"
                        : "text-muted hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    {range === "all" ? "All" : range}
                  </button>
                ))}
              </div>
            </div>

            {sortedDailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={sortedDailyData}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    tick={{ fontSize: 11, fill: '#888888' }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    stroke="#888888"
                    tick={{ fontSize: 11, fill: '#888888' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e1e1e',
                      border: '1px solid #2e2e2e',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                    labelFormatter={(date) => new Date(date).toLocaleDateString('en', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#f97316"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted text-sm">
                No data for selected time range
              </div>
            )}
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Token Breakdown */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h2 className="text-base font-medium mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                Token Breakdown
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted">Input Tokens</span>
                    <span className="font-mono text-xs">{formatNumber(inputTokens)}</span>
                  </div>
                  <div className="w-full bg-surface-1 rounded-full h-1.5">
                    <div
                      className="bg-accent h-1.5 rounded-full transition-all"
                      style={{ width: `${totalTokens > 0 ? (inputTokens / totalTokens * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted">Output Tokens</span>
                    <span className="font-mono text-xs">{formatNumber(outputTokens)}</span>
                  </div>
                  <div className="w-full bg-surface-1 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${totalTokens > 0 ? (outputTokens / totalTokens * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted">Cache Read</span>
                    <span className="font-mono text-xs">{formatNumber(cacheReadTokens)}</span>
                  </div>
                  <div className="w-full bg-surface-1 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${totalTokens > 0 ? (cacheReadTokens / totalTokens * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted">Cache Creation</span>
                    <span className="font-mono text-xs">{formatNumber(cacheCreationTokens)}</span>
                  </div>
                  <div className="w-full bg-surface-1 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${totalTokens > 0 ? (cacheCreationTokens / totalTokens * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Insights */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h2 className="text-base font-medium mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                Usage Insights
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-xs text-muted">Most Expensive Day</span>
                  <span className="font-mono text-xs">${formatCurrency(maxDailyCost)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-xs text-muted">Average Daily Cost</span>
                  <span className="font-mono text-xs">${formatCurrency(avgDailyCost)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-xs text-muted">Total Days Tracked</span>
                  <span className="font-mono text-xs">{daysActive} days</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-muted">Last Updated</span>
                  <span className="text-xs">
                    {latestSubmission?.submittedAt
                      ? new Date(latestSubmission.submittedAt).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
