/**
 * Data Layer Abstraction (Supabase-only)
 *
 * This module provides a unified interface for data operations backed by
 * Supabase.
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
 * Get the current database backend. The app is Supabase-only.
 */
export function getDatabaseBackend(): DatabaseBackend {
  return "supabase";
}

// ============================================================================
// DATA LAYER FACTORY (LAZY LOADING)
// ============================================================================

// Cache instances to avoid re-creating clients
let supabaseDataLayer: DataLayer | null = null;
let supabaseServerDataLayer: DataLayer | null = null;

/**
 * Get the data layer for the current backend (client-side)
 */
export async function getDataLayer(): Promise<DataLayer> {
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
