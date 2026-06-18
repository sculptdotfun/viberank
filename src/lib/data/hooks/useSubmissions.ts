/**
 * Abstracted React Hooks for Submissions
 *
 * These hooks are backed by Supabase.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
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
import { getLeaderboardRequestKey } from "@/lib/leaderboard-view";

type KeyedLeaderboardResult = LeaderboardResult & { requestKey: string };
type KeyedDateRangeLeaderboardResult = DateRangeLeaderboardResult & { requestKey: string };

// ============================================================================
// LEADERBOARD HOOKS
// ============================================================================

/**
 * Hook for fetching the leaderboard (regular, paginated)
 */
export function useLeaderboard(params: LeaderboardParams | "skip") {
  const [supabaseData, setSupabaseData] = useState<KeyedLeaderboardResult | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<Error | null>(null);
  const paramsKey = params === "skip" ? "skip" : getLeaderboardRequestKey(params);

  useEffect(() => {
    let active = true;

    if (params === "skip") {
      setSupabaseData(undefined);
      setSupabaseLoading(false);
      return;
    }

    setSupabaseData(undefined);
    setSupabaseLoading(true);
    setSupabaseError(null);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.submissions.getLeaderboard(params);
      })
      .then((data) => {
        if (active) setSupabaseData({ ...data, requestKey: paramsKey });
      })
      .catch((error) => {
        if (active) setSupabaseError(error);
      })
      .finally(() => {
        if (active) setSupabaseLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paramsKey]);

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
  const [supabaseData, setSupabaseData] = useState<KeyedDateRangeLeaderboardResult | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<Error | null>(null);
  const paramsKey = params === "skip"
    ? "skip"
    : JSON.stringify({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sortBy: params.sortBy ?? "cost",
        limit: params.limit ?? null,
        cursor: params.cursor ?? null,
        tool: params.tool ?? null,
        verifiedOnly: Boolean(params.verifiedOnly),
      });

  useEffect(() => {
    let active = true;

    if (params === "skip") {
      setSupabaseData(undefined);
      setSupabaseLoading(false);
      return;
    }

    setSupabaseData(undefined);
    setSupabaseLoading(true);
    setSupabaseError(null);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.submissions.getLeaderboardByDateRange(params);
      })
      .then((data) => {
        if (active) setSupabaseData({ ...data, requestKey: paramsKey });
      })
      .catch((error) => {
        if (active) setSupabaseError(error);
      })
      .finally(() => {
        if (active) setSupabaseLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paramsKey]);

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (data: SubmitData): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.ccData),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Submit failed");
      }
      return body.submissionId as string;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

/**
 * Hook for getting a single submission
 */
export function useSubmission(id: string | undefined) {
  const [supabaseData, setSupabaseData] = useState<Submission | null | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  useEffect(() => {
    if (!id) {
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
  }, [id]);

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for getting flagged submissions (admin)
 */
export function useFlaggedSubmissions(limit?: number, enabled: boolean = true) {
  const [supabaseData, setSupabaseData] = useState<Submission[] | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  useEffect(() => {
    // Don't fetch for non-admin visitors — the data is public-readable but
    // there's no reason to pull it for everyone who lands on /admin.
    if (!enabled) {
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
  }, [limit, enabled]);

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for updating flag status (admin)
 */
export function useUpdateFlagStatus() {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (id: string, flagged: boolean, reason?: string) => {
      setIsLoading(true);

      try {
        // Route through the authenticated admin API (service-role) instead of
        // a browser anon-key write, which RLS silently blocks. See #42/#47.
        const res = await fetch("/api/admin/flag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, flagged, reason }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error || "Failed to update flag status");
        }
        return body;
      } finally {
        setIsLoading(false);
      }
    },
    []
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
  const [supabaseData, setSupabaseData] = useState<ClaimStatus | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  useEffect(() => {
    if (!githubUsername) {
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
  }, [githubUsername]);

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for claiming and merging submissions
 */
export function useClaimAndMergeSubmissions() {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(async (): Promise<ClaimResult> => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/claim", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.error || "Claim/merge request failed");
      }

      return body as ClaimResult;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading };
}
