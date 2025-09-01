import { getDb } from './index';
import { submissions, profiles, type Submission, type Profile } from './schema';
import { eq, desc, and, or, gte, lte, isNotNull } from 'drizzle-orm';

// Submission operations
export async function createSubmission(data: {
  username: string;
  email: string;
  source: 'cli' | 'web';
  verified: boolean;
  ccData: {
    totals: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
      totalCost: number;
      totalTokens: number;
    };
    daily: Array<{
      date: string;
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
      totalTokens: number;
      totalCost: number;
      modelsUsed: string[];
    }>;
  };
}) {
  const { username, email, source, verified, ccData } = data;
  
  // Data validation (similar to Convex logic)
  const calculatedTotalTokens = ccData.totals.inputTokens + 
    ccData.totals.outputTokens + 
    ccData.totals.cacheCreationTokens + 
    ccData.totals.cacheReadTokens;
  
  if (Math.abs(calculatedTotalTokens - ccData.totals.totalTokens) > 1) {
    throw new Error("Token totals don't match. Please use official ccusage tool.");
  }

  // Extract unique models
  const modelsUsed = Array.from(
    new Set(ccData.daily.flatMap((day) => day.modelsUsed))
  );

  // Sort dates to ensure consistent range
  const dates = ccData.daily.map((d) => d.date).sort();
  const dateRange = {
    start: dates[0] || "",
    end: dates[dates.length - 1] || "",
  };

  // Check for existing submission
  const existingSubmissions = await getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.email, email));

  let existingSubmission = null;
  for (const submission of existingSubmissions) {
    const existingSource = submission.source || "oauth";
    if (existingSource !== source) continue;
    
    const existingStart = submission.dateRange.start;
    const existingEnd = submission.dateRange.end;
    const newStart = dateRange.start;
    const newEnd = dateRange.end;
    
    if (existingStart <= newEnd && newStart <= existingEnd) {
      existingSubmission = submission;
      break;
    }
  }

  let submissionId: number;

  if (existingSubmission) {
    // Merge logic would go here (simplified for now)
    const [updated] = await getDb()
      .update(submissions)
      .set({
        username: email, // Keep for backwards compatibility
        email,
        totalTokens: ccData.totals.totalTokens,
        totalCost: ccData.totals.totalCost.toString(),
        inputTokens: ccData.totals.inputTokens,
        outputTokens: ccData.totals.outputTokens,
        cacheCreationTokens: ccData.totals.cacheCreationTokens,
        cacheReadTokens: ccData.totals.cacheReadTokens,
        dateRange,
        modelsUsed,
        dailyBreakdown: ccData.daily,
        submittedAt: new Date(),
        verified,
        source,
      })
      .where(eq(submissions.id, existingSubmission.id))
      .returning();
    
    submissionId = updated.id;
  } else {
    const [newSubmission] = await getDb()
      .insert(submissions)
      .values({
        username: email, // Keep for backwards compatibility
        email,
        totalTokens: ccData.totals.totalTokens,
        totalCost: ccData.totals.totalCost.toString(),
        inputTokens: ccData.totals.inputTokens,
        outputTokens: ccData.totals.outputTokens,
        cacheCreationTokens: ccData.totals.cacheCreationTokens,
        cacheReadTokens: ccData.totals.cacheReadTokens,
        dateRange,
        modelsUsed,
        dailyBreakdown: ccData.daily,
        verified,
        source,
      })
      .returning();
    
    submissionId = newSubmission.id;
  }

  // Update or create profile
  const existingProfile = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (existingProfile.length > 0) {
    const updates: any = {
      bestSubmission: submissionId,
      username: email, // Keep for backwards compatibility
    };
    
    if (!existingSubmission) {
      updates.totalSubmissions = existingProfile[0].totalSubmissions + 1;
    }
    
    await getDb()
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, existingProfile[0].id));
  } else {
    await getDb()
      .insert(profiles)
      .values({
        username: email, // Keep for backwards compatibility
        email,
        totalSubmissions: 1,
        bestSubmission: submissionId,
      });
  }

  return submissionId;
}

export async function getLeaderboard(options: {
  sortBy?: 'cost' | 'tokens';
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  includeFlagged?: boolean;
} = {}) {
  const { sortBy = 'cost', limit = 100, dateFrom, dateTo, includeFlagged = false } = options;
  
  let query = getDb().select().from(submissions);
  
  if (!includeFlagged) {
    query = query.where(or(eq(submissions.flaggedForReview, false), eq(submissions.flaggedForReview, null)));
  }
  
  const orderBy = sortBy === 'cost' ? desc(submissions.totalCost) : desc(submissions.totalTokens);
  const results = await query.orderBy(orderBy).limit(limit);
  
  // If date filtering is needed, we'd need to implement client-side filtering
  // similar to the Convex implementation
  return results;
}

export async function getSubmission(id: number) {
  const result = await getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);
  
  return result[0] || null;
}

export async function getProfile(username: string) {
  const profile = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
  
  if (!profile.length) return null;
  
  const userSubmissions = await getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.username, username))
    .orderBy(desc(submissions.submittedAt));
  
  return {
    ...profile[0],
    submissions: userSubmissions,
  };
}

export async function getFlaggedSubmissions() {
  return await getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.flaggedForReview, true))
    .orderBy(desc(submissions.submittedAt));
}

export async function updateFlagStatus(submissionId: number, flagged: boolean, reason?: string) {
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }
  
  const updates: any = {
    flaggedForReview: flagged,
  };
  
  if (flagged && reason) {
    updates.flagReasons = [...(submission.flagReasons || []), reason];
  } else if (!flagged) {
    updates.flagReasons = null;
  }
  
  await getDb()
    .update(submissions)
    .set(updates)
    .where(eq(submissions.id, submissionId));
  
  return { success: true };
}

export async function getGlobalStats() {
  const allSubmissions = await getDb().select().from(submissions);
  
  const uniqueUsers = new Set(allSubmissions.map(s => s.username)).size;
  const totalCost = allSubmissions.reduce((acc, s) => acc + parseFloat(s.totalCost), 0);
  const totalTokens = allSubmissions.reduce((acc, s) => acc + s.totalTokens, 0);
  
  const topSubmission = allSubmissions.sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))[0];
  const avgCostPerUser = uniqueUsers > 0 ? totalCost / uniqueUsers : 0;
  
  const modelUsage = allSubmissions.reduce((acc, s) => {
    s.modelsUsed.forEach((model: string) => {
      const key = model.includes("opus") ? "opus" : "sonnet";
      acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  const totalDays = allSubmissions.reduce((acc, s) => acc + s.dailyBreakdown.length, 0);
  
  return {
    totalUsers: uniqueUsers,
    totalSubmissions: allSubmissions.length,
    totalCost,
    totalTokens,
    avgCostPerUser,
    topCost: topSubmission ? parseFloat(topSubmission.totalCost) : 0,
    topUser: topSubmission?.username || "N/A",
    modelUsage,
    totalDays,
    avgTokensPerUser: uniqueUsers > 0 ? totalTokens / uniqueUsers : 0,
  };
}