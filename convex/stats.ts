import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGlobalStats = query({
  args: {},
  handler: async (ctx) => {
    // Process submissions in batches to avoid bytes read limit
    const pageSize = 100;
    let totalCost = 0;
    let totalTokens = 0;
    let totalDays = 0;
    let totalSubmissions = 0;
    const uniqueUsers = new Set<string>();
    const modelUsage: Record<string, number> = {};
    let topSubmission: any = null;
    let lastId = null;
    
    // Process submissions in batches
    while (true) {
      let query = ctx.db.query("submissions");
      
      if (lastId) {
        query = query.filter(q => q.gt(q.field("_id"), lastId));
      }
      
      const batch = await query.take(pageSize);
      
      if (batch.length === 0) break;
      
      lastId = batch[batch.length - 1]._id;
      totalSubmissions += batch.length;
      
      // Process each submission in the batch
      for (const submission of batch) {
        // Skip flagged submissions from stats
        if (submission.flaggedForReview) continue;
        
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
      
      // Limit total processing to prevent excessive reads
      if (totalSubmissions >= 1000) { // Reduced limit for better performance
        break;
      }
    }
    
    const uniqueUserCount = uniqueUsers.size;
    const avgCostPerUser = uniqueUserCount > 0 ? totalCost / uniqueUserCount : 0;
    const avgTokensPerUser = uniqueUserCount > 0 ? totalTokens / uniqueUserCount : 0;
    
    return {
      totalUsers: uniqueUserCount,
      totalSubmissions,
      totalCost,
      totalTokens,
      avgCostPerUser,
      topCost: topSubmission?.totalCost || 0,
      topUser: topSubmission?.username || "N/A",
      modelUsage,
      totalDays,
      avgTokensPerUser,
      isPartialData: totalSubmissions >= 1000, // Indicate if we hit the limit
    };
  },
});