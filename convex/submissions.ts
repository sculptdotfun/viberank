import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const submit = mutation({
  args: {
    username: v.string(),
    githubUsername: v.optional(v.string()),
    githubName: v.optional(v.string()),
    githubAvatar: v.optional(v.string()),
    ccData: v.object({
      totals: v.object({
        inputTokens: v.number(),
        outputTokens: v.number(),
        cacheCreationTokens: v.number(),
        cacheReadTokens: v.number(),
        totalCost: v.number(),
        totalTokens: v.number(),
      }),
      daily: v.array(
        v.object({
          date: v.string(),
          inputTokens: v.number(),
          outputTokens: v.number(),
          cacheCreationTokens: v.number(),
          cacheReadTokens: v.number(),
          totalTokens: v.number(),
          totalCost: v.number(),
          modelsUsed: v.array(v.string()),
          modelBreakdowns: v.optional(v.array(v.object({
            modelName: v.string(),
            inputTokens: v.number(),
            outputTokens: v.number(),
            cacheCreationTokens: v.number(),
            cacheReadTokens: v.number(),
            cost: v.number(),
          }))),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    const { username, githubUsername, githubName, githubAvatar, ccData } = args;
    
    // Data validation and normalization
    // 1. Verify total tokens match sum of components
    const calculatedTotalTokens = ccData.totals.inputTokens + 
      ccData.totals.outputTokens + 
      ccData.totals.cacheCreationTokens + 
      ccData.totals.cacheReadTokens;
    
    if (Math.abs(calculatedTotalTokens - ccData.totals.totalTokens) > 1) {
      throw new Error("Token totals don't match. Please use official ccusage tool.");
    }
    
    // 2. Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const day of ccData.daily) {
      if (!dateRegex.test(day.date)) {
        throw new Error(`Invalid date format: ${day.date}. Expected YYYY-MM-DD`);
      }
    }
    
    // 3. Extract unique models
    const modelsUsed = Array.from(
      new Set(ccData.daily.flatMap((day) => day.modelsUsed))
    );
    
    // 4. Sort dates to ensure consistent range
    const dates = ccData.daily.map((d) => d.date).sort();
    const dateRange = {
      start: dates[0] || "",
      end: dates[dates.length - 1] || "",
    };
    
    // 5. Calculate interesting metrics
    const daysActive = dates.length;
    const avgDailyCost = ccData.totals.totalCost / daysActive;
    const biggestDay = ccData.daily.reduce((max, day) => 
      day.totalCost > max.totalCost ? day : max
    , ccData.daily[0]);
    
    // Check for existing submission with overlapping date range
    const existingSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_username", (q) => q.eq("username", username))
      .collect();
    
    let existingSubmission = null;
    for (const submission of existingSubmissions) {
      // Check if date ranges overlap
      const existingStart = submission.dateRange.start;
      const existingEnd = submission.dateRange.end;
      const newStart = dateRange.start;
      const newEnd = dateRange.end;
      
      // Date ranges overlap if one starts before the other ends
      if (existingStart <= newEnd && newStart <= existingEnd) {
        existingSubmission = submission;
        break;
      }
    }
    
    let submissionId: any;
    
    if (existingSubmission) {
      // Merge with existing submission
      
      // Create a map of existing daily data
      const existingDailyMap = new Map(
        existingSubmission.dailyBreakdown.map(day => [day.date, day])
      );
      
      // Update with new daily data (overwrites for same dates, adds new dates)
      ccData.daily.forEach(day => {
        existingDailyMap.set(day.date, {
          date: day.date,
          inputTokens: day.inputTokens,
          outputTokens: day.outputTokens,
          cacheCreationTokens: day.cacheCreationTokens,
          cacheReadTokens: day.cacheReadTokens,
          totalTokens: day.totalTokens,
          totalCost: day.totalCost,
          modelsUsed: day.modelsUsed,
        });
      });
      
      // Convert back to array and sort by date
      const mergedDailyBreakdown = Array.from(existingDailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Recalculate totals from merged data
      const mergedTotals = mergedDailyBreakdown.reduce((acc, day) => ({
        inputTokens: acc.inputTokens + day.inputTokens,
        outputTokens: acc.outputTokens + day.outputTokens,
        cacheCreationTokens: acc.cacheCreationTokens + day.cacheCreationTokens,
        cacheReadTokens: acc.cacheReadTokens + day.cacheReadTokens,
        totalTokens: acc.totalTokens + day.totalTokens,
        totalCost: acc.totalCost + day.totalCost,
      }), {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        totalCost: 0,
      });
      
      // Update date range to encompass all dates
      const allDates = mergedDailyBreakdown.map(d => d.date);
      const mergedDateRange = {
        start: allDates[0] || dateRange.start,
        end: allDates[allDates.length - 1] || dateRange.end,
      };
      
      // Collect all unique models used
      const allModelsUsed = Array.from(new Set([
        ...existingSubmission.modelsUsed,
        ...modelsUsed
      ]));
      
      await ctx.db.patch(existingSubmission._id, {
        githubUsername,
        githubName,
        githubAvatar,
        totalTokens: mergedTotals.totalTokens,
        totalCost: mergedTotals.totalCost,
        inputTokens: mergedTotals.inputTokens,
        outputTokens: mergedTotals.outputTokens,
        cacheCreationTokens: mergedTotals.cacheCreationTokens,
        cacheReadTokens: mergedTotals.cacheReadTokens,
        dateRange: mergedDateRange,
        modelsUsed: allModelsUsed,
        dailyBreakdown: mergedDailyBreakdown,
        submittedAt: Date.now(),
        verified: false,
      });
      submissionId = existingSubmission._id;
    } else {
      // Create new submission
      submissionId = await ctx.db.insert("submissions", {
        username,
        githubUsername,
        githubName,
        githubAvatar,
        totalTokens: ccData.totals.totalTokens,
        totalCost: ccData.totals.totalCost,
        inputTokens: ccData.totals.inputTokens,
        outputTokens: ccData.totals.outputTokens,
        cacheCreationTokens: ccData.totals.cacheCreationTokens,
        cacheReadTokens: ccData.totals.cacheReadTokens,
        dateRange,
        modelsUsed,
        dailyBreakdown: ccData.daily.map((day) => ({
          date: day.date,
          inputTokens: day.inputTokens,
          outputTokens: day.outputTokens,
          cacheCreationTokens: day.cacheCreationTokens,
          cacheReadTokens: day.cacheReadTokens,
          totalTokens: day.totalTokens,
          totalCost: day.totalCost,
          modelsUsed: day.modelsUsed,
        })),
        submittedAt: Date.now(),
        verified: false,
      });
    }
    
    // Update or create profile
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    
    if (existingProfile) {
      // Only increment totalSubmissions if this is a new submission
      const updates: any = {
        bestSubmission: submissionId,
        githubUsername,
        githubName,
        avatar: githubAvatar,
      };
      
      if (!existingSubmission) {
        updates.totalSubmissions = existingProfile.totalSubmissions + 1;
      }
      
      await ctx.db.patch(existingProfile._id, updates);
    } else {
      await ctx.db.insert("profiles", {
        username,
        githubUsername,
        githubName,
        avatar: githubAvatar,
        totalSubmissions: 1,
        bestSubmission: submissionId,
        createdAt: Date.now(),
      });
    }
    
    return submissionId;
  },
});

export const getLeaderboard = query({
  args: {
    sortBy: v.optional(v.union(v.literal("cost"), v.literal("tokens"))),
    limit: v.optional(v.number()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sortBy = args.sortBy || "cost";
    const limit = args.limit || 100;
    const dateFrom = args.dateFrom;
    const dateTo = args.dateTo;
    
    // Use indexes for efficient sorting when no date filter
    if (!dateFrom && !dateTo) {
      const query = sortBy === "cost" 
        ? ctx.db.query("submissions").withIndex("by_total_cost").order("desc")
        : ctx.db.query("submissions").withIndex("by_total_tokens").order("desc");
      
      return await query.take(limit);
    }
    
    // For date filtering, we still need to fetch all and filter
    const allSubmissions = await ctx.db
      .query("submissions")
      .collect();
    
    // Calculate filtered totals for each submission
    const filteredSubmissions = allSubmissions.map(submission => {
      const filteredDays = submission.dailyBreakdown.filter(day => {
        const dayDate = new Date(day.date);
        const isAfterFrom = !dateFrom || dayDate >= new Date(dateFrom);
        const isBeforeTo = !dateTo || dayDate <= new Date(dateTo);
        return isAfterFrom && isBeforeTo;
      });
      
      if (filteredDays.length === 0) {
        return null;
      }
      
      // Calculate totals for filtered date range
      const filteredTotals = filteredDays.reduce(
        (acc, day) => ({
          totalCost: acc.totalCost + day.totalCost,
          totalTokens: acc.totalTokens + day.totalTokens,
          inputTokens: acc.inputTokens + day.inputTokens,
          outputTokens: acc.outputTokens + day.outputTokens,
          cacheCreationTokens: acc.cacheCreationTokens + day.cacheCreationTokens,
          cacheReadTokens: acc.cacheReadTokens + day.cacheReadTokens,
        }),
        {
          totalCost: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        }
      );
      
      // Get unique models used in filtered range
      const modelsUsed = Array.from(
        new Set(filteredDays.flatMap(day => day.modelsUsed))
      );
      
      // Get date range for filtered data
      const dates = filteredDays.map(d => d.date).sort();
      const dateRange = {
        start: dates[0],
        end: dates[dates.length - 1],
      };
      
      return {
        ...submission,
        ...filteredTotals,
        dateRange,
        modelsUsed,
        isFiltered: true,
      };
    }).filter(Boolean);
    
    // Sort by selected metric
    const sorted = filteredSubmissions.sort((a, b) => {
      if (sortBy === "cost") {
        return b.totalCost - a.totalCost;
      }
      return b.totalTokens - a.totalTokens;
    });
    
    return sorted.slice(0, limit);
  },
});

export const getSubmission = query({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getProfile = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    
    if (!profile) return null;
    
    const submissions = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("username"), args.username))
      .order("desc")
      .collect();
    
    return {
      ...profile,
      submissions,
    };
  },
});