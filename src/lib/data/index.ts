/**
 * Data Layer Abstraction
 *
 * This module provides a unified interface for data operations.
 *
 * Usage:
 * - Components use hooks from ./hooks/* which talk to Supabase
 * - Server-side code uses getDataLayer() or getServerDataLayer()
 */

import type { DatabaseBackend, DataLayer } from "./types";

// ============================================================================
// BACKEND
// ============================================================================

/**
 * Get the current database backend.
 */
export function getDatabaseBackend(): DatabaseBackend {
  if (process.env.NEXT_PUBLIC_VIBERANK_DEMO_DATA === "1") {
    return "demo";
  }
  return "supabase";
}

// ============================================================================
// DATA LAYER FACTORY (LAZY LOADING)
// ============================================================================

// Cache instances to avoid re-creating clients
let supabaseDataLayer: DataLayer | null = null;
let supabaseServerDataLayer: DataLayer | null = null;
let demoDataLayer: DataLayer | null = null;

/**
 * Get the data layer for the current backend (client-side)
 */
export async function getDataLayer(): Promise<DataLayer> {
  if (getDatabaseBackend() === "demo") {
    if (!demoDataLayer) {
      const { createDemoDataLayer } = await import("./demo/client");
      demoDataLayer = createDemoDataLayer();
    }
    return demoDataLayer;
  }

  if (!supabaseDataLayer) {
    const { createSupabaseDataLayer } = await import("./supabase/client");
    supabaseDataLayer = createSupabaseDataLayer();
  }
  return supabaseDataLayer;
}

/**
 * Get the data layer for server-side operations
 * Used in API routes and server components
 */
export async function getServerDataLayer(): Promise<DataLayer> {
  if (getDatabaseBackend() === "demo") {
    if (!demoDataLayer) {
      const { createDemoDataLayer } = await import("./demo/client");
      demoDataLayer = createDemoDataLayer();
    }
    return demoDataLayer;
  }

  if (!supabaseServerDataLayer) {
    const { createSupabaseServerDataLayer } = await import("./supabase/client");
    supabaseServerDataLayer = createSupabaseServerDataLayer();
  }
  return supabaseServerDataLayer;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export * from "./types";
