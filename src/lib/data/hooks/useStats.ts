/**
 * Abstracted React Hooks for Stats
 *
 * These hooks are backed by Supabase.
 */

"use client";

import { useState, useEffect } from "react";
import type { GlobalStats } from "../types";

/**
 * Hook for getting global statistics
 */
export function useGlobalStats() {
  const [supabaseData, setSupabaseData] = useState<GlobalStats | undefined>();
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState<Error | null>(null);

  useEffect(() => {
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
  }, []);

  return {
    data: supabaseData,
    isLoading: supabaseLoading,
    error: supabaseError,
  };
}
