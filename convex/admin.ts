import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const deleteProfilesByPattern = mutation({
  args: {
    patterns: v.array(v.string()),
    searchField: v.optional(v.union(v.literal("githubUsername"), v.literal("username"), v.literal("both"))),
    caseSensitive: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { 
      patterns, 
      searchField = "githubUsername",
      caseSensitive = false,
      dryRun = false 
    } = args;
    
    if (!patterns || patterns.length === 0) {
      throw new Error("At least one pattern must be provided");
    }
    
    const allProfiles = await ctx.db.query("profiles").collect();
    
    const profilesToDelete = allProfiles.filter(profile => {
      const githubUsername = profile.githubUsername || "";
      const username = profile.username || "";
      
      let fieldsToCheck: string[] = [];
      if (searchField === "githubUsername") {
        fieldsToCheck = [githubUsername];
      } else if (searchField === "username") {
        fieldsToCheck = [username];
      } else {
        fieldsToCheck = [githubUsername, username];
      }
      
      return fieldsToCheck.some(field => {
        const fieldToCheck = caseSensitive ? field : field.toLowerCase();
        return patterns.some(pattern => {
          const patternToCheck = caseSensitive ? pattern : pattern.toLowerCase();
          return fieldToCheck.includes(patternToCheck);
        });
      });
    });
    
    console.log(`Found ${profilesToDelete.length} profiles matching patterns: ${patterns.join(", ")}`);
    profilesToDelete.forEach(profile => {
      console.log(`- ${profile.githubUsername || profile.username} (ID: ${profile._id})`);
    });
    
    let deletedCount = 0;
    if (!dryRun) {
      for (const profile of profilesToDelete) {
        await ctx.db.delete(profile._id);
        deletedCount++;
      }
    }
    
    return {
      message: dryRun 
        ? `Dry run: Would delete ${profilesToDelete.length} profiles`
        : `Successfully deleted ${deletedCount} profiles`,
      matchedCount: profilesToDelete.length,
      deletedCount: dryRun ? 0 : deletedCount,
      dryRun,
      patterns,
      searchField,
      profiles: profilesToDelete.map(p => ({
        id: p._id,
        githubUsername: p.githubUsername,
        username: p.username,
        createdAt: p.createdAt
      }))
    };
  },
});

export const findProfilesByPattern = query({
  args: {
    patterns: v.array(v.string()),
    searchField: v.optional(v.union(v.literal("githubUsername"), v.literal("username"), v.literal("both"))),
    caseSensitive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { 
      patterns, 
      searchField = "githubUsername",
      caseSensitive = false 
    } = args;
    
    if (!patterns || patterns.length === 0) {
      throw new Error("At least one pattern must be provided");
    }
    
    const allProfiles = await ctx.db.query("profiles").collect();
    
    const matchingProfiles = allProfiles.filter(profile => {
      const githubUsername = profile.githubUsername || "";
      const username = profile.username || "";
      
      let fieldsToCheck: string[] = [];
      if (searchField === "githubUsername") {
        fieldsToCheck = [githubUsername];
      } else if (searchField === "username") {
        fieldsToCheck = [username];
      } else {
        fieldsToCheck = [githubUsername, username];
      }
      
      return fieldsToCheck.some(field => {
        const fieldToCheck = caseSensitive ? field : field.toLowerCase();
        return patterns.some(pattern => {
          const patternToCheck = caseSensitive ? pattern : pattern.toLowerCase();
          return fieldToCheck.includes(patternToCheck);
        });
      });
    });
    
    return {
      count: matchingProfiles.length,
      patterns,
      searchField,
      profiles: matchingProfiles.map(p => ({
        id: p._id,
        githubUsername: p.githubUsername,
        username: p.username,
        createdAt: p.createdAt,
        avatar: p.avatar,
        totalSubmissions: p.totalSubmissions
      }))
    };
  },
});