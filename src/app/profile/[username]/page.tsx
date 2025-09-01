"use client";

import { useQuery } from "@/hooks/useApi";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Github, Calendar, DollarSign, Zap, ArrowLeft, ExternalLink,
  TrendingUp, Code2, BarChart3, Activity, Hash
} from "lucide-react";
import Link from "next/link";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from "react";

export default function ProfilePage() {
  const params = useParams();
  const username = decodeURIComponent(params.username as string);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"7d" | "30d" | "all">("30d");
  
  const profileData = useQuery<any>(`/api/profile/${username}`);

  if (profileData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileData === null) {
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

  // Calculate statistics
  const totalCost = profileData.submissions.reduce((sum, sub) => sum + sub.totalCost, 0);
  const totalTokens = profileData.submissions.reduce((sum, sub) => sum + sub.totalTokens, 0);
  const daysActive = new Set(profileData.submissions.flatMap(sub => sub.dailyBreakdown.map(d => d.date))).size;
  const avgDailyCost = totalCost / daysActive;

  // Prepare chart data
  const allDailyData = profileData.submissions.flatMap(sub => sub.dailyBreakdown);
  const dailyDataMap = allDailyData.reduce((acc, day) => {
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

  // Get primary model used
  const modelCounts = profileData.submissions.flatMap(s => s.modelsUsed).reduce((acc, model) => {
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const primaryModel = Object.entries(modelCounts).sort(([,a], [,b]) => b - a)[0]?.[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to leaderboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Header */}
          <div className="mb-8">
            <div className="flex items-start gap-6 mb-6">
              {profileData.avatar && (
                <img
                  src={profileData.avatar}
                  alt={profileData.githubName || username}
                  className="w-20 h-20 rounded-full"
                />
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-light mb-2">
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
                      {primaryModel.includes("opus") ? "Opus 4" : "Sonnet 3.5"} user
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <p className="text-sm text-muted mb-1">Total Spent</p>
                <p className="text-2xl font-bold">${formatCurrency(totalCost)}</p>
                <p className="text-xs text-muted mt-1">${formatCurrency(avgDailyCost)}/day avg</p>
              </div>
              
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <p className="text-sm text-muted mb-1">Total Tokens</p>
                <p className="text-2xl font-bold">{formatNumber(totalTokens)}</p>
                <p className="text-xs text-muted mt-1">{formatNumber(Math.round(totalTokens / daysActive))}/day</p>
              </div>

              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <p className="text-sm text-muted mb-1">Days Active</p>
                <p className="text-2xl font-bold">{daysActive}</p>
                <p className="text-xs text-muted mt-1">{profileData.totalSubmissions} submissions</p>
              </div>

              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
                <p className="text-sm text-muted mb-1">Global Rank</p>
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted mt-1">Coming soon</p>
              </div>
            </div>
          </div>

          {/* Usage Chart */}
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-light flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Usage Over Time
              </h2>
              <div className="flex gap-1">
                {(["7d", "30d", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-3 py-1.5 text-xs transition-colors ${
                      selectedTimeRange === range
                        ? "text-foreground border-b-2 border-accent"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {range === "all" ? "All time" : `Last ${range}`}
                  </button>
                ))}
              </div>
            </div>
            
            {sortedDailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={sortedDailyData}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc8850" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#dc8850" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3734" strokeOpacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#a8a29e"
                    tick={{ fontSize: 11, fill: '#a8a29e' }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    stroke="#a8a29e" 
                    tick={{ fontSize: 11, fill: '#a8a29e' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#252321', 
                      border: '1px solid #3a3734',
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
                    stroke="#dc8850" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted text-sm">
                No data for selected time range
              </div>
            )}
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Token Breakdown */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-light mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Token Breakdown
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted">Input Tokens</span>
                    <span className="font-mono text-sm">{formatNumber(profileData.submissions[0]?.inputTokens || 0)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div 
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: `${(profileData.submissions[0]?.inputTokens || 0) / totalTokens * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted">Output Tokens</span>
                    <span className="font-mono text-sm">{formatNumber(profileData.submissions[0]?.outputTokens || 0)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(profileData.submissions[0]?.outputTokens || 0) / totalTokens * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted">Cache Read</span>
                    <span className="font-mono text-sm">{formatNumber(profileData.submissions[0]?.cacheReadTokens || 0)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${(profileData.submissions[0]?.cacheReadTokens || 0) / totalTokens * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted">Cache Creation</span>
                    <span className="font-mono text-sm">{formatNumber(profileData.submissions[0]?.cacheCreationTokens || 0)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${(profileData.submissions[0]?.cacheCreationTokens || 0) / totalTokens * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Insights */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-light mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" />
                Usage Insights
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted">Most Expensive Day</span>
                  <span className="font-mono text-sm">
                    ${formatCurrency(Math.max(...profileData.submissions[0]?.dailyBreakdown.map(d => d.totalCost) || [0]))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted">Average Daily Cost</span>
                  <span className="font-mono text-sm">${formatCurrency(avgDailyCost)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted">Total Days Tracked</span>
                  <span className="font-mono text-sm">{daysActive} days</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted">Last Updated</span>
                  <span className="text-sm">
                    {new Date(profileData.submissions[0]?.submittedAt || 0).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
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