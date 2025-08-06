import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  submissions: defineTable({
    username: v.string(),
    githubUsername: v.optional(v.string()),
    githubName: v.optional(v.string()),
    githubAvatar: v.optional(v.string()),
    totalTokens: v.number(),
    totalCost: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheCreationTokens: v.number(),
    cacheReadTokens: v.number(),
    dateRange: v.object({
      start: v.string(),
      end: v.string(),
    }),
    modelsUsed: v.array(v.string()),
    dailyBreakdown: v.array(
      v.object({
        date: v.string(),
        inputTokens: v.number(),
        outputTokens: v.number(),
        cacheCreationTokens: v.number(),
        cacheReadTokens: v.number(),
        totalTokens: v.number(),
        totalCost: v.number(),
        modelsUsed: v.array(v.string()),
      })
    ),
    submittedAt: v.number(),
    verified: v.boolean(),
    source: v.optional(v.union(v.literal("cli"), v.literal("oauth"))),
    claimedBy: v.optional(v.id("profiles")),
    flaggedForReview: v.optional(v.boolean()),
    flagReasons: v.optional(v.array(v.string())),
  })
    .index("by_total_cost", ["totalCost"])
    .index("by_total_tokens", ["totalTokens"])
    .index("by_submitted_at", ["submittedAt"])
    .index("by_username", ["username"]),
  
  profiles: defineTable({
    username: v.string(),
    githubUsername: v.optional(v.string()),
    githubName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    totalSubmissions: v.number(),
    bestSubmission: v.optional(v.id("submissions")),
    createdAt: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_github", ["githubUsername"]),
});