import { query } from "./_generated/server";
import { v } from "convex/values";

// WARNING: This is not truly "global" - it only processes top submissions
// to avoid 16MB limit. For accurate global stats, we need pre-aggregation.
export const getGlobalStats = query({
  args: {},
  handler: async (ctx) => {
    // IMPORTANT: We use a multi-pronged approach to get more accurate stats
    // while staying under Convex's limits
    
    // 1. Get unique user count from profiles (more accurate for user count)
    const profileCount = await ctx.db
      .query("profiles")
      .take(5000) // Profiles are smaller, we can fetch more
      .then(profiles => profiles.length);
    
    // 2. Get top submissions for cost/token stats (these matter most)
    const topByCost = await ctx.db
      .query("submissions")
      .withIndex("by_total_cost")
      .order("desc")
      .take(500); // Increased from 100 to 500 for better coverage
    
    // 3. Calculate stats from the sample
    let totalCost = 0;
    let totalTokens = 0;
    let totalDays = 0;
    let validSubmissions = 0;
    const uniqueUsersFromSubmissions = new Set<string>();
    const modelUsage: Record<string, number> = {};
    let topSubmission: any = null;
    
    for (const submission of topByCost) {
      // Skip flagged submissions
      if (submission.flaggedForReview) continue;
      
      validSubmissions++;
      uniqueUsersFromSubmissions.add(submission.username);
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
    
    // 4. Get additional submission count for better approximation
    const totalSubmissionCount = await ctx.db
      .query("submissions")
      .withIndex("by_total_cost")
      .take(1000) // Just count, don't process
      .then(subs => subs.filter(s => !s.flaggedForReview).length);
    
    // Use the maximum of different counting methods for most accurate user count
    const uniqueUserCount = Math.max(
      uniqueUsersFromSubmissions.size,
      profileCount
    );
    
    const avgCostPerUser = uniqueUserCount > 0 ? totalCost / uniqueUserCount : 0;
    const avgTokensPerUser = uniqueUserCount > 0 ? totalTokens / uniqueUserCount : 0;
    
    return {
      totalUsers: uniqueUserCount,
      totalSubmissions: Math.max(validSubmissions, totalSubmissionCount),
      totalCost,
      totalTokens,
      avgCostPerUser,
      topCost: topSubmission?.totalCost || 0,
      topUser: topSubmission?.username || "N/A",
      modelUsage,
      totalDays,
      avgTokensPerUser,
      isApproximate: true, // IMPORTANT: These are approximate stats
      basedOnTop: 500, // Based on top 500 submissions for stats
    };
  },
});