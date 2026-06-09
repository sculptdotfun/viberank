/**
 * Abstracted React Hooks for Profiles
 *
 * These hooks are backed by Supabase.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [supabaseData, setSupabaseData] = useState<ProfileWithSubmissions | null | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  useEffect(() => {
    if (!username) {
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
  }, [username, submissionLimit]);

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
  };
}

/**
 * Hook for finding profiles by pattern (admin)
 */
export function useFindProfilesByPattern() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<FindProfilesResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(
    async (patterns: string[], options: PatternSearchOptions = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        const { createSupabaseDataLayer } = await import("../supabase/client");
        const dataLayer = createSupabaseDataLayer();
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
    []
  );

  return { search, data, isLoading, error };
}

/**
 * Hook for deleting profiles by pattern (admin)
 */
export function useDeleteProfilesByPattern() {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (
      patterns: string[],
      options: PatternSearchOptions & { dryRun?: boolean } = {}
    ): Promise<DeleteResult> => {
      setIsLoading(true);

      try {
        const { createSupabaseDataLayer } = await import("../supabase/client");
        const dataLayer = createSupabaseDataLayer();
        return await dataLayer.profiles.deleteByPattern(patterns, options);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { mutate, isLoading };
}
