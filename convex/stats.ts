import { query } from "./_generated/server";
import { v } from "convex/values";

// WARNING: This is not truly "global" - it only processes top submissions
// to avoid 16MB limit. For accurate global stats, we need pre-aggregation.
export const getGlobalStats = query({
  args: {},
  handler: async (ctx) => {
    // IMPORTANT: We can't scan all submissions without hitting 16MB limit
    // This gives approximate stats based on top submissions only
    
    // Get top submissions by cost (these are most important for stats)
    const topByCost = await ctx.db
      .query("submissions")
      .withIndex("by_total_cost")
      .order("desc")
      .take(100); // Only top 100 to stay under limit
    
    // Calculate stats from this sample
    let totalCost = 0;
    let totalTokens = 0;
    let totalDays = 0;
    let validSubmissions = 0;
    const uniqueUsers = new Set<string>();
    const modelUsage: Record<string, number> = {};
    let topSubmission: any = null;
    
    for (const submission of topByCost) {
      // Skip flagged submissions
      if (submission.flaggedForReview) continue;
      
      validSubmissions++;
      uniqueUsers.add(submission.username);
      totalCost += submission.totalCost;
      totalTokens += submission.totalTokens;
      totalDays += submission.dailyBreakdown.length;
      
      // Track top submission
      if (!topSubmission || submission.totalCost > topSubmission.totalCost) {
        topSubmission = submission;
      }
      
      // Track model usage
      submission.modelsUsed.forEach(model => {
        const key = model.includes("opus") ? "opus" : "sonnet";
        modelUsage[key] = (modelUsage[key] || 0) + 1;
      });
    }
    
    // Try to get a more accurate user count by querying profiles
    const profileCount = await ctx.db
      .query("profiles")
      .take(1000) // Can fetch more profiles as they're smaller
      .then(profiles => profiles.length);
    
    const uniqueUserCount = Math.max(uniqueUsers.size, profileCount);
    const avgCostPerUser = uniqueUserCount > 0 ? totalCost / uniqueUserCount : 0;
    const avgTokensPerUser = uniqueUserCount > 0 ? totalTokens / uniqueUserCount : 0;
    
    return {
      totalUsers: uniqueUserCount,
      totalSubmissions: validSubmissions, // Note: This is NOT all submissions
      totalCost,
      totalTokens,
      avgCostPerUser,
      topCost: topSubmission?.totalCost || 0,
      topUser: topSubmission?.username || "N/A",
      modelUsage,
      totalDays,
      avgTokensPerUser,
      isApproximate: true, // IMPORTANT: These are approximate stats
      basedOnTop: 100, // Based on top 100 submissions only
    };
  },
});