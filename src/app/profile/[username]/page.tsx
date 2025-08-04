"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Github, Calendar, DollarSign, Zap, ArrowLeft, ExternalLink, 
  Trophy, TrendingUp, Sparkles, Award, Flame, Code2, 
  Brain, Cpu, Share2, Download
} from "lucide-react";
import Link from "next/link";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import { useState } from "react";

// Define achievements
const ACHIEVEMENTS = [
  { id: "early_adopter", name: "Early Adopter", icon: Sparkles, description: "Joined in the first month", color: "from-purple-500 to-pink-500" },
  { id: "power_user", name: "Power User", icon: Flame, description: "Over 1M tokens used", threshold: 1000000, field: "totalTokens", color: "from-orange-500 to-red-500" },
  { id: "big_spender", name: "Big Spender", icon: DollarSign, description: "Over $100 spent", threshold: 100, field: "totalCost", color: "from-green-500 to-emerald-500" },
  { id: "consistent", name: "Consistent Coder", icon: Calendar, description: "Active for 30+ days", threshold: 30, field: "daysActive", color: "from-blue-500 to-cyan-500" },
  { id: "opus_master", name: "Opus Master", icon: Brain, description: "Primary Opus user", color: "from-indigo-500 to-purple-500" },
];

const CHART_COLORS = {
  primary: "#f97316", // accent color
  secondary: "#3b82f6",
  tertiary: "#10b981",
  quaternary: "#8b5cf6",
};

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [hoveredAchievement, setHoveredAchievement] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"7d" | "30d" | "all">("30d");
  
  const profileData = useQuery(api.submissions.getProfile, { username });

  if (profileData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted animate-pulse">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileData === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 bg-card rounded-lg shadow-lg"
        >
          <h1 className="text-3xl font-light mb-4">Profile not found</h1>
          <p className="text-muted mb-8">No profile found for @{username}</p>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to leaderboard
          </Link>
        </motion.div>
      </div>
    );
  }

  // Calculate statistics
  const latestSubmission = profileData.submissions[0];
  const totalCost = profileData.submissions.reduce((sum, sub) => sum + sub.totalCost, 0);
  const totalTokens = profileData.submissions.reduce((sum, sub) => sum + sub.totalTokens, 0);
  const daysActive = new Set(profileData.submissions.flatMap(sub => sub.dailyBreakdown.map(d => d.date))).size;
  const avgDailyCost = totalCost / daysActive;
  const avgDailyTokens = totalTokens / daysActive;

  // Check achievements
  const earnedAchievements = ACHIEVEMENTS.filter(achievement => {
    if (achievement.id === "early_adopter") {
      const joinDate = new Date(profileData.createdAt);
      const firstMonth = new Date('2024-06-01'); // Adjust based on your launch date
      return joinDate < firstMonth;
    }
    if (achievement.threshold && achievement.field) {
      if (achievement.field === "totalCost") return totalCost >= achievement.threshold;
      if (achievement.field === "totalTokens") return totalTokens >= achievement.threshold;
      if (achievement.field === "daysActive") return daysActive >= achievement.threshold;
    }
    if (achievement.id === "opus_master") {
      const modelCounts = profileData.submissions.flatMap(s => s.modelsUsed).reduce((acc, model) => {
        acc[model] = (acc[model] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topModel = Object.entries(modelCounts).sort(([,a], [,b]) => b - a)[0]?.[0];
      return topModel?.includes("opus");
    }
    return false;
  });

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

  // Token distribution for pie chart
  const tokenDistribution = latestSubmission ? [
    { name: "Input", value: latestSubmission.inputTokens, color: CHART_COLORS.primary },
    { name: "Output", value: latestSubmission.outputTokens, color: CHART_COLORS.secondary },
    { name: "Cache Creation", value: latestSubmission.cacheCreationTokens, color: CHART_COLORS.tertiary },
    { name: "Cache Read", value: latestSubmission.cacheReadTokens, color: CHART_COLORS.quaternary },
  ] : [];

  // Radial bar data for stats
  const radialData = [
    { name: "Cost", value: (totalCost / 1000) * 100, fill: CHART_COLORS.primary }, // Scale for display
    { name: "Tokens", value: (totalTokens / 10000000) * 100, fill: CHART_COLORS.secondary }, // Scale for display
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to leaderboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Header Card */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl p-8 mb-8 shadow-xl border border-border/50">
            <div className="flex flex-col md:flex-row items-start gap-8">
              {/* Avatar and basic info */}
              <div className="flex items-start gap-6">
                {profileData.avatar && (
                  <motion.img
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    src={profileData.avatar}
                    alt={profileData.githubName || username}
                    className="w-24 h-24 rounded-2xl shadow-lg"
                  />
                )}
                <div>
                  <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {profileData.githubName || username}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-muted mb-4">
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
                  </div>
                  
                  {/* Achievement badges */}
                  <div className="flex flex-wrap gap-2">
                    {earnedAchievements.map((achievement) => {
                      const Icon = achievement.icon;
                      return (
                        <motion.div
                          key={achievement.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          whileHover={{ scale: 1.1 }}
                          onHoverStart={() => setHoveredAchievement(achievement.id)}
                          onHoverEnd={() => setHoveredAchievement(null)}
                          className="relative"
                        >
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${achievement.color} shadow-lg cursor-pointer`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          {hoveredAchievement === achievement.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-card rounded-lg shadow-xl border border-border/50 whitespace-nowrap z-10"
                            >
                              <p className="font-medium text-sm">{achievement.name}</p>
                              <p className="text-xs text-muted">{achievement.description}</p>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl p-4"
                >
                  <p className="text-3xl font-bold font-mono">${formatCurrency(totalCost)}</p>
                  <p className="text-sm text-muted">Total Spent</p>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl p-4"
                >
                  <p className="text-3xl font-bold font-mono">{formatNumber(totalTokens)}</p>
                  <p className="text-sm text-muted">Total Tokens</p>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl p-4"
                >
                  <p className="text-3xl font-bold font-mono">{daysActive}</p>
                  <p className="text-sm text-muted">Days Active</p>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-xl p-4"
                >
                  <p className="text-3xl font-bold font-mono">{profileData.totalSubmissions}</p>
                  <p className="text-sm text-muted">Submissions</p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Usage over time */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card/80 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-border/50"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  Usage Trend
                </h2>
                <div className="flex gap-2">
                  {(["7d", "30d", "all"] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setSelectedTimeRange(range)}
                      className={`px-3 py-1 text-sm rounded-md transition-all ${
                        selectedTimeRange === range
                          ? "bg-accent text-white"
                          : "bg-card-hover text-muted hover:text-foreground"
                      }`}
                    >
                      {range === "all" ? "All" : range}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={sortedDailyData}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#666"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#666" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                      border: '1px solid #333',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cost" 
                    stroke={CHART_COLORS.primary} 
                    fillOpacity={1} 
                    fill="url(#colorCost)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Token distribution */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card/80 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-border/50"
            >
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-accent" />
                Token Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tokenDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${formatNumber(entry.value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {tokenDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Submissions History */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card/80 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-border/50"
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-accent" />
              Submission History
            </h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {profileData.submissions.map((submission, index) => (
                <motion.div
                  key={submission._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-background/50 backdrop-blur-sm rounded-xl p-5 hover:bg-background/70 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <p className="text-sm text-muted">
                          {new Date(submission.submittedAt).toLocaleDateString('en', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                        <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded-full">
                          {submission.dateRange.start} → {submission.dateRange.end}
                        </span>
                        {submission.verified && (
                          <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-2xl font-bold font-mono text-accent">${formatCurrency(submission.totalCost)}</p>
                          <p className="text-xs text-muted">Total Cost</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-mono">{formatNumber(submission.totalTokens)}</p>
                          <p className="text-xs text-muted">Total Tokens</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-mono">{formatNumber(submission.inputTokens)}</p>
                          <p className="text-xs text-muted">Input</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-mono">{formatNumber(submission.outputTokens)}</p>
                          <p className="text-xs text-muted">Output</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted">Models:</span>
                        {submission.modelsUsed.map((model, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-card rounded-md">
                            {model.includes("opus") ? "Opus 4" : "Sonnet 3.5"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Share2 className="w-5 h-5 text-muted hover:text-accent cursor-pointer" />
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}