import { query } from "./_generated/server";

export const getGlobalStats = query({
  args: {},
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").collect();
    
    // Get unique users
    const uniqueUsers = new Set(submissions.map(s => s.username)).size;
    
    // Calculate totals
    const totalCost = submissions.reduce((acc, s) => acc + s.totalCost, 0);
    const totalTokens = submissions.reduce((acc, s) => acc + s.totalTokens, 0);
    
    // Get top submission
    const topSubmission = submissions.sort((a, b) => b.totalCost - a.totalCost)[0];
    
    // Calculate average cost per user
    const avgCostPerUser = uniqueUsers > 0 ? totalCost / uniqueUsers : 0;
    
    // Get model usage stats
    const modelUsage = submissions.reduce((acc, s) => {
      s.modelsUsed.forEach(model => {
        const key = model.includes("opus") ? "opus" : "sonnet";
        acc[key] = (acc[key] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate total days tracked
    const totalDays = submissions.reduce((acc, s) => acc + s.dailyBreakdown.length, 0);
    
    return {
      totalUsers: uniqueUsers,
      totalSubmissions: submissions.length,
      totalCost,
      totalTokens,
      avgCostPerUser,
      topCost: topSubmission?.totalCost || 0,
      topUser: topSubmission?.username || "N/A",
      modelUsage,
      totalDays,
      avgTokensPerUser: uniqueUsers > 0 ? totalTokens / uniqueUsers : 0,
    };
  },
});