/**
 * Abstracted React Hooks for Stats
 *
 * These hooks work with both Convex and Supabase backends.
 */

"use client";

import { useState, useEffect } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getDatabaseBackend } from "../index";
import type { GlobalStats } from "../types";

/**
 * Hook for getting global statistics
 */
export function useGlobalStats() {
  const backend = getDatabaseBackend();
  const [supabaseData, setSupabaseData] = useState<GlobalStats | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<Error | null>(null);

  // Convex query
  const convexResult = useConvexQuery(
    api.stats.getGlobalStats,
    backend === "convex" ? {} : "skip"
  );

  // Supabase query
  useEffect(() => {
    if (backend !== "supabase") {
      setSupabaseData(undefined);
      return;
    }

    setSupabaseLoading(true);
    setSupabaseError(null);

    import("../supabase/client")
      .then(({ createSupabaseDataLayer }) => {
        const dataLayer = createSupabaseDataLayer();
        return dataLayer.stats.getGlobalStats();
      })
      .then(setSupabaseData)
      .catch(setSupabaseError)
      .finally(() => setSupabaseLoading(false));
  }, [backend]);

  if (backend === "convex") {
    return {
      data: convexResult as GlobalStats | undefined,
      isLoading: convexResult === undefined,
      error: null,
    };
  }

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
    error: supabaseError,
  };
}
