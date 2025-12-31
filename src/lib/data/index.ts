/**
 * Data Layer Abstraction with Feature Flag
 *
 * This module provides a unified interface for data operations that can
 * switch between Convex and Supabase backends via a feature flag.
 *
 * Usage:
 * - Set NEXT_PUBLIC_DATABASE_BACKEND=convex|supabase in environment
 * - Components use hooks from ./hooks/* which auto-select the backend
 * - Server-side code uses getDataLayer() or getServerDataLayer()
 */

import type { DatabaseBackend, DataLayer } from "./types";

// ============================================================================
// FEATURE FLAG CONFIGURATION
// ============================================================================

/**
 * Get the current database backend from environment or localStorage override
 */
export function getDatabaseBackend(): DatabaseBackend {
  // Check for runtime override in browser (useful for testing)
  if (typeof window !== "undefined") {
    const override = localStorage.getItem("db_backend") as DatabaseBackend;
    if (override && ["convex", "supabase"].includes(override)) {
      return override;
    }
  }

  // Read from environment variable
  const envBackend = process.env
    .NEXT_PUBLIC_DATABASE_BACKEND as DatabaseBackend;
  if (envBackend && ["convex", "supabase"].includes(envBackend)) {
    return envBackend;
  }

  // Default to Convex during migration
  return "convex";
}

/**
 * Set database backend override at runtime (browser only)
 * Useful for testing or gradual rollout
 */
export function setDatabaseBackend(backend: DatabaseBackend): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("db_backend", backend);
    // Trigger storage event for cross-tab sync
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "db_backend",
        newValue: backend,
      })
    );
  }
}

/**
 * Clear database backend override, reverting to environment default
 */
export function clearDatabaseBackendOverride(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("db_backend");
  }
}

// ============================================================================
// DATA LAYER FACTORY (LAZY LOADING)
// ============================================================================

// Cache instances to avoid re-creating clients
let convexDataLayer: DataLayer | null = null;
let supabaseDataLayer: DataLayer | null = null;

/**
 * Get the data layer for the current backend (client-side)
 * Uses lazy loading to only import the needed backend
 */
export async function getDataLayer(): Promise<DataLayer> {
  const backend = getDatabaseBackend();

  if (backend === "supabase") {
    if (!supabaseDataLayer) {
      const { createSupabaseDataLayer } = await import("./supabase/client");
      supabaseDataLayer = createSupabaseDataLayer();
    }
    return supabaseDataLayer;
  }

  // Default: Convex
  if (!convexDataLayer) {
    const { createConvexDataLayer } = await import("./convex/client");
    convexDataLayer = createConvexDataLayer();
  }
  return convexDataLayer;
}

/**
 * Get the data layer for server-side operations
 * Used in API routes and server components
 */
export async function getServerDataLayer(): Promise<DataLayer> {
  const backend = getDatabaseBackend();

  if (backend === "supabase") {
    const { createSupabaseServerDataLayer } = await import("./supabase/client");
    return createSupabaseServerDataLayer();
  }

  const { createConvexServerDataLayer } = await import("./convex/client");
  return createConvexServerDataLayer();
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export * from "./types";
