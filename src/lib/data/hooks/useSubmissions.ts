/**
 * Abstracted React Hooks for Submissions
 *
 * These hooks work with both Convex and Supabase backends,
 * automatically selecting the right one based on the feature flag.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getDatabaseBackend } from "../index";
import type {
  Submission,
  LeaderboardParams,
  DateRangeLeaderboardParams,
  LeaderboardResult,
  DateRangeLeaderboardResult,
  SubmitData,
  ClaimStatus,
  ClaimResult,
} from "../types";

// ============================================================================
// LEADERBOARD HOOKS
// ============================================================================

/**
 * Hook for fetching the leaderboard (regular, paginated)
 */
export function useLeaderboard(params: LeaderboardParams | "skip") {
  const backend = getDatabaseBackend();
  const [supabaseData, setSupabaseData] = useState<LeaderboardResult | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<Error | null>(null);

  // Convex query (only runs when backend is 'convex')
  const convexResult = useConvexQuery(
    api.submissions.getLeaderboard,
    backend === "convex" && params !== "skip"
      ? {
          sortBy: params.sortBy,
          page: params.page,
          pageSize: params.pageSize,
          includeFlagged: params.includeFlagged,
        }
      : "skip"
  );

  // Supabase query (only runs when backend is 'supabase')
  useEffect(() => {
    if (backend !== "supabase" || params === "skip") {
      setSupabaseData(undefined);
      return;
    }

    setSupabaseLoading(true);
    setSupabaseError(null);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.submissions.getLeaderboard(params);
      })
      .then(setSupabaseData)
      .catch(setSupabaseError)
      .finally(() => setSupabaseLoading(false));
  }, [backend, JSON.stringify(params)]);

  if (backend === "convex") {
    return {
      data: convexResult
        ? {
            items: convexResult.items.map((item: any) => ({
              ...item,
              id: item._id,
            })),
            page: convexResult.page,
            pageSize: convexResult.pageSize,
            hasMore: convexResult.hasMore,
            totalPages: convexResult.totalPages,
          }
        : undefined,
      isLoading: convexResult === undefined && params !== "skip",
      error: null,
    };
  }

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
    error: supabaseError,
  };
}

/**
 * Hook for fetching date-filtered leaderboard
 */
export function useLeaderboardByDateRange(params: DateRangeLeaderboardParams | "skip") {
  const backend = getDatabaseBackend();
  const [supabaseData, setSupabaseData] = useState<DateRangeLeaderboardResult | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<Error | null>(null);

  // Convex query
  const convexResult = useConvexQuery(
    api.submissions.getLeaderboardByDateRange,
    backend === "convex" && params !== "skip"
      ? {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          sortBy: params.sortBy,
          limit: params.limit,
          cursor: params.cursor as any,
          includeFlagged: params.includeFlagged,
        }
      : "skip"
  );

  // Supabase query
  useEffect(() => {
    if (backend !== "supabase" || params === "skip") {
      setSupabaseData(undefined);
      return;
    }

    setSupabaseLoading(true);
    setSupabaseError(null);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.submissions.getLeaderboardByDateRange(params);
      })
      .then(setSupabaseData)
      .catch(setSupabaseError)
      .finally(() => setSupabaseLoading(false));
  }, [backend, JSON.stringify(params)]);

  if (backend === "convex") {
    return {
      data: convexResult
        ? {
            items: convexResult.items.map((item: any) => ({
              ...item,
              id: item._id,
            })),
            nextCursor: convexResult.nextCursor,
            hasMore: convexResult.hasMore,
            needsMoreData: convexResult.needsMoreData,
          }
        : undefined,
      isLoading: convexResult === undefined && params !== "skip",
      error: null,
    };
  }

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
    error: supabaseError,
  };
}

// ============================================================================
// SUBMISSION HOOKS
// ============================================================================

/**
 * Hook for submitting usage data
 */
export function useSubmit() {
  const backend = getDatabaseBackend();
  const convexMutation = useConvexMutation(api.submissions.submit);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (data: SubmitData): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        if (backend === "supabase") {
          const { createSupabaseDataLayer } = await import("../supabase/client");
          const dataLayer = createSupabaseDataLayer();
          return await dataLayer.submissions.submit(data);
        }

        return await convexMutation(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [backend, convexMutation]
  );

  return { mutate, isLoading, error };
}

/**
 * Hook for getting a single submission
 */
export function useSubmission(id: string | undefined) {
  const backend = getDatabaseBackend();
  const [supabaseData, setSupabaseData] = useState<Submission | null | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  // Convex query
  const convexResult = useConvexQuery(
    api.submissions.getSubmission,
    backend === "convex" && id ? { id: id as any } : "skip"
  );

  // Supabase query
  useEffect(() => {
    if (backend !== "supabase" || !id) {
      setSupabaseData(undefined);
      return;
    }

    setSupabaseLoading(true);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.submissions.getSubmission(id);
      })
      .then(setSupabaseData)
      .finally(() => setSupabaseLoading(false));
  }, [backend, id]);

  if (backend === "convex") {
    return {
      data: convexResult ? { ...convexResult, id: convexResult._id } : convexResult,
      isLoading: convexResult === undefined && !!id,
    };
  }

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for getting flagged submissions (admin)
 */
export function useFlaggedSubmissions(limit?: number) {
  const backend = getDatabaseBackend();
  const [supabaseData, setSupabaseData] = useState<Submission[] | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  // Convex query
  const convexResult = useConvexQuery(
    api.submissions.getFlaggedSubmissions,
    backend === "convex" ? { limit } : "skip"
  );

  // Supabase query
  useEffect(() => {
    if (backend !== "supabase") {
      setSupabaseData(undefined);
      return;
    }

    setSupabaseLoading(true);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.submissions.getFlaggedSubmissions(limit);
      })
      .then(setSupabaseData)
      .finally(() => setSupabaseLoading(false));
  }, [backend, limit]);

  if (backend === "convex") {
    return {
      data: convexResult?.map((item: any) => ({ ...item, id: item._id })),
      isLoading: convexResult === undefined,
    };
  }

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for updating flag status (admin)
 */
export function useUpdateFlagStatus() {
  const backend = getDatabaseBackend();
  const convexMutation = useConvexMutation(api.submissions.updateFlagStatus);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (id: string, flagged: boolean, reason?: string) => {
      setIsLoading(true);

      try {
        if (backend === "supabase") {
          const { createSupabaseDataLayer } = await import("../supabase/client");
          const dataLayer = createSupabaseDataLayer();
          return await dataLayer.submissions.updateFlagStatus(id, flagged, reason);
        }

        return await convexMutation({
          submissionId: id as any,
          flagged,
          reason,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [backend, convexMutation]
  );

  return { mutate, isLoading };
}

// ============================================================================
// CLAIM/MERGE HOOKS
// ============================================================================

/**
 * Hook for checking claimable submissions
 */
export function useCheckClaimableSubmissions(githubUsername: string | undefined) {
  const backend = getDatabaseBackend();
  const [supabaseData, setSupabaseData] = useState<ClaimStatus | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  // Convex query
  const convexResult = useConvexQuery(
    api.submissions.checkClaimableSubmissions,
    backend === "convex" && githubUsername ? { githubUsername } : "skip"
  );

  // Supabase query
  useEffect(() => {
    if (backend !== "supabase" || !githubUsername) {
      setSupabaseData(undefined);
      return;
    }

    setSupabaseLoading(true);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.submissions.checkClaimableSubmissions(githubUsername);
      })
      .then(setSupabaseData)
      .finally(() => setSupabaseLoading(false));
  }, [backend, githubUsername]);

  if (backend === "convex") {
    return {
      data: convexResult as ClaimStatus | undefined,
      isLoading: convexResult === undefined && !!githubUsername,
    };
  }

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for claiming and merging submissions
 */
export function useClaimAndMergeSubmissions() {
  const backend = getDatabaseBackend();
  const convexMutation = useConvexMutation(api.submissions.claimAndMergeSubmissions);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (githubUsername: string): Promise<ClaimResult> => {
      setIsLoading(true);

      try {
        if (backend === "supabase") {
          const { createSupabaseDataLayer } = await import("../supabase/client");
          const dataLayer = createSupabaseDataLayer();
          return await dataLayer.submissions.claimAndMergeSubmissions(githubUsername);
        }

        const result = await convexMutation({ githubUsername });
        return {
          success: result.success,
          action: result.action as "already_verified" | "claimed" | "merged",
          submissionId: result.submissionId || "",
          mergedCount: result.mergedCount || 0,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [backend, convexMutation]
  );

  return { mutate, isLoading };
}
