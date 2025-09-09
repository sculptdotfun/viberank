import { v } from "convex/values";
import { mutation, query, internal } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { rateLimiter } from "./rateLimiter";
import { ConvexError } from "convex/values";

export const submit = mutation({
  args: {
    username: v.string(),
    githubUsername: v.optional(v.string()),
    githubName: v.optional(v.string()),
    githubAvatar: v.optional(v.string()),
    source: v.union(v.literal("cli"), v.literal("oauth")),
    verified: v.boolean(),
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
    const { username, githubUsername, githubName, githubAvatar, source, verified, ccData } = args;
    
    // Apply rate limiting using Convex rate limiter component
    try {
      await rateLimiter.limit(ctx, "submitData", { 
        key: username, // Rate limit per user
        throws: true // Automatically throw on rate limit
      });
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error?.data?.kind === "RateLimitError") {
        const retryAfter = error.data.retryAfter;
        const waitSeconds = Math.ceil((retryAfter - Date.now()) / 1000);
        throw new Error(`Rate limit exceeded. Please wait ${waitSeconds} seconds before submitting again.`);
      }
      throw error;
    }
    
    // Log submission attempt for debugging
    console.log("Submission attempt:", {
      username,
      source,
      verified,
      dailyCount: ccData.daily?.length || 0,
      totals: ccData.totals,
      timestamp: new Date().toISOString(),
    });
    
    // Data validation and normalization
    try {
      // 1. Verify total tokens match sum of components
      const calculatedTotalTokens = ccData.totals.inputTokens + 
        ccData.totals.outputTokens + 
        ccData.totals.cacheCreationTokens + 
        ccData.totals.cacheReadTokens;
      
      if (Math.abs(calculatedTotalTokens - ccData.totals.totalTokens) > 1) {
        throw new Error("Token totals don't match. Please use official ccusage tool.");
      }
    
    // 2. Validate realistic ranges
    const MAX_DAILY_COST = 5000; // $5k/day is extremely high usage
    const MAX_DAILY_TOKENS = 250_000_000; // 250M tokens/day (increased 5x from 50M)
    const MIN_COST_PER_TOKEN = 0.0000001; // Adjusted for cache read tokens which are very cheap
    const MAX_COST_PER_TOKEN = 0.1; // Sanity check for cost/token ratio
    
    // Check totals
    if (ccData.totals.totalCost < 0 || ccData.totals.totalTokens < 0) {
      throw new Error("Negative values are not allowed.");
    }
    
    if (ccData.totals.totalCost > MAX_DAILY_COST * 365) {
      throw new Error("Total cost exceeds realistic limits. Please check your data.");
    }
    
    if (ccData.totals.totalTokens > MAX_DAILY_TOKENS * 365) {
      throw new Error("Total tokens exceed realistic limits. Please check your data.");
    }
    
    // Check cost per token ratio
    if (ccData.totals.totalTokens > 0) {
      const costPerToken = ccData.totals.totalCost / ccData.totals.totalTokens;
      if (costPerToken < MIN_COST_PER_TOKEN || costPerToken > MAX_COST_PER_TOKEN) {
        throw new Error("Cost per token ratio is unrealistic. Please check your data.");
      }
    }
    
    // 3. Validate date format and daily data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let flaggedForReview = false;
    const suspiciousReasons: string[] = [];
    
    for (const day of ccData.daily) {
      if (!dateRegex.test(day.date)) {
        throw new Error(`Invalid date format: ${day.date}. Expected YYYY-MM-DD`);
      }
      
      // Check for negative values
      if (day.totalCost < 0 || day.totalTokens < 0 || 
          day.inputTokens < 0 || day.outputTokens < 0 ||
          day.cacheCreationTokens < 0 || day.cacheReadTokens < 0) {
        throw new Error("Negative values are not allowed in daily data.");
      }
      
      // Check for unrealistic daily values
      if (day.totalCost > MAX_DAILY_COST) {
        flaggedForReview = true;
        suspiciousReasons.push(`Daily cost of $${day.totalCost.toFixed(2)} on ${day.date} exceeds typical limits`);
      }
      
      if (day.totalTokens > MAX_DAILY_TOKENS) {
        flaggedForReview = true;
        suspiciousReasons.push(`Daily tokens of ${day.totalTokens.toLocaleString()} on ${day.date} exceeds typical limits`);
      }
      
      // Validate daily token sum
      const dayTokenSum = day.inputTokens + day.outputTokens + 
                         day.cacheCreationTokens + day.cacheReadTokens;
      if (Math.abs(dayTokenSum - day.totalTokens) > 1) {
        throw new Error(`Token components don't sum correctly for ${day.date}.`);
      }
    }
    
    // 4. Extract unique models
    const modelsUsed = Array.from(
      new Set(ccData.daily.flatMap((day) => day.modelsUsed))
    );
    
    // 5. Sort dates to ensure consistent range
    const dates = ccData.daily.map((d) => d.date).sort();
    let dateRange = {
      start: dates[0] || "",
      end: dates[dates.length - 1] || "",
    };
    
    // 6. Calculate interesting metrics
    const daysActive = dates.length;
    const avgDailyCost = ccData.totals.totalCost / daysActive;
    const biggestDay = ccData.daily.reduce((max, day) => 
      day.totalCost > max.totalCost ? day : max
    , ccData.daily[0]);
    
    // Additional validation for suspicious patterns
    if (avgDailyCost > MAX_DAILY_COST * 0.5) {
      flaggedForReview = true;
      suspiciousReasons.push(`Average daily cost of $${avgDailyCost.toFixed(2)} is unusually high`);
    }
    
    // Check for future dates (allow today)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today to allow current day submissions
    const futureDate = dates.find(date => new Date(date) > today);
    if (futureDate) {
      throw new Error(`Future date detected: ${futureDate}. Please check your data.`);
    }
    } catch (validationError: any) {
      // Track failed validation attempts with rate limiting
      await rateLimiter.limit(ctx, "failedSubmissions", { 
        key: username,
        throws: false // Don't throw, just track
      });
      throw validationError;
    }
    
    // Check for existing submission with overlapping date range and same source
    let existingSubmissions;
    try {
      existingSubmissions = await ctx.db
        .query("submissions")
        .withIndex("by_username", (q) => q.eq("username", username))
        .take(50); // Limit to 50 most recent submissions for a user
    } catch (dbError) {
      console.error("Database query error:", {
        error: dbError,
        username,
        timestamp: new Date().toISOString()
      });
      throw new Error("Failed to query existing submissions. Please try again.");
    }
    
    let existingSubmission = null;
    for (const submission of existingSubmissions) {
      // Only consider submissions from the same source
      // If existing submission has no source (old data), treat it as oauth
      const existingSource = submission.source || "oauth";
      if (existingSource !== source) {
        continue;
      }
      
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
      dateRange = {
        start: allDates[0] || dateRange.start,
        end: allDates[allDates.length - 1] || dateRange.end,
      };
      
      // Collect all unique models used
      const allModelsUsed = Array.from(new Set([
        ...existingSubmission.modelsUsed,
        ...modelsUsed
      ]));
      
      try {
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
          dateRange: dateRange,
          modelsUsed: allModelsUsed,
          dailyBreakdown: mergedDailyBreakdown,
          submittedAt: Date.now(),
          verified: verified,
          source: source,
          flaggedForReview: flaggedForReview || existingSubmission.flaggedForReview,
          flagReasons: flaggedForReview ? suspiciousReasons : existingSubmission.flagReasons,
        });
        submissionId = existingSubmission._id;
      } catch (updateError) {
        console.error("Failed to update submission:", {
          error: updateError,
          submissionId: existingSubmission._id,
          username,
          timestamp: new Date().toISOString()
        });
        throw new Error("Failed to update existing submission. Please try again.");
      }
    } else {
      // Create new submission
      try {
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
          verified: verified,
          source: source,
          flaggedForReview: flaggedForReview,
          flagReasons: flaggedForReview ? suspiciousReasons : undefined,
        });
      } catch (insertError) {
        console.error("Failed to insert submission:", {
          error: insertError,
          username,
          dataSize: JSON.stringify(ccData).length,
          timestamp: new Date().toISOString()
        });
        throw new Error("Failed to create new submission. Please try again.");
      }
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

// Paginated leaderboard - frontend should call with page number
export const getLeaderboard = query({
  args: {
    sortBy: v.optional(v.union(v.literal("cost"), v.literal("tokens"))),
    page: v.optional(v.number()), // Page number (0-based)
    pageSize: v.optional(v.number()), // Items per page
    includeFlagged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sortBy = args.sortBy || "cost";
    const page = args.page || 0;
    const pageSize = Math.min(args.pageSize || 25, 50); // Max 50 per page
    const offset = page * pageSize;
    const includeFlagged = args.includeFlagged || false;
    
    // Build the query based on sort preference
    let query = sortBy === "cost" 
      ? ctx.db.query("submissions").withIndex("by_total_cost").order("desc")
      : ctx.db.query("submissions").withIndex("by_total_tokens").order("desc");
    
    // Fetch enough for current page + check for more
    // Need to skip to offset then take pageSize + buffer for filtering
    const bufferMultiplier = includeFlagged ? 1 : 2;
    const fetchLimit = Math.min(offset + (pageSize * bufferMultiplier) + 1, 200);
    let allResults = await query.take(fetchLimit);
    
    // Filter out flagged submissions if needed
    if (!includeFlagged) {
      allResults = allResults.filter(sub => !sub.flaggedForReview);
    }
    
    // Apply pagination
    const items = allResults.slice(offset, offset + pageSize);
    const hasMore = allResults.length > offset + pageSize;
    
    return {
      items,
      page,
      pageSize,
      hasMore,
      totalPages: Math.ceil(Math.min(allResults.length, 200) / pageSize),
    };
  },
});

// Removed getLeaderboardLegacy - not needed

// Separate query specifically for date-filtered leaderboard
// This is expensive and should ideally use pre-aggregated data
export const getLeaderboardByDateRange = query({
  args: {
    dateFrom: v.string(),
    dateTo: v.string(),
    sortBy: v.optional(v.union(v.literal("cost"), v.literal("tokens"))),
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("submissions")),
    includeFlagged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 100);
    const includeFlagged = args.includeFlagged || false;
    const sortBy = args.sortBy || "cost";
    
    // NOTE: Date range filtering requires computing totals from dailyBreakdown
    // This is inherently expensive. Consider:
    // 1. Pre-computing weekly/monthly aggregates
    // 2. Storing denormalized date-range totals
    // 3. Using a separate analytics table
    
    let query = ctx.db.query("submissions");
    
    // Apply cursor if provided
    if (args.cursor) {
      query = query.filter(q => q.gt(q.field("_id"), args.cursor));
    }
    
    // Fetch a batch to process
    const batchSize = 100;
    const batch = await query.take(batchSize);
    
    // Process and filter submissions
    const processedItems = [];
    
    for (const submission of batch) {
      // Skip flagged if not included
      if (!includeFlagged && submission.flaggedForReview) continue;
      
      // Filter daily breakdown by date range
      const filteredDays = submission.dailyBreakdown.filter(day => {
        return day.date >= args.dateFrom && day.date <= args.dateTo;
      });
      
      if (filteredDays.length === 0) continue;
      
      // Calculate totals for the filtered date range
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
      
      processedItems.push({
        ...submission,
        ...filteredTotals,
        originalTotals: {
          totalCost: submission.totalCost,
          totalTokens: submission.totalTokens,
        },
        isFiltered: true,
      });
    }
    
    // Sort the processed items
    processedItems.sort((a, b) => {
      return sortBy === "cost" 
        ? b.totalCost - a.totalCost
        : b.totalTokens - a.totalTokens;
    });
    
    // Return paginated results
    const items = processedItems.slice(0, limit);
    const hasMore = batch.length === batchSize;
    const nextCursor = hasMore && batch.length > 0 
      ? batch[batch.length - 1]._id 
      : undefined;
    
    return {
      items,
      nextCursor,
      hasMore,
      // Signal that client may need to fetch more if we don't have enough results
      needsMoreData: processedItems.length < limit && hasMore,
    };
  },
});

export const getSubmission = query({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getProfile = query({
  args: { 
    username: v.string(),
    submissionLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    
    if (!profile) return null;
    
    const limit = Math.min(args.submissionLimit || 10, 25); // Much smaller - submissions are huge
    
    // Use index to efficiently query submissions and limit the number fetched
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .order("desc")
      .take(limit);
    
    return {
      ...profile,
      submissions,
    };
  },
});


export const getFlaggedSubmissions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 25, 50); // Much smaller limits
    
    const flaggedSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_flagged", (q) => q.eq("flaggedForReview", true))
      .order("desc")
      .take(limit); // Limit the results
    
    return flaggedSubmissions;
  },
});

export const updateFlagStatus = mutation({
  args: {
    submissionId: v.id("submissions"),
    flagged: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { submissionId, flagged, reason } = args;
    
    const submission = await ctx.db.get(submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }
    
    const updates: any = {
      flaggedForReview: flagged,
    };
    
    if (flagged && reason) {
      updates.flagReasons = [...(submission.flagReasons || []), reason];
    } else if (!flagged) {
      updates.flagReasons = undefined;
    }
    
    await ctx.db.patch(submissionId, updates);
    return { success: true };
  },
});

// Unified claim and merge function - handles both claiming unverified submissions
// and merging multiple submissions into one
export const claimAndMergeSubmissions = mutation({
  args: {
    githubUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const { githubUsername } = args;
    
    // Find all submissions for this GitHub username
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_github_username", (q) => q.eq("githubUsername", githubUsername))
      .take(100); // Limit to prevent excessive reads
    
    if (submissions.length === 0) {
      throw new Error("No submissions found");
    }
    
    // If only one submission and it's already verified, nothing to do
    if (submissions.length === 1 && submissions[0].verified) {
      return { success: true, action: "already_verified" };
    }
    
    // Separate CLI and OAuth submissions
    const cliSubmissions = submissions.filter(s => s.source === "cli");
    const oauthSubmissions = submissions.filter(s => s.source === "oauth");
    
    // If only one CLI submission and no OAuth, just verify it
    if (oauthSubmissions.length === 0 && cliSubmissions.length === 1) {
      await ctx.db.patch(cliSubmissions[0]._id, {
        verified: true,
      });
      return { success: true, action: "claimed", submissionId: cliSubmissions[0]._id };
    }
    
    // If multiple OAuth submissions only, this is unusual but merge them
    if (cliSubmissions.length === 0 && oauthSubmissions.length > 1) {
      // This shouldn't normally happen, but handle it gracefully
      console.warn(`User ${githubUsername} has multiple OAuth submissions`);
    }
    
    // If we have multiple submissions, merge them
    // Use the OAuth submission as the base (it's verified), or the most recent if no OAuth
    const baseSubmission = oauthSubmissions[0] || submissions.sort((a, b) => b.submittedAt - a.submittedAt)[0];
    
    // Merge all daily breakdowns
    const allDailyData = new Map<string, any>();
    
    // Add all data, with OAuth taking priority for overlapping dates
    for (const submission of submissions) {
      for (const day of submission.dailyBreakdown) {
        // OAuth data takes priority
        if (submission.source === "oauth" || !allDailyData.has(day.date)) {
          allDailyData.set(day.date, day);
        }
      }
    }
    
    // Convert back to array and sort by date
    const mergedDailyBreakdown = Array.from(allDailyData.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Check if we have any data
    if (mergedDailyBreakdown.length === 0) {
      throw new Error("No data to merge");
    }
    
    // Calculate new totals
    const totalTokens = mergedDailyBreakdown.reduce((sum, day) => sum + day.totalTokens, 0);
    const totalCost = mergedDailyBreakdown.reduce((sum, day) => sum + day.totalCost, 0);
    const inputTokens = mergedDailyBreakdown.reduce((sum, day) => sum + day.inputTokens, 0);
    const outputTokens = mergedDailyBreakdown.reduce((sum, day) => sum + day.outputTokens, 0);
    const cacheCreationTokens = mergedDailyBreakdown.reduce((sum, day) => sum + day.cacheCreationTokens, 0);
    const cacheReadTokens = mergedDailyBreakdown.reduce((sum, day) => sum + day.cacheReadTokens, 0);
    
    // Update date range
    const dateRange = {
      start: mergedDailyBreakdown[0]?.date || "",
      end: mergedDailyBreakdown[mergedDailyBreakdown.length - 1]?.date || "",
    };
    
    // Collect all unique models
    const allModelsUsed = Array.from(new Set(
      mergedDailyBreakdown.flatMap(day => day.modelsUsed || [])
    ));
    
    // Update the base submission with merged data
    await ctx.db.patch(baseSubmission._id, {
      totalTokens,
      totalCost,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      dateRange,
      modelsUsed: allModelsUsed,
      dailyBreakdown: mergedDailyBreakdown,
      submittedAt: Date.now(),
      verified: true,
      source: oauthSubmissions.length > 0 ? "oauth" : baseSubmission.source,
    });
    
    // Delete other submissions
    for (const submission of submissions) {
      if (submission._id !== baseSubmission._id) {
        await ctx.db.delete(submission._id);
      }
    }
    
    return { 
      success: true, 
      action: submissions.length > 1 ? "merged" : "claimed",
      submissionId: baseSubmission._id,
      mergedCount: submissions.length
    };
  },
});

export const checkClaimableSubmissions = query({
  args: {
    githubUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const { githubUsername } = args;
    
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_github_username", (q) => q.eq("githubUsername", githubUsername))
      .take(100); // Limit to prevent excessive reads
    
    const cliSubmissions = submissions.filter(s => s.source === "cli");
    const oauthSubmissions = submissions.filter(s => s.source === "oauth");
    const unverifiedCount = submissions.filter(s => !s.verified).length;
    
    // Determine what action is available
    let actionNeeded = null;
    let actionText = "";
    
    if (submissions.length === 0) {
      actionNeeded = null;
    } else if (submissions.length === 1 && submissions[0].verified) {
      actionNeeded = null; // Already verified
    } else if (unverifiedCount > 0 && submissions.length === 1) {
      actionNeeded = "claim";
      actionText = "Verify your submission";
    } else if (submissions.length > 1) {
      actionNeeded = "merge";
      actionText = `Merge ${submissions.length} submissions into one`;
    }
    
    return {
      actionNeeded,
      actionText,
      cliCount: cliSubmissions.length,
      oauthCount: oauthSubmissions.length,
      totalSubmissions: submissions.length,
      unverifiedCount,
    };
  },
});

