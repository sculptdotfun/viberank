/**
 * Abstracted React Hooks for Profiles
 *
 * These hooks work with both Convex and Supabase backends.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getDatabaseBackend } from "../index";
import type {
  ProfileWithSubmissions,
  DeleteResult,
  FindProfilesResult,
  PatternSearchOptions,
} from "../types";

/**
 * Hook for getting a user profile with their submissions
 */
export function useProfile(username: string | undefined, submissionLimit?: number) {
  const backend = getDatabaseBackend();
  const [supabaseData, setSupabaseData] = useState<ProfileWithSubmissions | null | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  // Convex query
  const convexResult = useConvexQuery(
    api.submissions.getProfile,
    backend === "convex" && username
      ? { username, submissionLimit }
      : "skip"
  );

  // Supabase query
  useEffect(() => {
    if (backend !== "supabase" || !username) {
      setSupabaseData(undefined);
      return;
    }

    setSupabaseLoading(true);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.profiles.getProfile(username, submissionLimit);
      })
      .then(setSupabaseData)
      .finally(() => setSupabaseLoading(false));
  }, [backend, username, submissionLimit]);

  if (backend === "convex") {
    if (convexResult === undefined) {
      return {
        data: undefined,
        isLoading: !!username,
      };
    }

    if (convexResult === null) {
      return {
        data: null,
        isLoading: false,
      };
    }

    // Convert Convex result to our type
    return {
      data: {
        id: convexResult._id,
        username: convexResult.username,
        githubUsername: convexResult.githubUsername,
        githubName: convexResult.githubName,
        bio: convexResult.bio,
        avatar: convexResult.avatar,
        totalSubmissions: convexResult.totalSubmissions,
        bestSubmission: convexResult.bestSubmission,
        createdAt: convexResult.createdAt,
        submissions: convexResult.submissions.map((s: any) => ({
          ...s,
          id: s._id,
        })),
      } as ProfileWithSubmissions,
      isLoading: false,
    };
  }

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for finding profiles by pattern (admin)
 */
export function useFindProfilesByPattern() {
  const backend = getDatabaseBackend();
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<FindProfilesResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(
    async (patterns: string[], options: PatternSearchOptions = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        if (backend === "supabase") {
          const { createSupabaseDataLayer } = await import("../supabase/client");
          const dataLayer = createSupabaseDataLayer();
          const result = await dataLayer.profiles.findByPattern(patterns, options);
          setData(result);
          return result;
        }

        // For Convex, we need to use the HTTP client since this is a manual trigger
        const { createConvexDataLayer } = await import("../convex/client");
        const dataLayer = createConvexDataLayer();
        const result = await dataLayer.profiles.findByPattern(patterns, options);
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [backend]
  );

  return { search, data, isLoading, error };
}

/**
 * Hook for deleting profiles by pattern (admin)
 */
export function useDeleteProfilesByPattern() {
  const backend = getDatabaseBackend();
  const convexMutation = useConvexMutation(api.admin.deleteProfilesByPattern);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (
      patterns: string[],
      options: PatternSearchOptions & { dryRun?: boolean } = {}
    ): Promise<DeleteResult> => {
      setIsLoading(true);

      try {
        if (backend === "supabase") {
          const { createSupabaseDataLayer } = await import("../supabase/client");
          const dataLayer = createSupabaseDataLayer();
          return await dataLayer.profiles.deleteByPattern(patterns, options);
        }

        const result = await convexMutation({
          patterns,
          searchField: options.searchField,
          caseSensitive: options.caseSensitive,
          dryRun: options.dryRun,
        });

        return {
          message: result.message,
          matchedCount: result.matchedCount,
          deletedCount: result.deletedCount,
          dryRun: result.dryRun,
          patterns: result.patterns,
          searchField: result.searchField,
          profiles: result.profiles.map((p: any) => ({
            id: p.id,
            githubUsername: p.githubUsername,
            username: p.username,
            createdAt: p.createdAt,
          })),
        };
      } finally {
        setIsLoading(false);
      }
    },
    [backend, convexMutation]
  );

  return { mutate, isLoading };
}
